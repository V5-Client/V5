import { Chat } from '../../Chat';
import { BP, SnowBlock, Vec3d } from '../../Constants';
import { Keybind } from '../../player/Keybinding';
import PathConfig from '../PathConfig';
import { PathExecutor } from '../PathExecutor';
import { Movement } from './PathMovement';

class PathJumps {
    constructor() {
        this.lastLookaheadPositions = [];
        this.currentLookaheadVecs = [];
        this.blockCache = new Map();
        this.cacheFrame = 0;
        this.lastFluidMessage = 0;

        this.STEP_HEIGHT = 0.6;
        this.LOOKAHEAD_NODES = 3;

        PathExecutor.onTick(() => {
            this.cacheFrame++;
            if (this.blockCache.size > 1000) this.blockCache.clear();
        });
    }

    getCachedBlock(x, y, z) {
        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);
        const key = `${bx},${by},${bz},${this.cacheFrame}`;

        if (!this.blockCache.has(key)) {
            this.blockCache.set(key, World.getBlockAt(bx, by, bz));
        }

        return this.blockCache.get(key);
    }

    isBlockNonCollidable(world, blockVec) {
        const blockPosNMS = new BP(Math.floor(blockVec.x), Math.floor(blockVec.y), Math.floor(blockVec.z));
        const blockState = world.getBlockState(blockPosNMS);
        return blockState.getCollisionShape(world, blockPosNMS).isEmpty();
    }

    isBlockSolid(x, y, z) {
        const block = this.getCachedBlock(x, y, z);
        if (!block || block.type.getID() === 0) return false;
        const world = World.getWorld();
        const blockPosNMS = new BP(Math.floor(x), Math.floor(y), Math.floor(z));
        const blockState = world.getBlockState(blockPosNMS);
        return !blockState.getCollisionShape(world, blockPosNMS).isEmpty();
    }

    hasLowCeiling(x, y, z) {
        const world = World.getWorld();
        for (let offset = 2; offset <= 3; offset++) {
            const block = this.getCachedBlock(x, y + offset, z);
            if (!block || block.type.getID() === 0) continue;
            if (block.type.getRegistryName().toLowerCase().includes('stair')) continue;
            const blockPosNMS = new BP(Math.floor(x), Math.floor(y + offset), Math.floor(z));
            const blockState = world.getBlockState(blockPosNMS);
            if (!blockState.getCollisionShape(world, blockPosNMS).isEmpty()) return true;
        }
        return false;
    }

    isPlayerInFluid() {
        const playerMP = Player.asPlayerMP();
        if (!playerMP) return false;
        if (playerMP.isInLava() || playerMP.isInWater()) return true;
        const block = this.getCachedBlock(Player.getX(), Player.getY(), Player.getZ());
        if (block) {
            const name = block.type.getRegistryName().toLowerCase();
            return name.includes('water') || name.includes('lava');
        }
        return false;
    }

    canWalkUpStairs(playerX, playerY, playerZ, blockX, blockY, blockZ) {
        const world = World.getWorld();
        const blockPosNMS = new BP(Math.floor(blockX), Math.floor(blockY), Math.floor(blockZ));
        const blockState = world.getBlockState(blockPosNMS);
        try {
            const stateString = blockState.toString();
            const facingMatch = stateString.match(/facing=(\w+)/);
            if (!facingMatch) return true;
            const facingDir = facingMatch[1].toLowerCase();
            const dx = blockX + 0.5 - playerX;
            const dz = blockZ + 0.5 - playerZ;
            let approach;
            if (Math.abs(dx) > Math.abs(dz)) {
                approach = dx > 0 ? 'west' : 'east';
            } else {
                approach = dz > 0 ? 'north' : 'south';
            }
            const walkable = { north: 'south', south: 'north', east: 'west', west: 'east' }[facingDir];
            return approach === walkable;
        } catch (e) {
            return true;
        }
    }

    getSnowLayers(block) {
        if (!block || block.type.getRegistryName() !== 'minecraft:snow') return 0;
        try {
            return block.getState().get(SnowBlock.LAYERS);
        } catch (e) {
            return 0;
        }
    }

    drawPathAndPlayerLookAhead(path) {
        if (!Player.getPlayer() || !path || path.length === 0) return { lookahead: [], closestIndex: -1 };

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        let closestIndex = -1,
            minDSq = Infinity;

        path.forEach((node, index) => {
            const dSq = Math.pow(pX - (node.x + 0.5), 2) + Math.pow(pY - (node.y + 0.5), 2) + Math.pow(pZ - (node.z + 0.5), 2);
            if (dSq < minDSq) {
                minDSq = dSq;
                closestIndex = index;
            }
        });

        if (closestIndex === -1) return { lookahead: [], closestIndex: -1 };

        const lookahead = [];
        const end = Math.min(closestIndex + 1 + this.LOOKAHEAD_NODES, path.length);
        const world = World.getWorld();

        for (let i = closestIndex + 1; i < end; i++) {
            const node = path[i];
            const floorY = Math.round(node.y);
            const blockVec = new Vec3d(Math.floor(node.x), floorY, Math.floor(node.z));
            const block = this.getCachedBlock(node.x, floorY, node.z);

            const isSolid = !this.isBlockNonCollidable(world, blockVec);

            if (isSolid) {
                const name = block ? block.type.getRegistryName().toLowerCase() : 'minecraft:air';
                lookahead.push({ vec: blockVec, name, block });
            }
        }

        return { lookahead, closestIndex };
    }
    checkFluidJump() {
        if (!this.isPlayerInFluid()) return false;
        Keybind.setKey('space', true);
        if (Date.now() - this.lastFluidMessage > 2000) {
            if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder('Fluid jump detected');
            this.lastFluidMessage = Date.now();
        }
        return true;
    }

    checkSnowJump(lookahead) {
        if (lookahead.length < 1) return false;
        const data = lookahead[0];
        if (!data.block || data.block.type.getRegistryName() !== 'minecraft:snow') return false;
        const layers = this.getSnowLayers(data.block);
        if (layers === 0) return false;
        const diff = data.vec.y - (8 - layers) * 0.125 - (Player.getY() - 1);
        if (diff > 0.75 && layers > 6) {
            if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder('Snow jump detected');
            Keybind.setKey('space', true);
            return true;
        }
        return false;
    }

    checkObstacleJump(lookahead) {
        if (lookahead.length === 0) return false;
        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        const playerFloorY = Math.floor(pY - 0.001);
        const currentFeetBlock = this.getCachedBlock(pX, playerFloorY, pZ);
        const currentName = currentFeetBlock ? currentFeetBlock.type.getRegistryName().toLowerCase() : '';
        const standingOnPartial = currentName.includes('stair') || currentName.includes('slab');
        const stairClimbLimit = standingOnPartial ? 1.05 : this.STEP_HEIGHT;
        let needsJump = false;
        let canWalkInstead = false;
        for (const data of lookahead) {
            if (data.block && data.block.type.getRegistryName().includes('snow')) continue;
            const heightDifference = data.vec.y - playerFloorY;
            if (heightDifference > stairClimbLimit) needsJump = true;
            if (data.name.includes('slab')) {
                canWalkInstead = true;
            } else if (data.name.includes('stair')) {
                if (this.canWalkUpStairs(pX, pY, pZ, data.vec.x, data.vec.y, data.vec.z)) canWalkInstead = true;
            }
        }
        if (needsJump && !canWalkInstead) {
            if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder('Standard jump detected');
            Keybind.setKey('space', true);
            return true;
        }
        return false;
    }

    checkGapJump(path, closestIndex) {
        if (closestIndex === -1 || path.length < closestIndex + 3) return false;

        const pY = Player.getY();
        let baseY = Math.round(path[closestIndex].y);

        if (Math.abs(pY - (baseY + 1)) > 1.8) return false;

        let dropIndex = -1;
        let recoveryIndex = -1;

        const maxLook = Math.min(path.length, closestIndex + 7);

        for (let i = closestIndex + 1; i < maxLook; i++) {
            let y = Math.round(path[i].y);
            if (y < baseY) {
                if (dropIndex === -1) dropIndex = i;
            } else if (dropIndex !== -1 && y >= baseY) {
                recoveryIndex = i;
                break;
            } else if (y > baseY && dropIndex === -1) {
                return false;
            }
        }

        if (dropIndex !== -1 && recoveryIndex !== -1) {
            const dropStartNode = path[dropIndex - 1];
            const recoveryNode = path[recoveryIndex];

            const gapHorizDistSq = Math.pow(recoveryNode.x - dropStartNode.x, 2) + Math.pow(recoveryNode.z - dropStartNode.z, 2);

            if (gapHorizDistSq > 0 && gapHorizDistSq <= 20) {
                const pX = Player.getX();
                const pZ = Player.getZ();

                const distToEdgeSq = Math.pow(pX - (dropStartNode.x + 0.5), 2) + Math.pow(pZ - (dropStartNode.z + 0.5), 2);

                if (distToEdgeSq <= 1.35 * 1.35) {
                    if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder('Gap jump detected');
                    Keybind.setKey('space', true);
                    return true;
                }
            }
        }
        return false;
    }

    detectJump(path) {
        if (!Player.getPlayer()) return this.reset();
        const { lookahead, closestIndex } = this.drawPathAndPlayerLookAhead(path);

        this.currentLookaheadVecs = lookahead;

        if (closestIndex === -1) return this.reset();
        if (this.checkFluidJump()) return;

        if (!Player.getPlayer().isOnGround()) return;

        if (this.hasLowCeiling(Math.floor(Player.getX()), Math.floor(Player.getY() - 0.001), Math.floor(Player.getZ()))) {
            this.reset();
            return;
        }

        if (this.checkGapJump(path, closestIndex)) return;

        if (this.checkSnowJump(lookahead)) return;
        if (this.checkObstacleJump(lookahead)) return;

        if (!Movement.isRecovering()) {
            Keybind.setKey('space', false);
        }
        this.lastLookaheadPositions = lookahead.map((d) => d.vec.y);
    }

    reset() {
        this.lastLookaheadPositions = [];
        this.currentLookaheadVecs = [];
        Keybind.setKey('space', false);
    }
}

export const Jump = new PathJumps();
