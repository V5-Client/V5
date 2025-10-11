import { RayTrace } from '../Utility/Raytrace';
import { Chat } from '../Utility/Chat';
import { movementState } from './PathState';

const NODE_REACH_DISTANCE = 4.5;
const NODE_PASS_DISTANCE = 2.0;
const LOOK_AHEAD_BASE = 3.0;
const LOOK_AHEAD_MAX = 6.0;
const FINAL_NODE_THRESHOLD = 3.5;
const EYE_HEIGHT = 1.62;
const VISIBILITY_LOOKAHEAD = 12.5;
const DEBUG_MODE = true;
const STEP_HEIGHT = 0.6;

const IGNORED_BLOCK_IDS = new Set([
    209, 518, 513, 514, 182, 208, 271, 610, 601, 427, 211, 605, 246, 520, 585,
    514,
]);

const blockCache = new Map();
let cacheFrame = 0;

register('tick', () => {
    cacheFrame++;
    if (blockCache.size > 1000) blockCache.clear();
});

function getCachedBlock(x, y, z) {
    const key = `${x},${y},${z},${cacheFrame}`;
    if (!blockCache.has(key)) {
        blockCache.set(key, World.getBlockAt(x, y, z));
    }
    return blockCache.get(key);
}

export const getDistance3D = (p1, p2) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
export const getDistance2D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.z - p2.z);

export const adjustSplineToEyeLevel = (spline) =>
    spline.map((node) => ({ ...node, y: node.y + EYE_HEIGHT - 2 }));

function isSolid(block) {
    if (!block) return false;
    const id = block.type.getID();
    return id !== 0 && !IGNORED_BLOCK_IDS.has(id);
}

function getBlockHeight(block) {
    if (!block) return 0;
    const id = block.type.getID();
    if (id === 0 || IGNORED_BLOCK_IDS.has(id)) return 0;

    const registryName = block.type.getRegistryName().toLowerCase();

    if (registryName.includes('slab') && !registryName.includes('double'))
        return 0.5;
    if (
        registryName.includes('snow_layer') ||
        (registryName.includes('snow') && !registryName.includes('block'))
    )
        return 0.5;
    if (
        registryName.includes('farmland') ||
        registryName.includes('grass_path') ||
        registryName.includes('dirt_path')
    )
        return 0.9375;
    if (registryName.includes('carpet')) return 0.0625;
    if (
        registryName.includes('pressure_plate') ||
        registryName.includes('button')
    )
        return 0.0625;

    return 1.0;
}

function getGroundHeight(x, y, z) {
    let block = getCachedBlock(x, y, z);
    if (isSolid(block)) return y + getBlockHeight(block);

    block = getCachedBlock(x, y - 1, z);
    if (isSolid(block)) return y - 1 + getBlockHeight(block);

    return y;
}

function hasLowCeiling(x, y, z) {
    return (
        isSolid(getCachedBlock(x, y + 2, z)) ||
        isSolid(getCachedBlock(x, y + 3, z))
    );
}

export function canSeePoint(point, eyePos) {
    const player = Player.getPlayer();
    if (!eyePos && player) eyePos = player.getEyePos();
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

    const pX = Math.floor(Player.getX());
    const pY = Math.floor(Player.getY());
    const pZ = Math.floor(Player.getZ());

    const blocksInPath = RayTrace.rayTraceBetweenPoints(
        [eyePos.x, eyePos.y, eyePos.z],
        [point.x, point.y, point.z]
    );

    return !blocksInPath.some((blockData) => {
        const [x, y, z] = blockData.map(Math.floor);
        if (x === pX && z === pZ && (y === pY || y === pY - 1)) return false;

        const block = getCachedBlock(x, y, z);
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

    if (movementState.recoveryLockTicks > 0) {
        movementState.recoveryLockTicks--;
        if (DEBUG_MODE && movementState.recoveryLockTicks === 0) {
            Chat.message(
                `§a[Recovery] Lock released, resuming normal navigation`
            );
        }
        return;
    }

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    const useVertical =
        movementState.fallingTicks <= 2 && !movementState.anticipatingFall;
    const distanceFunc = useVertical ? getDistance3D : getDistance2D;

    while (
        movementState.currentNodeIndex <
        movementState.splinePath.length - 1
    ) {
        const currentNode =
            movementState.splinePath[movementState.currentNodeIndex];
        const nextNode =
            movementState.splinePath[movementState.currentNodeIndex + 1];

        if (distanceFunc(playerPos, currentNode) < NODE_PASS_DISTANCE) {
            movementState.currentNodeIndex++;
            continue;
        }

        if (distanceFunc(eyePos, currentNode) < NODE_REACH_DISTANCE) {
            const distToNext = distanceFunc(eyePos, nextNode);
            if (
                distToNext < NODE_REACH_DISTANCE ||
                distToNext > VISIBILITY_LOOKAHEAD
            ) {
                if (canSeePoint(nextNode, eyePos)) {
                    movementState.currentNodeIndex++;
                    continue;
                }
            }
        }
        break;
    }

    const isOnGround = player.isOnGround();
    const isStable =
        movementState.fallingTicks === 0 && !movementState.jumpTriggered;

    if (isOnGround && isStable && movementState.ticksWithoutProgress < 10) {
        const MAX_SEARCH_AHEAD = 10;
        const endIndex = Math.min(
            movementState.currentNodeIndex + MAX_SEARCH_AHEAD,
            movementState.splinePath.length
        );

        for (let i = movementState.currentNodeIndex + 1; i < endIndex; i++) {
            const point = movementState.splinePath[i];
            const distToPoint = distanceFunc(eyePos, point);

            if (
                distToPoint < NODE_REACH_DISTANCE &&
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
}

function getPlayerSpeed() {
    const player = Player;
    if (!player) return 0;

    const velX = player.getMotionX();
    const velZ = player.getMotionZ();
    return Math.sqrt(velX * velX + velZ * velZ);
}

export function calculateLookaheadTarget() {
    const { splinePath, currentNodeIndex } = movementState;
    if (!splinePath || !splinePath.length) return null;

    const player = Player.getPlayer();
    const eyePos = player ? player.getEyePos() : null;
    if (!eyePos) return null;

    if (currentNodeIndex >= splinePath.length - 1)
        return splinePath[splinePath.length - 1];

    const speed = getPlayerSpeed();
    const dynamicLookahead = Math.min(
        LOOK_AHEAD_BASE + speed * 2,
        LOOK_AHEAD_MAX
    );

    let targetPoint = splinePath[currentNodeIndex];
    let accumulatedDist = 0;

    for (let i = currentNodeIndex; i < splinePath.length - 1; i++) {
        const p1 = splinePath[i];
        const p2 = splinePath[i + 1];

        if (!canSeePoint(p2, eyePos)) break;

        const segmentDist = getDistance3D(p1, p2);
        if (accumulatedDist + segmentDist >= dynamicLookahead) {
            const t = (dynamicLookahead - accumulatedDist) / segmentDist;
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
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
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

function canAttemptJump(player) {
    if (!player || !player.isOnGround()) return false;

    const { splinePath, currentNodeIndex, lastJumpPos, ticksSinceLanding } =
        movementState;
    if (
        !splinePath ||
        !splinePath.length ||
        currentNodeIndex >= splinePath.length - 1
    )
        return false;

    if (lastJumpPos) {
        const playerPos = { x: Player.getX(), z: Player.getZ() };
        if (
            Math.hypot(
                playerPos.x - lastJumpPos.x,
                playerPos.z - lastJumpPos.z
            ) < 0.5
        )
            return false;
    }

    return (
        !movementState.jumpTriggered &&
        (ticksSinceLanding === null || ticksSinceLanding >= 2)
    );
}

function getDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);
    return dist2D < 0.1
        ? { dirX: 0, dirZ: 0 }
        : { dirX: dx / dist2D, dirZ: dz / dist2D };
}

function evaluateStepJump(
    checkX,
    checkY,
    checkZ,
    currentGroundHeight,
    playerPos
) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    if (!isSolid(blockFoot)) return false;

    const blockHead = getCachedBlock(checkX, checkY + 1, checkZ);
    if (isSolid(blockHead)) return false;

    const targetGroundHeight = checkY + getBlockHeight(blockFoot);
    const actualHeightDiff = targetGroundHeight - currentGroundHeight;

    if (actualHeightDiff > STEP_HEIGHT) {
        if (DEBUG_MODE) {
            const footName = blockFoot.type.getRegistryName();
            Chat.message(
                `§e[Jump] Step +${actualHeightDiff.toFixed(2)} (${footName})`
            );
        }
        movementState.lastJumpPos = { x: playerPos.x, z: playerPos.z };
        movementState.jumpType = 'step';
        return true;
    }

    if (DEBUG_MODE)
        Chat.message(
            `§7[No Jump] Can step over ${actualHeightDiff.toFixed(2)} blocks`
        );
    return false;
}

function evaluateGapJump(
    checkX,
    checkY,
    checkZ,
    pX,
    pY,
    pZ,
    currentGroundHeight,
    playerPos,
    splinePath,
    currentNodeIndex
) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    const blockBelow = getCachedBlock(checkX, checkY - 1, checkZ);

    if (isSolid(blockFoot) || isSolid(blockBelow)) return false;

    const groundCurrent = getCachedBlock(pX, pY - 1, pZ);
    if (!isSolid(groundCurrent)) return false;

    let fallDepth = 0;
    let destinationHeight = checkY;

    for (let d = 1; d <= 10; d++) {
        const blockAtDepth = getCachedBlock(checkX, checkY - d, checkZ);
        if (isSolid(blockAtDepth)) {
            fallDepth = d - 1;
            destinationHeight = checkY - d + getBlockHeight(blockAtDepth);
            break;
        }
        fallDepth = d;
    }

    const actualHeightDiff = destinationHeight - currentGroundHeight;

    if (actualHeightDiff > -STEP_HEIGHT) {
        const nextNode =
            splinePath[Math.min(currentNodeIndex + 1, splinePath.length - 1)];
        const immediateYDiff = nextNode.y - playerPos.y;

        if (immediateYDiff > STEP_HEIGHT || fallDepth > 2) {
            if (fallDepth > 2) {
                movementState.anticipatingFall = true;
                if (DEBUG_MODE)
                    Chat.message(
                        `§d[Jump] Anticipating ${fallDepth}-block fall`
                    );
            }

            if (DEBUG_MODE)
                Chat.message(
                    `§e[Jump] Gap, height diff: ${actualHeightDiff.toFixed(
                        2
                    )}, fall=${fallDepth}`
                );

            movementState.lastJumpPos = { x: playerPos.x, z: playerPos.z };
            movementState.jumpType = fallDepth > 2 ? 'long_gap' : 'gap';
            return true;
        }
    } else {
        if (DEBUG_MODE)
            Chat.message(
                `§7[No Jump] Slab drop ${actualHeightDiff.toFixed(2)} blocks`
            );
    }

    return false;
}

export function shouldJump() {
    const player = Player.getPlayer();
    if (!canAttemptJump(player)) return false;

    const { splinePath, currentNodeIndex } = movementState;
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    const pX = Math.floor(playerPos.x);
    const pY = Math.floor(playerPos.y);
    const pZ = Math.floor(playerPos.z);

    if (hasLowCeiling(pX, pY, pZ)) return false;

    const currentGroundHeight = getGroundHeight(pX, pY - 1, pZ);
    const targetNode =
        splinePath[Math.min(currentNodeIndex + 2, splinePath.length - 1)];
    const { dirX, dirZ } = getDirection(playerPos, targetNode);

    if (dirX === 0 && dirZ === 0) return false;

    const stepCheckX = Math.floor(playerPos.x + dirX * 0.7);
    const stepCheckZ = Math.floor(playerPos.z + dirZ * 0.7);

    if (
        (stepCheckX !== pX || stepCheckZ !== pZ) &&
        !hasLowCeiling(stepCheckX, pY, stepCheckZ)
    ) {
        if (
            evaluateStepJump(
                stepCheckX,
                pY,
                stepCheckZ,
                currentGroundHeight,
                playerPos
            )
        )
            return true;
    }

    const gapCheckX = Math.floor(playerPos.x + dirX * 1.2);
    const gapCheckZ = Math.floor(playerPos.z + dirZ * 1.2);

    if (
        (gapCheckX !== pX || gapCheckZ !== pZ) &&
        !hasLowCeiling(gapCheckX, pY, gapCheckZ)
    ) {
        if (
            evaluateGapJump(
                gapCheckX,
                pY,
                gapCheckZ,
                pX,
                pY,
                pZ,
                currentGroundHeight,
                playerPos,
                splinePath,
                currentNodeIndex
            )
        ) {
            return true;
        }
    }

    return false;
}

export function detectAndRecoverFromStuck() {
    const { splinePath, currentNodeIndex } = movementState;
    if (!splinePath || !splinePath.length) return;

    const player = Player.getPlayer();
    if (!player) return;

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    if (!movementState.lastKnownPosition) {
        movementState.lastKnownPosition = { ...playerPos };
        movementState.lastKnownNodeIndex = currentNodeIndex;
        movementState.ticksWithoutProgress = 0;
        movementState.recoveryAttempts = 0;
        movementState.hasRequestedRecalc = false;
        return;
    }

    const distanceMoved = Math.hypot(
        playerPos.x - movementState.lastKnownPosition.x,
        playerPos.y - movementState.lastKnownPosition.y,
        playerPos.z - movementState.lastKnownPosition.z
    );

    if (distanceMoved > 0.15) {
        movementState.lastKnownPosition = { ...playerPos };
        movementState.lastKnownNodeIndex = currentNodeIndex;
        movementState.ticksWithoutProgress = 0;
        movementState.recoveryAttempts = 0;
        movementState.hasRequestedRecalc = false;
        return;
    }

    movementState.ticksWithoutProgress++;

    if (!movementState.recoveryAttempts) movementState.recoveryAttempts = 0;

    if (movementState.recoveryAttempts >= 3) {
        if (
            movementState.ticksWithoutProgress >= 100 &&
            !movementState.hasRequestedRecalc
        ) {
            movementState.hasRequestedRecalc = true;
            Chat.message(
                `§4[Stuck] Completely stuck for 100 ticks, requesting new path...`
            );

            if (global.pathEngineRecalculate) {
                global.pathEngineRecalculate();
            } else {
                Chat.message(
                    `§c[Stuck] ERROR: Path recalculation not available!`
                );
            }
        }
        return;
    }

    const recoveryThresholds = [15, 35, 55]; // ticks
    const shouldAttemptRecovery =
        recoveryThresholds[movementState.recoveryAttempts] ===
        movementState.ticksWithoutProgress;

    if (!shouldAttemptRecovery) return;

    movementState.recoveryAttempts++;
    if (DEBUG_MODE)
        Chat.message(
            `§c[Stuck Detection] Recovery attempt ${movementState.recoveryAttempts}/3 at node ${currentNodeIndex}`
        );

    const eyePos = player.getEyePos();
    if (!eyePos) return;

    // retreating to a visible previous node that's BEHIND
    const playerYaw = Player.getYaw();
    for (
        let i = currentNodeIndex - 1;
        i >= Math.max(0, currentNodeIndex - 20);
        i--
    ) {
        const node = splinePath[i];
        const dist = getDistance3D(playerPos, node);

        if (dist > 1.5 && dist < 10 && canSeePoint(node, eyePos)) {
            const dx = node.x - playerPos.x;
            const dz = node.z - playerPos.z;
            const angleToNode = Math.atan2(-dx, dz) * (180 / Math.PI);
            const angleDiff = Math.abs(
                ((angleToNode - playerYaw + 540) % 360) - 180
            );

            if (angleDiff > 60) {
                if (DEBUG_MODE)
                    Chat.message(
                        `§e[Stuck Recovery] Retreating to node ${i} (distance: ${dist.toFixed(
                            2
                        )})`
                    );
                movementState.currentNodeIndex = i;
                movementState.lastKnownNodeIndex = i;
                movementState.recoveryLockTicks = 20;
                return;
            }
        }
    }

    // finding the absolute closest node that's not too far
    let closestIndex = currentNodeIndex;
    let closestDist = Infinity;

    for (
        let i = Math.max(0, currentNodeIndex - 10);
        i < Math.min(splinePath.length, currentNodeIndex + 10);
        i++
    ) {
        const dist = getDistance3D(playerPos, splinePath[i]);
        if (dist < closestDist && dist > 0.8 && dist < 15) {
            closestDist = dist;
            closestIndex = i;
        }
    }

    if (
        closestIndex !== currentNodeIndex &&
        Math.abs(closestIndex - currentNodeIndex) > 2
    ) {
        if (DEBUG_MODE)
            Chat.message(
                `§c[Stuck Recovery] Jumping to closest node ${closestIndex} (${closestDist.toFixed(
                    2
                )} blocks away)`
            );
        movementState.currentNodeIndex = closestIndex;
        movementState.lastKnownNodeIndex = closestIndex;
        movementState.recoveryLockTicks = 20;
        return;
    }

    // small skip forward if stuck looking at a wall
    for (
        let i = currentNodeIndex + 3;
        i < Math.min(splinePath.length, currentNodeIndex + 15);
        i++
    ) {
        const node = splinePath[i];
        const dist = getDistance3D(playerPos, node);
        if (dist < 8 && canSeePoint(node, eyePos)) {
            if (DEBUG_MODE)
                Chat.message(
                    `§6[Stuck Recovery] Skipping to visible node ${i}`
                );
            movementState.currentNodeIndex = i;
            movementState.lastKnownNodeIndex = i;
            movementState.recoveryLockTicks = 20;
            return;
        }
    }

    if (DEBUG_MODE)
        Chat.message(`§c[Stuck Recovery] No valid recovery nodes found`);
}
