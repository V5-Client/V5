import { RayTrace } from '../Utility/Raytrace';
import { Chat } from '../Utility/Chat';
import { movementState } from './PathState';

const NODE_REACH_DISTANCE = 4.5;
const NODE_PASS_DISTANCE = 2.0;
const LOOK_AHEAD_DISTANCE = 3.0;
const FINAL_NODE_THRESHOLD = 3.5;
const EYE_HEIGHT = 1.62;
const VISIBILITY_LOOKAHEAD = 12.5;
const DEBUG_MODE = true;

const IGNORED_BLOCK_IDS = new Set([
    209, 518, 513, 514, 182, 208, 271, 610, 601, 427, 211, 605, 246,
]); // I USED /acv FROM RAYTRACEDEBUG TO FIND THESE MOST COMMON ISSUES IN PATH, FEEL FREE TO ADD MORE.

export const getDistance3D = (p1, p2) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);

export const adjustSplineToEyeLevel = (spline) =>
    spline.map((node) => ({ ...node, y: node.y + EYE_HEIGHT - 2 }));

export function canSeePoint(point, eyePos = Player.getPlayer()?.getEyePos()) {
    if (!eyePos) return false;

    const distance = getDistance3D(point, eyePos);
    if (distance > VISIBILITY_LOOKAHEAD) {
        if (DEBUG_MODE)
            Chat.message(
                `§7Point too far to check visibility: ${distance.toFixed(
                    2
                )} blocks`
            );
        return false;
    }

    const pX = Math.floor(Player.getX()),
        pY = Math.floor(Player.getY()),
        pZ = Math.floor(Player.getZ());
    const blocksInPath = RayTrace.rayTraceBetweenPoints(
        [eyePos.x, eyePos.y, eyePos.z],
        [point.x, point.y, point.z]
    );

    return !blocksInPath.some((blockData) => {
        const [x, y, z] = blockData.map(Math.floor);
        if (x === pX && z === pZ && (y === pY || y === pY - 1)) return false;

        const block = World.getBlockAt(x, y, z);
        const blockId = block ? block.type.getID() : 0;
        if (blockId !== 0 && !IGNORED_BLOCK_IDS.has(blockId)) {
            if (DEBUG_MODE)
                Chat.message(
                    `§cBlocked by block at ${x}, ${y}, ${z} - NAME: ${block.type.getRegistryName()} - ID: ${blockId}`
                );
            return true;
        }
        return false;
    });
}

export function updateCurrentNode() {
    const player = Player.getPlayer();
    if (!player) return;
    const eyePos = player.getEyePos();
    if (!eyePos) return;

    while (
        movementState.currentNodeIndex <
        movementState.splinePath.length - 1
    ) {
        const currentNode =
            movementState.splinePath[movementState.currentNodeIndex];
        const nextNode =
            movementState.splinePath[movementState.currentNodeIndex + 1];
        const playerPos = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
        };

        if (getDistance3D(playerPos, currentNode) < NODE_PASS_DISTANCE) {
            movementState.currentNodeIndex++;
            continue;
        }
        if (getDistance3D(eyePos, currentNode) < NODE_REACH_DISTANCE) {
            if (
                getDistance3D(eyePos, nextNode) > VISIBILITY_LOOKAHEAD ||
                canSeePoint(nextNode, eyePos)
            ) {
                movementState.currentNodeIndex++;
                continue;
            }
        }
        break;
    }

    const MAX_SEARCH_AHEAD = 10;
    const endIndex = Math.min(
        movementState.currentNodeIndex + MAX_SEARCH_AHEAD,
        movementState.splinePath.length
    );
    for (let i = movementState.currentNodeIndex + 1; i < endIndex; i++) {
        const point = movementState.splinePath[i];
        if (
            getDistance3D(eyePos, point) < NODE_REACH_DISTANCE * 1.5 &&
            canSeePoint(point, eyePos)
        ) {
            if (DEBUG_MODE)
                Chat.message(
                    `§bSkipping ahead to node ${i} (was at ${movementState.currentNodeIndex})`
                );
            movementState.currentNodeIndex = i;
            break;
        }
    }
}

export function calculateLookaheadTarget() {
    const { splinePath, currentNodeIndex } = movementState;
    if (!splinePath?.length) return null;
    const eyePos = Player.getPlayer()?.getEyePos();
    if (!eyePos) return null;

    if (currentNodeIndex >= splinePath.length - 1)
        return splinePath[splinePath.length - 1];

    let targetPoint = splinePath[currentNodeIndex];
    let accumulatedDist = 0;

    for (let i = currentNodeIndex; i < splinePath.length - 1; i++) {
        const p1 = splinePath[i];
        const p2 = splinePath[i + 1];

        if (!canSeePoint(p2, eyePos)) break;

        const segmentDist = getDistance3D(p1, p2);
        if (accumulatedDist + segmentDist >= LOOK_AHEAD_DISTANCE) {
            const t = (LOOK_AHEAD_DISTANCE - accumulatedDist) / segmentDist;
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t,
            };
        }
        accumulatedDist += segmentDist;
        targetPoint = p2;
    }
    return targetPoint;
}

export function isAtFinalNode() {
    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };
    const lastNode =
        movementState.splinePath[movementState.splinePath.length - 1];
    return getDistance3D(playerPos, lastNode) < FINAL_NODE_THRESHOLD;
}

export function findClosestNodeIndex(splinePath) {
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    return splinePath.reduce(
        (closest, node, i) =>
            getDistance3D(playerPos, node) < closest.dist
                ? { i, dist: getDistance3D(playerPos, node) }
                : closest,
        { i: 0, dist: Infinity }
    ).i;
}
