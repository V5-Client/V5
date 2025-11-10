import { Vec3d } from '../../Utility/Constants';
import RenderUtils from '../../Rendering/RendererUtils';
import { Keybind } from '../../Utility/Keybinding';

export let lastLookaheadPositions = [];

// TODO
// Snow :(

export function isBlockNonCollidable(world, blockVec) {
    const blockPosNMS = new net.minecraft.util.math.BlockPos(blockVec.x, blockVec.y, blockVec.z);
    const blockState = world.getBlockState(blockPosNMS);
    const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
    return collisionShape.isEmpty();
}

export function drawPathAndPlayerLookAhead(pathBetweenKeyNodes) {
    const player = Player;
    const world = World.getWorld();
    if (!player || !pathBetweenKeyNodes || pathBetweenKeyNodes.length === 0) return { lookaheadPositions: [], closestIndex: -1 };

    const lookaheadPositions = [];

    pathBetweenKeyNodes.forEach((element) => {
        RenderUtils.drawBox(new Vec3d(element.x, element.y, element.z), [255, 255, 0, 100]);
    });

    const playerPos = new Vec3d(player.getX(), player.getY(), player.getZ());
    let closestIndex = -1;
    let minDistanceSq = Infinity;

    pathBetweenKeyNodes.forEach((node, index) => {
        const nodePos = new Vec3d(node.x + 0.5, node.y + 0.5, node.z + 0.5);
        const dx = playerPos.x - nodePos.x;
        const dy = playerPos.y - nodePos.y;
        const dz = playerPos.z - nodePos.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestIndex = index;
        }
    });

    if (closestIndex === -1) return { lookaheadPositions: [], closestIndex: -1 };

    const lookaheadColor = [0, 255, 0, 255];
    const nodesToHighlight = 3;
    const startIndex = closestIndex + 1;

    for (let i = 0; i < nodesToHighlight; i++) {
        const nodeIndex = startIndex + i;

        if (nodeIndex >= pathBetweenKeyNodes.length) break;

        const nextNode = pathBetweenKeyNodes[nodeIndex];
        const blockVec = new Vec3d(nextNode.x, nextNode.y, nextNode.z);

        const block = World.getBlockAt(blockVec.x, blockVec.y, blockVec.z);
        const blockName = block ? block?.type?.getRegistryName() : 'minecraft:air';

        const isTraversablePartialBlock = blockName.includes('slab') || blockName.includes('stair');

        if (!isBlockNonCollidable(world, blockVec) || isTraversablePartialBlock) {
            RenderUtils.drawBox(blockVec, lookaheadColor);
            lookaheadPositions.push({ vec: blockVec, name: blockName });
        }
    }

    return { lookaheadPositions, closestIndex };
}

export function detectJump(pathBetweenKeyNodes) {
    const { lookaheadPositions, closestIndex } = drawPathAndPlayerLookAhead(pathBetweenKeyNodes);
    const player = Player;

    if (!player || lookaheadPositions.length === 0 || closestIndex === -1) {
        lastLookaheadPositions = [];
        return;
    }

    const playerFloorY = Math.floor(player.getY() - 0.001);

    let needsJump = false;
    let ignoreJumpThisCycle = false;

    for (const lookaheadData of lookaheadPositions) {
        const blockVec = lookaheadData.vec;
        const blockName = lookaheadData.name;

        if (blockVec.y > playerFloorY + 0.6) needsJump = true;

        if (blockName.includes('slab') || blockName.includes('stair')) {
            if (needsJump) {
                ignoreJumpThisCycle = true;
            }
        }
    }

    if (needsJump && !ignoreJumpThisCycle) {
        Keybind.setKey('space', true);
    } else {
        Keybind.setKey('space', false);
    }

    lastLookaheadPositions = lookaheadPositions.map((data) => data.vec.y);
}
