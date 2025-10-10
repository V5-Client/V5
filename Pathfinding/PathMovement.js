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
const STEP_HEIGHT = 0.6;

const IGNORED_BLOCK_IDS = new Set([
    209, 518, 513, 514, 182, 208, 271, 610, 601, 427, 211, 605, 246, 520, 585,
    514,
]);

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

    if (registryName.includes('slab') && !registryName.includes('double')) {
        return 0.5;
    }

    if (
        registryName.includes('snow_layer') ||
        (registryName.includes('snow') && !registryName.includes('block'))
    ) {
        // snow layers can be 1-8 layers, this will have to be rewritten using metadata!! @qxionr pls do this, im lazy
        return 0.5;
    }

    if (
        registryName.includes('farmland') ||
        registryName.includes('grass_path') ||
        registryName.includes('dirt_path')
    ) {
        return 0.9375;
    }

    if (registryName.includes('carpet')) {
        return 0.0625;
    }

    if (
        registryName.includes('pressure_plate') ||
        registryName.includes('button')
    ) {
        return 0.0625;
    }

    return 1.0;
}

function getGroundHeight(x, y, z) {
    let block = World.getBlockAt(x, y, z);
    if (isSolid(block)) {
        return y + getBlockHeight(block);
    }

    block = World.getBlockAt(x, y - 1, z);
    if (isSolid(block)) {
        return y - 1 + getBlockHeight(block);
    }

    return y;
}

function hasLowCeiling(x, y, z) {
    return (
        isSolid(World.getBlockAt(x, y + 2, z)) ||
        isSolid(World.getBlockAt(x, y + 3, z))
    );
}

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

    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    const useVertical =
        movementState.fallingTicks <= 2 && !movementState.anticipatingFall;
    const distanceFunc = useVertical ? getDistance3D : getDistance2D;

    // normal progression
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
            if (
                distanceFunc(eyePos, nextNode) > VISIBILITY_LOOKAHEAD ||
                canSeePoint(nextNode, eyePos)
            ) {
                movementState.currentNodeIndex++;
                continue;
            }
        }
        break;
    }

    const isOnGround = player.isOnGround();
    const isStable =
        movementState.fallingTicks === 0 && !movementState.jumpTriggered;

    if (isOnGround && isStable) {
        const MAX_SEARCH_AHEAD = 10;
        const endIndex = Math.min(
            movementState.currentNodeIndex + MAX_SEARCH_AHEAD,
            movementState.splinePath.length
        );
        for (let i = movementState.currentNodeIndex + 1; i < endIndex; i++) {
            const point = movementState.splinePath[i];
            if (
                distanceFunc(eyePos, point) < NODE_REACH_DISTANCE * 1.5 &&
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

export function shouldJump() {
    const player = Player.getPlayer();
    if (!player || !player.isOnGround()) return false;

    const { splinePath, currentNodeIndex, lastJumpPos } = movementState;
    if (!splinePath?.length || currentNodeIndex >= splinePath.length - 1)
        return false;

    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    if (lastJumpPos) {
        const distMoved = Math.hypot(
            playerPos.x - lastJumpPos.x,
            playerPos.z - lastJumpPos.z
        );
        if (distMoved < 0.5) return false;
    }

    const pX = Math.floor(playerPos.x);
    const pY = Math.floor(playerPos.y);
    const pZ = Math.floor(playerPos.z);

    if (hasLowCeiling(pX, pY, pZ)) return false;

    const currentGroundHeight = getGroundHeight(pX, pY - 1, pZ);

    const targetNode =
        splinePath[Math.min(currentNodeIndex + 2, splinePath.length - 1)];
    const dx = targetNode.x - playerPos.x;
    const dz = targetNode.z - playerPos.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);

    if (dist2D < 0.1) return false;

    const dirX = dx / dist2D;
    const dirZ = dz / dist2D;

    const checks = [
        { distance: 0.7, type: 'step' },
        { distance: 1.2, type: 'gap' },
    ];

    for (const check of checks) {
        const checkX = Math.floor(playerPos.x + dirX * check.distance);
        const checkY = pY;
        const checkZ = Math.floor(playerPos.z + dirZ * check.distance);

        if (checkX === pX && checkZ === pZ) continue;
        if (hasLowCeiling(checkX, checkY, checkZ)) continue;

        const blockFoot = World.getBlockAt(checkX, checkY, checkZ);
        const blockHead = World.getBlockAt(checkX, checkY + 1, checkZ);
        const blockBelow = World.getBlockAt(checkX, checkY - 1, checkZ);

        const footSolid = isSolid(blockFoot);
        const headSolid = isSolid(blockHead);
        const belowSolid = isSolid(blockBelow);

        let targetGroundHeight;

        if (footSolid && !headSolid) {
            targetGroundHeight = checkY + getBlockHeight(blockFoot);
            const actualHeightDiff = targetGroundHeight - currentGroundHeight;

            if (actualHeightDiff > STEP_HEIGHT) {
                if (DEBUG_MODE) {
                    const footName = blockFoot.type.getRegistryName();
                    Chat.message(
                        `§e[Jump] Step +${actualHeightDiff.toFixed(
                            2
                        )} (${footName})`
                    );
                }
                movementState.lastJumpPos = { x: playerPos.x, z: playerPos.z };
                movementState.jumpType = 'step';
                return true;
            } else {
                if (DEBUG_MODE) {
                    Chat.message(
                        `§7[No Jump] Can step over ${actualHeightDiff.toFixed(
                            2
                        )} blocks`
                    );
                }
            }
        }

        if (!footSolid && !belowSolid && check.type === 'gap') {
            const groundCurrent = World.getBlockAt(pX, pY - 1, pZ);
            if (!isSolid(groundCurrent)) continue;

            let fallDepth = 0;
            let destinationHeight = checkY;

            for (let d = 1; d <= 10; d++) {
                const blockAtDepth = World.getBlockAt(
                    checkX,
                    checkY - d,
                    checkZ
                );
                if (isSolid(blockAtDepth)) {
                    fallDepth = d - 1;
                    destinationHeight =
                        checkY - d + getBlockHeight(blockAtDepth);
                    break;
                }
                fallDepth = d;
            }

            const actualHeightDiff = destinationHeight - currentGroundHeight;

            if (actualHeightDiff > -STEP_HEIGHT) {
                const nextNode =
                    splinePath[
                        Math.min(currentNodeIndex + 1, splinePath.length - 1)
                    ];
                const immediateYDiff = nextNode.y - playerPos.y;

                if (immediateYDiff > STEP_HEIGHT || fallDepth > 2) {
                    if (fallDepth > 2) {
                        movementState.anticipatingFall = true;
                        if (DEBUG_MODE)
                            Chat.message(
                                `§d[Jump] Anticipating ${fallDepth}-block fall`
                            );
                    }

                    if (DEBUG_MODE) {
                        Chat.message(
                            `§e[Jump] Gap, height diff: ${actualHeightDiff.toFixed(
                                2
                            )}, fall=${fallDepth}`
                        );
                    }

                    movementState.lastJumpPos = {
                        x: playerPos.x,
                        z: playerPos.z,
                    };
                    movementState.jumpType = fallDepth > 2 ? 'long_gap' : 'gap';
                    return true;
                }
            } else {
                if (DEBUG_MODE) {
                    Chat.message(
                        `§7[No Jump] Slab drop ${actualHeightDiff.toFixed(
                            2
                        )} blocks`
                    );
                }
            }
        }
    }

    return false;
}

export function detectAndRecoverFromStuck() {
    const { splinePath, currentNodeIndex } = movementState;
    if (!splinePath?.length) return;

    const player = Player.getPlayer();
    if (!player) return;

    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    if (!movementState.lastKnownPosition) {
        movementState.lastKnownPosition = { ...playerPos };
        movementState.lastKnownNodeIndex = currentNodeIndex;
        movementState.ticksWithoutProgress = 0;
        return;
    }

    const distanceMoved = Math.hypot(
        playerPos.x - movementState.lastKnownPosition.x,
        playerPos.y - movementState.lastKnownPosition.y,
        playerPos.z - movementState.lastKnownPosition.z
    );

    const nodeProgressed = currentNodeIndex > movementState.lastKnownNodeIndex;

    if (distanceMoved > 0.1 || nodeProgressed) {
        movementState.lastKnownPosition = { ...playerPos };
        movementState.lastKnownNodeIndex = currentNodeIndex;
        movementState.ticksWithoutProgress = 0;
        return;
    }

    movementState.ticksWithoutProgress++;

    if (movementState.ticksWithoutProgress >= 30) {
        if (DEBUG_MODE) {
            Chat.message(
                `§c[Stuck Detection] No movement for 30 ticks at node ${currentNodeIndex}, trying recovery...`
            );
        }

        const eyePos = player.getEyePos();
        if (!eyePos) return;

        // search for a visible and REACHABLE node
        for (
            let i = currentNodeIndex - 1;
            i >= Math.max(0, currentNodeIndex - 20);
            i--
        ) {
            const node = splinePath[i];
            const dist = getDistance3D(playerPos, node);

            if (dist > 1.0 && dist < 15 && canSeePoint(node, eyePos)) {
                if (DEBUG_MODE) {
                    Chat.message(
                        `§e[Stuck Recovery] Retreating to node ${i} (distance: ${dist.toFixed(
                            2
                        )})`
                    );
                }
                movementState.currentNodeIndex = i;
                movementState.ticksWithoutProgress = 0;
                movementState.lastKnownPosition = { ...playerPos };
                movementState.lastKnownNodeIndex = i;
                return;
            }
        }

        if (movementState.ticksWithoutProgress >= 50) {
            if (DEBUG_MODE) {
                Chat.message(
                    `§4[Stuck Recovery] Still stuck after 50 ticks, finding closest node...`
                );
            }

            let closestIndex = currentNodeIndex;
            let closestDist = Infinity;

            for (
                let i = Math.max(0, currentNodeIndex - 15);
                i < Math.min(splinePath.length, currentNodeIndex + 15);
                i++
            ) {
                const dist = getDistance3D(playerPos, splinePath[i]);
                if (dist < closestDist && dist > 0.5) {
                    closestDist = dist;
                    closestIndex = i;
                }
            }

            if (closestIndex !== currentNodeIndex) {
                if (DEBUG_MODE) {
                    Chat.message(
                        `§c[Stuck Recovery] Jumping to closest node ${closestIndex} (${closestDist.toFixed(
                            2
                        )} blocks away)`
                    );
                }
                movementState.currentNodeIndex = closestIndex;
                movementState.ticksWithoutProgress = 0;
                movementState.lastKnownPosition = { ...playerPos };
                movementState.lastKnownNodeIndex = closestIndex;
            }
        }

        // if completely stuck, just find any visible node ahead. useless but idc. it should probably just recalculate the path tho
        if (movementState.ticksWithoutProgress >= 80) {
            if (DEBUG_MODE) {
                Chat.message(
                    `§4[Stuck Recovery] WTF IS HAPPENING: Stuck for 80 ticks, trying forward skip...`
                );
            }

            for (
                let i = currentNodeIndex + 1;
                i < Math.min(splinePath.length, currentNodeIndex + 30);
                i++
            ) {
                if (canSeePoint(splinePath[i], eyePos)) {
                    if (DEBUG_MODE) {
                        Chat.message(
                            `§6[Stuck Recovery] Skipping to visible node ${i}`
                        );
                    }
                    movementState.currentNodeIndex = i;
                    movementState.ticksWithoutProgress = 0;
                    movementState.lastKnownPosition = { ...playerPos };
                    movementState.lastKnownNodeIndex = i;
                    return;
                }
            }
        }
    }
}
