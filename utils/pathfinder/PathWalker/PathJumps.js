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
        this.EDGE_LOOKAHEAD_NODES = 5;
        this.EDGE_JUMP_DISTANCE = 1.8;
        this.GAP_CHECK_RESOLUTION = 0.5;
        this.MIN_GAP_WIDTH = 1.8;
        this.MAX_GAP_SEARCH = 4;

        PathExecutor.onTick(() => {
            this.cacheFrame++;
            if (this.blockCache.size > 1000) this.blockCache.clear();
        });
    }

    getCachedBlock(x, y, z) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)},${this.cacheFrame}`;

        if (!this.blockCache.has(key)) {
            this.blockCache.set(key, World.getBlockAt(Math.floor(x), Math.round(y), Math.floor(z)));
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

    hasGapAt(x, y, z) {
        return !this.isBlockSolid(x, y, z) || !this.isBlockSolid(x, y - 1, z);
    }

    calculateGapWidth(startNode, path, startIndex) {
        const maxSearch = Math.min(startIndex + this.MAX_GAP_SEARCH, path.length);
        for (let i = startIndex; i < maxSearch; i++) {
            const node = path[i];
            if (!this.hasGapAt(node.x, node.y, node.z)) {
                const dx = node.x - startNode.x;
                const dz = node.z - startNode.z;
                return Math.hypot(dx, dz);
            }
        }
        return this.MAX_GAP_SEARCH + 1;
    }

    hasGapBetweenNodes(node1, node2) {
        const dx = node2.x - node1.x,
            dy = node2.y - node1.y,
            dz = node2.z - node1.z;
        const dist = Math.hypot(dx, dz);
        const numChecks = Math.ceil(dist / this.GAP_CHECK_RESOLUTION);
        if (numChecks === 0) return false;
        for (let i = 0; i <= numChecks; i++) {
            const t = i / numChecks;
            if (this.hasGapAt(node1.x + dx * t, node1.y + dy * t, node1.z + dz * t)) return true;
        }
        return false;
    }

    getSnowLayers(block) {
        if (!block || block.type.getRegistryName() !== 'minecraft:snow') return 0;
        try {
            return block.getState().get(SnowBlock.LAYERS);
        } catch (e) {
            return 0;
        }
    }

    getHorizontalDistance(x1, z1, x2, z2) {
        const dx = x1 - x2;
        const dz = z1 - z2;
        return Math.hypot(dx, dz);
    }

    getYawTo(fromX, fromZ, toX, toZ) {
        const dx = toX - fromX;
        const dz = toZ - fromZ;
        return (Math.atan2(-dx, dz) * 180) / Math.PI;
    }

    getYawDifference(fromYaw, toYaw) {
        let delta = (toYaw - fromYaw) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return Math.abs(delta);
    }

    isYawAligned(playerYaw, targetYaw, maxDiff) {
        return this.getYawDifference(playerYaw, targetYaw) <= maxDiff;
    }

    findLandingIndex(path, startIndex) {
        const maxSearch = Math.min(startIndex + this.MAX_GAP_SEARCH, path.length - 1);
        for (let i = startIndex + 1; i <= maxSearch; i++) {
            const node = path[i];
            if (!this.hasGapAt(node.x, node.y, node.z)) return i;
        }
        return -1;
    }

    isSafeLanding(node, baseY) {
        const landingBlock = this.getCachedBlock(node.x, node.y, node.z);
        if (!landingBlock) return false;
        const name = landingBlock.type.getRegistryName().toLowerCase();
        if (name.includes('slab') || name.includes('stair') || name.includes('snow')) return false;
        if (!this.isBlockSolid(node.x, node.y, node.z)) return false;
        if (!this.isBlockSolid(node.x, node.y - 1, node.z)) return false;
        if (this.isBlockSolid(node.x, baseY + 1, node.z)) return false;
        if (this.isBlockSolid(node.x, baseY + 2, node.z)) return false;
        return true;
    }

    hasClearJumpArc(startNode, endNode, baseY) {
        const dx = endNode.x - startNode.x;
        const dz = endNode.z - startNode.z;
        const dist = Math.hypot(dx, dz);
        const numChecks = Math.ceil(dist / this.GAP_CHECK_RESOLUTION);
        if (numChecks <= 0) return false;
        for (let i = 1; i < numChecks; i++) {
            const t = i / numChecks;
            const x = startNode.x + dx * t;
            const z = startNode.z + dz * t;
            if (this.isBlockSolid(x, baseY, z)) return false;
            if (this.isBlockSolid(x, baseY + 1, z)) return false;
            if (this.isBlockSolid(x, baseY + 2, z)) return false;
        }
        return true;
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

    checkEdgeJump(path, closestIndex) {
        const player = Player.getPlayer();
        if (!player || !player.isOnGround()) return false;

        const start = closestIndex + 1;
        const end = Math.min(start + this.EDGE_LOOKAHEAD_NODES, path.length);
        const playerX = Player.getX();
        const playerZ = Player.getZ();
        const playerYaw = player.getYaw();
        const baseY = Math.floor(Player.getY() - 0.001);

        for (let i = start; i < end; i++) {
            const node = path[i];
            const block = this.getCachedBlock(node.x, node.y, node.z);
            if (block) {
                const name = block.type.getRegistryName().toLowerCase();
                if (name.includes('snow')) return false;
                if (name.includes('slab') || name.includes('stair')) continue;
            }

            let hasGap = this.hasGapAt(node.x, node.y, node.z);
            if (!hasGap && i > start) hasGap = this.hasGapBetweenNodes(path[i - 1], node);
            if (!hasGap) continue;

            const landingIndex = this.findLandingIndex(path, i);
            if (landingIndex === -1) continue;
            const landingNode = path[landingIndex];

            const jumpDistance = this.getHorizontalDistance(node.x + 0.5, node.z + 0.5, landingNode.x + 0.5, landingNode.z + 0.5);
            if (jumpDistance < this.MIN_GAP_WIDTH || jumpDistance > this.MAX_GAP_SEARCH + 0.5) continue;

            const distanceToEdge = this.getHorizontalDistance(playerX, playerZ, node.x + 0.5, node.z + 0.5);
            if (distanceToEdge > this.EDGE_JUMP_DISTANCE) continue;

            const targetYaw = this.getYawTo(playerX, playerZ, landingNode.x + 0.5, landingNode.z + 0.5);
            if (!this.isYawAligned(playerYaw, targetYaw, 35)) continue;

            if (Math.abs(landingNode.y - baseY) > 0.6) continue;
            if (!this.isSafeLanding(landingNode, baseY)) continue;
            if (!this.hasClearJumpArc(node, landingNode, baseY)) continue;

            if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder('Edge jump detected');
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
        if (this.checkSnowJump(lookahead)) return;
        if (this.checkEdgeJump(path, closestIndex)) return;
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
