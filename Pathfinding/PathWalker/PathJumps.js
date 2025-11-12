import { Vec3d } from '../../Utility/Constants';
import RenderUtils from '../../Rendering/RendererUtils';
import { Keybind } from '../../Utility/Keybinding';
import { Chat } from '../../Utility/Chat';

export let lastLookaheadPositions = [];

// TODO
// Snow :(

const STEP_HEIGHT = 0.6;
const LOOKAHEAD_NODES = 3;

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

function isPlayerInFluid() {
    const playerMP = Player.asPlayerMP();
    if (!playerMP) return false;

    // entity state is less expensive than block check
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

    // Get closest node to player
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

    // Check the lookahead nodes
    for (let i = startIndex; i < endIndex; i++) {
        const nextNode = pathBetweenKeyNodes[i];
        const blockVec = new Vec3d(nextNode.x, nextNode.y, nextNode.z);

        const block = getCachedBlock(blockVec.x, blockVec.y, blockVec.z);
        const blockName = block ? block.type.getRegistryName() : 'minecraft:air';

        const isTraversablePartialBlock = blockName.includes('slab') || blockName.includes('stair');

        if (!isBlockNonCollidable(world, blockVec) || isTraversablePartialBlock) {
            RenderUtils.drawBox(blockVec, [0, 255, 0, 255]);
            lookaheadPositions.push({
                vec: blockVec,
                name: blockName,
                block: block,
            });
        }
    }

    return { lookaheadPositions, closestIndex };
}

export function detectJump(pathBetweenKeyNodes) {
    const player = Player.getPlayer();
    if (!player) {
        lastLookaheadPositions = [];
        Keybind.setKey('space', false);
        return;
    }

    let lastFluidMessage = 0; // i don't want it to spam the message, but it doesn't really matter
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
        return; // don't change anything if mid air
    }

    const { lookaheadPositions, closestIndex } = drawPathAndPlayerLookAhead(pathBetweenKeyNodes);

    if (lookaheadPositions.length === 0 || closestIndex === -1) {
        lastLookaheadPositions = [];
        Keybind.setKey('space', false);
        return;
    }

    const playerFloorY = Math.floor(Player.getY() - 0.001);
    const pX = Math.floor(Player.getX());
    const pZ = Math.floor(Player.getZ());

    if (hasLowCeiling(pX, playerFloorY, pZ, World.getWorld())) {
        Keybind.setKey('space', false);
        lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
        return;
    }

    let needsJump = false;
    let canWalkInstead = false;

    for (const lookaheadData of lookaheadPositions) {
        const heightDifference = lookaheadData.vec.y - playerFloorY;

        if (heightDifference > STEP_HEIGHT) {
            needsJump = true;
        }

        if (lookaheadData.name.includes('slab') || lookaheadData.name.includes('stair')) {
            canWalkInstead = true;
        }
    }

    Keybind.setKey('space', needsJump && !canWalkInstead);
    lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
}
