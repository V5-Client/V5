import { Vec3d } from '../../Utility/Constants';
import RenderUtils from '../../Rendering/RendererUtils';
import { Keybind } from '../../Utility/Keybinding';
import { Chat } from '../../Utility/Chat';
import { PathfindingMessages } from '../PathConfig';
import { isStuckRecoveryJumping } from './PathStuckRecovery';

export let lastLookaheadPositions = [];

// improve EdgeJump

const STEP_HEIGHT = 0.6;
const LOOKAHEAD_NODES = 3;

const EDGE_LOOKAHEAD_NODES = 5;
const EDGE_JUMP_DISTANCE = 1.8; // jump if gap is within n amount of blocks
const GAP_CHECK_RESOLUTION = 0.5; // check for gaps more than just at block center stuff. might be useless tbh
const MIN_GAP_WIDTH = 1.8; // minimum width of gap to actually jump over
const MAX_GAP_SEARCH = 4; // how far to search for the end of a gap

const blockCache = new Map();
let cacheFrame = 0;

register('tick', () => {
    cacheFrame++;
    if (blockCache.size > 1000) blockCache.clear();
});

function getCachedBlock(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)},${cacheFrame}`;
    if (!blockCache.has(key)) {
        blockCache.set(key, World.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z)));
    }
    return blockCache.get(key);
}

export function isBlockNonCollidable(world, blockVec) {
    const blockPosNMS = new net.minecraft.util.math.BlockPos(blockVec.x, blockVec.y, blockVec.z);
    const blockState = world.getBlockState(blockPosNMS);
    const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
    return collisionShape.isEmpty();
}

function isBlockSolid(x, y, z) {
    const block = getCachedBlock(x, y, z);
    if (!block || block.type.getID() === 0) return false;

    const world = World.getWorld();
    const blockPosNMS = new net.minecraft.util.math.BlockPos(x, y, z);
    const blockState = world.getBlockState(blockPosNMS);
    const collisionShape = blockState.getCollisionShape(world, blockPosNMS);

    return !collisionShape.isEmpty();
}

function isPlayerInFluid() {
    const playerMP = Player.asPlayerMP();
    if (!playerMP) return false;

    if (playerMP.isInLava() || playerMP.isInWater()) {
        return true;
    }

    const pX = Math.floor(Player.getX());
    const pY = Math.floor(Player.getY());
    const pZ = Math.floor(Player.getZ());

    const block = getCachedBlock(pX, pY, pZ);
    if (block) {
        const registryName = block.type.getRegistryName().toLowerCase();
        return registryName.includes('water') || registryName.includes('lava');
    }

    return false;
}

function canWalkUpStairs(playerX, playerY, playerZ, blockX, blockY, blockZ) {
    const world = World.getWorld();
    const blockPosNMS = new net.minecraft.util.math.BlockPos(blockX, blockY, blockZ);
    const blockState = world.getBlockState(blockPosNMS);

    try {
        const stateString = blockState.toString();
        const facingMatch = stateString.match(/facing=(\w+)/);

        if (!facingMatch) return true;

        const facingDir = facingMatch[1].toLowerCase();
        const dx = blockX + 0.5 - playerX;
        const dz = blockZ + 0.5 - playerZ;

        let approachDirection;
        if (Math.abs(dx) > Math.abs(dz)) {
            approachDirection = dx > 0 ? 'west' : 'east';
        } else {
            approachDirection = dz > 0 ? 'north' : 'south';
        }

        const walkableDirection = {
            north: 'south',
            south: 'north',
            east: 'west',
            west: 'east',
        }[facingDir];

        return approachDirection === walkableDirection;
    } catch (e) {
        return true;
    }
}

function hasLowCeiling(x, y, z, world) {
    for (let offset = 2; offset <= 3; offset++) {
        const block = getCachedBlock(x, y + offset, z);
        if (!block || block.type.getID() === 0) continue;

        const registryName = block.type.getRegistryName().toLowerCase();
        if (registryName.includes('stair')) continue;

        const blockPosNMS = new net.minecraft.util.math.BlockPos(x, y + offset, z);
        const blockState = world.getBlockState(blockPosNMS);
        const collisionShape = blockState.getCollisionShape(world, blockPosNMS);

        if (!collisionShape.isEmpty()) {
            return true;
        }
    }

    return false;
}

function hasGapAt(x, y, z) {
    const blockX = Math.floor(x);
    const blockY = Math.floor(y);
    const blockZ = Math.floor(z);

    if (!isBlockSolid(blockX, blockY, blockZ)) {
        return true;
    }

    if (!isBlockSolid(blockX, blockY - 1, blockZ)) {
        return true;
    }

    return false;
}

function calculateGapWidth(startNode, pathBetweenKeyNodes, startIndex) {
    const maxSearch = Math.min(startIndex + MAX_GAP_SEARCH, pathBetweenKeyNodes.length);

    for (let i = startIndex; i < maxSearch; i++) {
        const node = pathBetweenKeyNodes[i];

        if (!hasGapAt(node.x, node.y, node.z)) {
            const dx = node.x - startNode.x;
            const dz = node.z - startNode.z;
            return Math.sqrt(dx * dx + dz * dz);
        }
    }

    return MAX_GAP_SEARCH + 1;
}

function hasGapBetweenNodes(node1, node2) {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;

    const distance = Math.sqrt(dx * dx + dz * dz);
    const numChecks = Math.ceil(distance / GAP_CHECK_RESOLUTION);

    if (numChecks === 0) return false;

    for (let i = 0; i <= numChecks; i++) {
        const t = i / numChecks;
        const checkX = node1.x + dx * t;
        const checkY = node1.y + dy * t;
        const checkZ = node1.z + dz * t;

        if (hasGapAt(checkX, checkY, checkZ)) {
            return true;
        }
    }

    return 0;
}

function getSnowLayers(block) {
    if (!block || block.type.getID() === 0) return 0;

    const name = block.type.getRegistryName();
    if (name !== 'minecraft:snow') return 0;

    try {
        const SnowBlock = net.minecraft.block.SnowBlock;
        return block.getState().get(SnowBlock.LAYERS);
    } catch (e) {
        return 0;
    }
}

function detectSnowJump(lookaheadPositions) {
    const player = Player.getPlayer();
    if (!player || lookaheadPositions.length < 2) return false;

    // if you could improve this it would be appreciated
    const data = lookaheadPositions[0];
    const currentFloorY = Player.getY() - 1;

    const block = data.block;
    if (!block || block.type.getRegistryName() !== 'minecraft:snow') {
        return false;
    }

    const layers = getSnowLayers(block);
    if (layers === 0) return false;

    const vecY = data.vec.y;
    const blockSurfaceHeight = vecY - (8 - layers) * 0.125;

    const diff = blockSurfaceHeight - currentFloorY;

    if (diff > 0.75 && layers > 6) {
        Chat.message(`Snow jump TRIGGERED: layers=${layers} height=${blockSurfaceHeight.toFixed(3)} playerFloorY=${currentFloorY} diff=${diff.toFixed(3)}`);
        return true;
    }

    return false;
}

function detectEdgeJump(pathBetweenKeyNodes, closestIndex) {
    const player = Player.getPlayer();
    if (!player || !player.isOnGround()) return false;

    if (closestIndex >= 0 && closestIndex < pathBetweenKeyNodes.length) {
        const startIndex = closestIndex + 1;
        const endIndex = Math.min(startIndex + EDGE_LOOKAHEAD_NODES, pathBetweenKeyNodes.length);

        for (let i = startIndex; i < endIndex; i++) {
            const node = pathBetweenKeyNodes[i];
            const block = getCachedBlock(node.x, node.y, node.z);
            if (block && (block.type.getRegistryName() === 'minecraft:snow' || block.type.getRegistryName() === 'minecraft:snow_block')) return false;
        }
    }

    const playerX = Player.getX();
    //const playerY = Math.floor(Player.getY());
    const playerZ = Player.getZ();

    const startIndex = closestIndex + 1;
    const endIndex = Math.min(startIndex + EDGE_LOOKAHEAD_NODES, pathBetweenKeyNodes.length);

    for (let i = startIndex; i < endIndex; i++) {
        const currentNode = pathBetweenKeyNodes[i];

        let hasGap = hasGapAt(currentNode.x, currentNode.y, currentNode.z);

        if (!hasGap && i > startIndex) {
            const previousNode = pathBetweenKeyNodes[i - 1];
            hasGap = hasGapBetweenNodes(previousNode, currentNode);
        }

        if (hasGap) {
            const gapWidth = calculateGapWidth(currentNode, pathBetweenKeyNodes, i);

            if (gapWidth >= MIN_GAP_WIDTH) {
                const dx = currentNode.x + 0.5 - playerX;
                const dz = currentNode.z + 0.5 - playerZ;
                const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

                if (horizontalDistance <= EDGE_JUMP_DISTANCE) {
                    return true;
                }
            }
        }
    }

    return false;
}

export function drawPathAndPlayerLookAhead(pathBetweenKeyNodes) {
    const player = Player;
    const world = World.getWorld();
    if (!player || !pathBetweenKeyNodes || pathBetweenKeyNodes.length === 0) {
        return { lookaheadPositions: [], closestIndex: -1 };
    }

    const lookaheadPositions = [];
    const playerX = player.getX();
    const playerY = player.getY();
    const playerZ = player.getZ();

    let closestIndex = -1;
    let minDistanceSq = Infinity;

    pathBetweenKeyNodes.forEach((node, index) => {
        const dx = playerX - (node.x + 0.5);
        const dy = playerY - (node.y + 0.5);
        const dz = playerZ - (node.z + 0.5);
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestIndex = index;
        }
    });

    if (closestIndex === -1) return { lookaheadPositions: [], closestIndex: -1 };

    const startIndex = closestIndex + 1;
    const endIndex = Math.min(startIndex + LOOKAHEAD_NODES, pathBetweenKeyNodes.length);

    for (let i = startIndex; i < endIndex; i++) {
        const nextNode = pathBetweenKeyNodes[i];
        const blockVec = new Vec3d(nextNode.x, nextNode.y, nextNode.z);

        const block = getCachedBlock(blockVec.x, blockVec.y, blockVec.z);
        const blockName = block ? block.type.getRegistryName() : 'minecraft:air';

        const isTraversablePartialBlock = blockName.includes('slab') || blockName.includes('stair');

        /*register('postRenderWorld', () => {
            RenderUtils.drawBox(blockVec, [255, 255, 0, 255]);
        });*/

        if (!isBlockNonCollidable(world, blockVec) || isTraversablePartialBlock) {
            lookaheadPositions.push({
                vec: blockVec,
                name: blockName,
                block: block,
            });
        }
    }

    return { lookaheadPositions, closestIndex };
}

let lastFluidMessage = 0;
export function detectJump(pathBetweenKeyNodes) {
    const player = Player.getPlayer();
    if (!player) {
        lastLookaheadPositions = [];
        Keybind.setKey('space', false);
        return;
    }

    if (isStuckRecoveryJumping()) {
        lastLookaheadPositions = [];
        return;
    }

    if (isPlayerInFluid()) {
        Keybind.setKey('space', true);
        if (Date.now() - lastFluidMessage > 2000) {
            Chat.message('In fluid, forcing jump');
            lastFluidMessage = Date.now();
        }
        lastLookaheadPositions = [];
        return;
    }

    if (!player.isOnGround()) {
        lastLookaheadPositions = [];
        return;
    }

    const { lookaheadPositions, closestIndex } = drawPathAndPlayerLookAhead(pathBetweenKeyNodes);

    if (closestIndex === -1) {
        lastLookaheadPositions = [];
        Keybind.setKey('space', false);
        return;
    }

    const playerFloorY = Math.floor(Player.getY() - 0.001);
    const pX = Math.floor(Player.getX());
    const pY = Math.floor(Player.getY());
    const pZ = Math.floor(Player.getZ());

    if (hasLowCeiling(pX, playerFloorY, pZ, World.getWorld())) {
        Keybind.setKey('space', false);
        lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
        return;
    }

    if (detectSnowJump(lookaheadPositions)) {
        PathfindingMessages('Snow jump detected');
        Keybind.setKey('space', true);
        lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
        return;
    }

    const currentBlock = getCachedBlock(pX, pY, pZ);
    if (currentBlock && (currentBlock.type.getRegistryName() === 'minecraft:snow' || currentBlock.type.getRegistryName() === 'minecraft:snow_block')) {
        Keybind.setKey('space', false);
        lastLookaheadPositions = [];
        return;
    }

    if (detectEdgeJump(pathBetweenKeyNodes, closestIndex)) {
        PathfindingMessages('Edge jump detected');
        Keybind.setKey('space', true);
        lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
        return;
    }

    if (lookaheadPositions.length === 0) {
        Keybind.setKey('space', false);
        lastLookaheadPositions = [];
        return;
    }

    let needsJump = false;
    let canWalkInstead = false;

    for (const lookaheadData of lookaheadPositions) {
        if (
            lookaheadData.block &&
            (lookaheadData.block.type.getRegistryName() === 'minecraft:snow' || lookaheadData.block.type.getRegistryName() === 'minecraft:snow_block')
        )
            continue;

        const heightDifference = lookaheadData.vec.y - playerFloorY;

        if (heightDifference > STEP_HEIGHT) {
            needsJump = true;
        }

        if (lookaheadData.name.includes('slab')) {
            canWalkInstead = true;
        } else if (lookaheadData.name.includes('stair')) {
            if (canWalkUpStairs(Player.getX(), Player.getY(), Player.getZ(), lookaheadData.vec.x, lookaheadData.vec.y, lookaheadData.vec.z)) {
                canWalkInstead = true;
            }
        }
    }

    if (needsJump && !canWalkInstead) {
        PathfindingMessages('Standard jump detected');
    }
    Keybind.setKey('space', needsJump && !canWalkInstead);
    lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
}
