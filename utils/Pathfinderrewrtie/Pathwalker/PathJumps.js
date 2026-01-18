import { Vec3d, BP, SnowBlock } from '../../Constants';
import { Keybind } from '../../player/Keybinding';
import { Chat } from '../../Chat';
import RenderUtils from '../../render/RendererUtils';

class PathJumps {
    constructor() {
        this.lastLookaheadPositions = [];
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

        register('tick', () => {
            this.cacheFrame++;
            if (this.blockCache.size > 1000) this.blockCache.clear();
        });
    }

    getCachedBlock(x, y, z) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)},${this.cacheFrame}`;
        if (!this.blockCache.has(key)) {
            this.blockCache.set(key, World.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z)));
        }
        return this.blockCache.get(key);
    }

    isBlockNonCollidable(world, blockVec) {
        const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
        const blockState = world.getBlockState(blockPosNMS);
        return blockState.getCollisionShape(world, blockPosNMS).isEmpty();
    }

    isBlockSolid(x, y, z) {
        const block = this.getCachedBlock(x, y, z);
        if (!block || block.type.getID() === 0) return false;
        const world = World.getWorld();
        const blockPosNMS = new BP(x, y, z);
        const blockState = world.getBlockState(blockPosNMS);
        return !blockState.getCollisionShape(world, blockPosNMS).isEmpty();
    }

    hasClearance(x, y, z) {
        const world = World.getWorld();
        for (let offset = 1; offset <= 2; offset++) {
            const bx = Math.floor(x);
            const by = Math.floor(y) + offset;
            const bz = Math.floor(z);
            const blockPosNMS = new BP(bx, by, bz);
            const blockState = world.getBlockState(blockPosNMS);
            if (!blockState.getCollisionShape(world, blockPosNMS).isEmpty()) return false;
        }
        return true;
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
        const blockPosNMS = new BP(blockX, blockY, blockZ);
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
                return Math.sqrt(dx * dx + dz * dz);
            }
        }
        return this.MAX_GAP_SEARCH + 1;
    }

    hasGapBetweenNodes(node1, node2) {
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const dz = node2.z - node1.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
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

        return block.getState().get(SnowBlock.LAYERS) || 0;
    }

    getIntersectedBlocks(p1, p2) {
        let blocks = [];
        let x1 = p1.x,
            y1 = p1.y,
            z1 = p1.z;
        let x2 = p2.x,
            y2 = p2.y,
            z2 = p2.z;

        blocks.push({ x: Math.floor(x1), y: Math.floor(y1), z: Math.floor(z1) });
        blocks.push({ x: Math.floor(x2), y: Math.floor(y2), z: Math.floor(z2) });

        if (Math.floor(x1) !== Math.floor(x2) && Math.floor(z1) !== Math.floor(z2)) {
            blocks.push({ x: Math.floor(x1), y: Math.floor(y1), z: Math.floor(z2) });
            blocks.push({ x: Math.floor(x2), y: Math.floor(y1), z: Math.floor(z1) });
        }

        return blocks;
    }

    drawPathAndPlayerLookAhead(path) {
        if (!Player.getPlayer() || !path || path.length === 0) {
            return { lookahead: [], closestIndex: -1 };
        }

        let closestIndex = -1;
        let minDistanceSq = Infinity;
        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();

        path.forEach((node, index) => {
            const dSq = Math.pow(pX - (node.x + 0.5), 2) + Math.pow(pY - (node.y + 0.5), 2) + Math.pow(pZ - (node.z + 0.5), 2);
            if (dSq < minDistanceSq) {
                minDistanceSq = dSq;
                closestIndex = index;
            }
        });

        if (closestIndex === -1) return { lookahead: [], closestIndex: -1 };
        const lookahead = [];
        const newHighlights = new Set();
        const end = Math.min(closestIndex + this.LOOKAHEAD_NODES, path.length - 1);

        for (let i = closestIndex; i < end; i++) {
            const intersected = this.getIntersectedBlocks(path[i], path[i + 1]);
            intersected.forEach((pos) => {
                const key = `${pos.x},${pos.y},${pos.z}`;
                if (!newHighlights.has(key)) {
                    newHighlights.add(key);
                    const block = this.getCachedBlock(pos.x, pos.y, pos.z);
                    const name = block ? block.type.getRegistryName() : 'minecraft:air';
                    if (!this.isBlockNonCollidable(World.getWorld(), new Vec3d(pos.x, pos.y, pos.z)) || name.includes('slab') || name.includes('stair')) {
                        lookahead.push({ vec: new Vec3d(pos.x, pos.y, pos.z), name, block });
                    }
                }
            });
        }

        return { lookahead, closestIndex };
    }

    checkFluidJump() {
        if (!this.isPlayerInFluid()) return false;

        Keybind.setKey('space', true);
        if (Date.now() - this.lastFluidMessage > 2000) {
            Chat.messagePathfinder('Fluid jump detected');
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
            Chat.messagePathfinder('Snow jump detected');
            Keybind.setKey('space', true);
            return true;
        }
        return false;
    }

    checkEdgeJump(path, closestIndex) {
        if (!Player.getPlayer().isOnGround()) return false;
        const start = closestIndex + 1;
        const end = Math.min(start + this.EDGE_LOOKAHEAD_NODES, path.length);
        for (let i = start; i < end; i++) {
            const node = path[i];
            const block = this.getCachedBlock(node.x, node.y, node.z);
            if (block) {
                const name = block.type.getRegistryName();
                if (name.includes('snow')) return false;
                if (name.includes('slab') || name.includes('stair')) continue;
            }
            let hasGap = this.hasGapAt(node.x, node.y, node.z);
            if (!hasGap && i > start) hasGap = this.hasGapBetweenNodes(path[i - 1], node);
            if (hasGap) {
                const gapWidth = this.calculateGapWidth(node, path, i);
                if (gapWidth >= this.MIN_GAP_WIDTH) {
                    const dx = node.x + 0.5 - Player.getX();
                    const dz = node.z + 0.5 - Player.getZ();
                    if (Math.sqrt(dx * dx + dz * dz) <= this.EDGE_JUMP_DISTANCE) {
                        Chat.messagePathfinder('Edge jump detected');
                        Keybind.setKey('space', true);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkObstacleJump(lookahead) {
        if (lookahead.length === 0) return false;

        const floorY = Math.floor(Player.getY() - 0.001);
        const playerX = Player.getX();
        const playerZ = Player.getZ();

        const currentFeetBlock = this.getCachedBlock(playerX, floorY, playerZ);
        const standingOnStair =
            currentFeetBlock && (currentFeetBlock.type.getRegistryName().includes('stair') || currentFeetBlock.type.getRegistryName().includes('slab'));

        let needsJump = false,
            canWalk = false,
            headBlocked = false;

        for (const data of lookahead) {
            const diff = data.vec.y - floorY;

            const stairClimbLimit = standingOnStair ? 1.05 : this.STEP_HEIGHT;

            if (diff > stairClimbLimit && diff <= 1.5) {
                needsJump = true;
                if (!this.hasClearance(data.vec.x, data.vec.y, data.vec.z)) headBlocked = true;
            }

            if (
                data.name.includes('slab') ||
                (data.name.includes('stair') && this.canWalkUpStairs(playerX, Player.getY(), playerZ, data.vec.x, data.vec.y, data.vec.z))
            ) {
                canWalk = true;
            }
        }

        if (needsJump && !canWalk && !headBlocked) {
            Chat.messagePathfinder('Obstacle jump detected');
            Keybind.setKey('space', true);
            return true;
        }
        return false;
    }

    detectJump(path) {
        if (!Player.getPlayer()) return this.reset();
        if (this.checkFluidJump()) return;
        if (!Player.getPlayer().isOnGround()) return (this.lastLookaheadPositions = []);

        const { lookahead, closestIndex } = this.drawPathAndPlayerLookAhead(path);
        if (closestIndex === -1) return this.reset();

        if (this.checkSnowJump(lookahead)) return;
        //if (this.checkEdgeJump(path, closestIndex)) return;
        if (this.checkObstacleJump(lookahead)) return;

        Keybind.setKey('space', false);
    }

    reset() {
        this.lastLookaheadPositions = [];
        Keybind.setKey('space', false);
    }
}

export const Jump = new PathJumps();
