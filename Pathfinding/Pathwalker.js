import request from 'requestV2';
import RendererMain from '../Rendering/RendererMain';
import { Links } from '../Utility/Constants';
import { Rotations } from '../Utility/Rotations';
import { RayTrace } from '../Utility/Raytrace';
import './Connection';

const Color = java.awt.Color;
const mc = Client.getMinecraft();
const localhost = `${Links.PATHFINDER_API_URL}`;

const NODE_REACH_DISTANCE = 4.5;
const NODE_PASS_DISTANCE = 2.0; // If closer than this, force advance even without visibility
const LOOK_AHEAD_DISTANCE = 3.0;
const ROTATION_SMOOTHING = 0.025;
const FINAL_NODE_THRESHOLD = 3.5;
const EYE_HEIGHT = 1.62;
const DEBUG_MODE = true;
const TARGET_STABILITY_THRESHOLD = 0.5;
const TARGET_STABILITY_FRAMES = 3;
const MAX_ROTATION_SPEED = 20;
const VISIBILITY_LOOKAHEAD = 8.0; // Check visibility up to this distance for next node

let pathNodes = [];
let keyNodes = [];
let movementTickRegister = null;
let movementRenderRegister = null;

let movementState = {
    isWalking: false,
    splinePath: [],
    currentNodeIndex: 0,
    targetPoint: null,
    lastPosition: null,
    stuckTimer: 0,
    isFalling: false,
    lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
};

const getDistance3D = (p1, p2) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
const getDistance2D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.z - p2.z);

function adjustSplineToEyeLevel(splinePath) {
    return splinePath.map((node) => ({
        x: node.x,
        y: node.y - (2 - EYE_HEIGHT), // move from foot level to eye level
        z: node.z,
    }));
}

function canSeePoint(point, eyePos) {
    if (!eyePos) {
        const player = Player.getPlayer();
        if (!player) return false;
        const pos = player.getEyePos();
        if (!pos) return false;
        eyePos = { x: pos.x, y: pos.y, z: pos.z };
    }

    const dx = point.x - eyePos.x;
    const dy = point.y - eyePos.y;
    const dz = point.z - eyePos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Don't check visibility for far points, just go straight (bandaid fix lmfaoooo but it works so well i cant hate)
    if (distance > VISIBILITY_LOOKAHEAD) {
        if (DEBUG_MODE) {
            ChatLib.chat(
                `§7Point too far to check visibility: ${distance.toFixed(
                    2
                )} blocks`
            );
        }
        return false;
    }

    const blocksInPath = RayTrace.rayTraceBetweenPoints(
        [eyePos.x, eyePos.y, eyePos.z],
        [point.x, point.y, point.z]
    );

    for (const blockData of blocksInPath) {
        const [x, y, z] = blockData;
        const block = World.getBlockAt(
            Math.floor(x),
            Math.floor(y),
            Math.floor(z)
        );

        // Skip the block we're standing in/on
        const playerX = Math.floor(Player.getX());
        const playerY = Math.floor(Player.getY());
        const playerZ = Math.floor(Player.getZ());

        if (
            Math.floor(x) === playerX &&
            Math.floor(y) === playerY &&
            Math.floor(z) === playerZ
        ) {
            continue;
        }
        if (
            Math.floor(x) === playerX &&
            Math.floor(y) === playerY - 1 &&
            Math.floor(z) === playerZ
        ) {
            continue;
        }

        if (block && block.type.getID() !== 0) {
            if (DEBUG_MODE) {
                ChatLib.chat(
                    `§cBlocked by block at ${Math.floor(x)}, ${Math.floor(
                        y
                    )}, ${Math.floor(z)} - ID: ${block.type.getID()}`
                );
            }
            return false;
        }
    }

    return true;
}

function updateCurrentNode() {
    const player = Player.getPlayer();
    if (!player) return;

    const eyePos = player.getEyePos();
    if (!eyePos) return;

    const eyePosObj = { x: eyePos.x, y: eyePos.y, z: eyePos.z };
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    // Check if we can advance to the next node
    while (
        movementState.currentNodeIndex <
        movementState.splinePath.length - 1
    ) {
        const currentNode =
            movementState.splinePath[movementState.currentNodeIndex];
        const nextNode =
            movementState.splinePath[movementState.currentNodeIndex + 1];

        const distToCurrent = getDistance3D(eyePosObj, currentNode);
        const distToCurrentPlayer = getDistance3D(playerPos, currentNode);

        if (DEBUG_MODE) {
            ChatLib.chat(
                `§eNode ${
                    movementState.currentNodeIndex
                }: eye_dist=${distToCurrent.toFixed(
                    2
                )}, player_dist=${distToCurrentPlayer.toFixed(2)}`
            );
        }

        // If we're very close to current node, advance regardless of visibility
        if (distToCurrentPlayer < NODE_PASS_DISTANCE) {
            movementState.currentNodeIndex++;
            if (DEBUG_MODE) {
                ChatLib.chat(
                    `§aForce advancing (very close): node ${movementState.currentNodeIndex}`
                );
            }
            continue;
        }

        // Normal advancing node: close enough AND next is visible
        if (distToCurrent < NODE_REACH_DISTANCE) {
            const distToNext = getDistance3D(eyePosObj, nextNode);

            // Only check visibility if next node is within range
            // If too far away, get closer before checking
            if (distToNext <= VISIBILITY_LOOKAHEAD) {
                const nextVisible = canSeePoint(nextNode, eyePosObj);

                if (DEBUG_MODE) {
                    ChatLib.chat(
                        `§eReached node ${
                            movementState.currentNodeIndex
                        }, next dist: ${distToNext.toFixed(
                            2
                        )}, visible: ${nextVisible}`
                    );
                }

                if (nextVisible) {
                    movementState.currentNodeIndex++;
                    if (DEBUG_MODE) {
                        ChatLib.chat(
                            `§aAdvancing to node ${movementState.currentNodeIndex}`
                        );
                    }
                } else {
                    if (DEBUG_MODE) {
                        ChatLib.chat(
                            `§6Staying at node ${movementState.currentNodeIndex} - next not visible yet`
                        );
                    }
                    break;
                }
            } else {
                // Next node is too far to check visibility, just advance
                // it will check visibility when closer
                movementState.currentNodeIndex++;
                if (DEBUG_MODE) {
                    ChatLib.chat(
                        `§bAdvancing (next too far to check): node ${movementState.currentNodeIndex}`
                    );
                }
            }
        } else {
            break;
        }
    }

    // Try to skip ahead if we can see further nodes
    const MAX_SEARCH_AHEAD = 10;
    const endIndex = Math.min(
        movementState.currentNodeIndex + MAX_SEARCH_AHEAD,
        movementState.splinePath.length
    );

    for (let i = movementState.currentNodeIndex + 1; i < endIndex; i++) {
        const point = movementState.splinePath[i];
        const distToPoint = getDistance3D(eyePosObj, point);

        // Only try to skip ahead to nodes that are close enough
        if (
            distToPoint < NODE_REACH_DISTANCE * 1.5 &&
            distToPoint <= VISIBILITY_LOOKAHEAD
        ) {
            const visible = canSeePoint(point, eyePosObj);

            if (visible) {
                if (DEBUG_MODE) {
                    ChatLib.chat(
                        `§bSkipping ahead to node ${i} (was at ${movementState.currentNodeIndex})`
                    );
                }
                movementState.currentNodeIndex = i;
                break;
            }
        }
    }
}

function calculateLookaheadTarget() {
    if (!movementState.splinePath?.length) return null;

    const player = Player.getPlayer();
    if (!player) return null;

    const eyePos = player.getEyePos();
    if (!eyePos) return null;

    const eyePosObj = { x: eyePos.x, y: eyePos.y, z: eyePos.z };

    const lastNode =
        movementState.splinePath[movementState.splinePath.length - 1];

    if (movementState.currentNodeIndex >= movementState.splinePath.length - 1) {
        return lastNode;
    }

    const currentNode =
        movementState.splinePath[movementState.currentNodeIndex];

    // Always start by targeting the current node
    let targetPoint = currentNode;
    let accumulatedDist = 0;

    // Try to look ahead along visible path
    for (
        let i = movementState.currentNodeIndex;
        i < movementState.splinePath.length - 1;
        i++
    ) {
        const p1 = movementState.splinePath[i];
        const p2 = movementState.splinePath[i + 1];

        // Check if p2 is visible before considering it
        if (!canSeePoint(p2, eyePosObj)) {
            // Can't see this point, stop here
            if (DEBUG_MODE && i > movementState.currentNodeIndex) {
                ChatLib.chat(
                    `§6Lookahead stopped at node ${i} - next not visible`
                );
            }
            break;
        }

        const segmentDist = getDistance3D(p1, p2);

        if (accumulatedDist + segmentDist >= LOOK_AHEAD_DISTANCE) {
            const t = (LOOK_AHEAD_DISTANCE - accumulatedDist) / segmentDist;
            targetPoint = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t,
            };
            break;
        }

        accumulatedDist += segmentDist;
        targetPoint = p2; // Update target to last visible point
    }

    return targetPoint;
}

function updatePathFollow() {
    if (!movementState.splinePath?.length) {
        stopPathing();
        return;
    }

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    const lastNode =
        movementState.splinePath[movementState.splinePath.length - 1];

    if (getDistance3D(playerPos, lastNode) < FINAL_NODE_THRESHOLD) {
        stopPathing();
        global.showNotification(
            'Path Complete',
            'Destination reached.',
            'SUCCESS',
            2000
        );
        return;
    }

    updateCurrentNode();
    movementState.targetPoint = calculateLookaheadTarget();
}

function updateRotations() {
    if (!movementState.targetPoint) return;

    const player = Player.getPlayer();
    if (!player) return;

    const eyePos = player.getEyePos();
    if (!eyePos) return;

    // check if target has changed SIGNIFCANTLY
    let targetChanged = false;
    if (movementState.lastTargetPoint) {
        const targetDist = getDistance3D(
            movementState.targetPoint,
            movementState.lastTargetPoint
        );
        if (targetDist > TARGET_STABILITY_THRESHOLD) {
            targetChanged = true;
            movementState.targetStableFrames = 0;
        } else {
            movementState.targetStableFrames++;
        }
    }
    movementState.lastTargetPoint = { ...movementState.targetPoint };

    const dx = movementState.targetPoint.x - eyePos.x;
    let dy = movementState.targetPoint.y - eyePos.y;
    const dz = movementState.targetPoint.z - eyePos.z;

    if (movementState.isFalling) dy *= 0.3;

    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    const dist2D = Math.hypot(dx, dz);
    let targetPitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);

    targetPitch += 3;
    targetPitch = Math.max(-35, Math.min(35, targetPitch));

    // calculate yaw difference
    let yawDiff = targetYaw - movementState.lastRotation.yaw;
    while (yawDiff > 180) yawDiff -= 360;
    while (yawDiff < -180) yawDiff += 360;

    const pitchDiff = targetPitch - movementState.lastRotation.pitch;

    // If target just changed and difference is big, limit rotation speed
    let effectiveYawDiff = yawDiff;
    let effectivePitchDiff = pitchDiff;

    if (
        targetChanged &&
        movementState.targetStableFrames < TARGET_STABILITY_FRAMES
    ) {
        // Limit sudden random rotation changes
        const yawMagnitude = Math.abs(yawDiff);
        const pitchMagnitude = Math.abs(pitchDiff);

        if (yawMagnitude > MAX_ROTATION_SPEED) {
            effectiveYawDiff = (yawDiff / yawMagnitude) * MAX_ROTATION_SPEED;
            if (DEBUG_MODE) {
                ChatLib.chat(
                    `§6Limiting yaw rotation: ${yawMagnitude.toFixed(
                        1
                    )}° -> ${MAX_ROTATION_SPEED}°`
                );
            }
        }

        if (pitchMagnitude > MAX_ROTATION_SPEED) {
            effectivePitchDiff =
                (pitchDiff / pitchMagnitude) * MAX_ROTATION_SPEED;
        }
    }

    // apply smoothing AFTER clamping
    const smoothing = player.isSprinting()
        ? ROTATION_SMOOTHING * 1.5
        : ROTATION_SMOOTHING;

    const newYaw =
        movementState.lastRotation.yaw + effectiveYawDiff * smoothing;
    const newPitch =
        movementState.lastRotation.pitch + effectivePitchDiff * smoothing;

    movementState.lastRotation = { yaw: newYaw, pitch: newPitch };
    Rotations.rotateToAngles(newYaw, newPitch);
}

function renderPath() {
    for (let i = 0; i < movementState.splinePath.length; i++) {
        const node = movementState.splinePath[i];
        const isPassed = i < movementState.currentNodeIndex;
        const isCurrent = i === movementState.currentNodeIndex;

        let color;
        if (isCurrent) {
            color = new Color(1.0, 1.0, 0.0, 1.0); // Yellow for current
        } else if (isPassed) {
            color = new Color(0.3, 0.3, 0.3, 0.3); // Gray for passed
        } else {
            color = new Color(0.0, 1.0, 0.0, 0.5); // Green for upcoming
        }

        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            isCurrent,
            color
        );
    }

    // Draw key nodes (red)
    keyNodes.forEach((node) => {
        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            true,
            new Color(1.0, 0.0, 0.0, 0.8)
        );
    });

    // Draw lookahead target (cyan)
    if (movementState.isWalking && movementState.targetPoint) {
        RendererMain.drawWaypoint(
            new Vec3i(
                movementState.targetPoint.x,
                movementState.targetPoint.y,
                movementState.targetPoint.z
            ),
            true,
            new Color(0.0, 1.0, 1.0, 1.0)
        );
    }
}

export function stopPathing() {
    if (movementTickRegister) {
        movementTickRegister.unregister();
        movementTickRegister = null;
    }
    if (movementRenderRegister) {
        movementRenderRegister.unregister();
        movementRenderRegister = null;
    }

    movementState.isWalking = false;

    try {
        mc.options.forwardKey.setPressed(false);
        mc.options.sprintKey.setPressed(false);
        mc.options.jumpKey.setPressed(false);
    } catch (e) {}

    Rotations.stopRotation();
}

function startPathing(rawPath, splinePath) {
    stopPathing();

    if (!splinePath || splinePath.length === 0) return;

    const adjustedSpline = adjustSplineToEyeLevel(splinePath);

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    let closestIndex = 0;
    let minDist = Infinity;
    for (let i = 0; i < adjustedSpline.length; i++) {
        const dist = getDistance3D(playerPos, adjustedSpline[i]);
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }

    Object.assign(movementState, {
        isWalking: true,
        splinePath: adjustedSpline,
        currentNodeIndex: closestIndex,
        lastPosition: playerPos,
        stuckTimer: 0,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
        lastTargetPoint: null,
        targetStableFrames: 0,
    });

    movementTickRegister = register('tick', () => {
        if (!movementState.isWalking) return;

        const currentPos = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
        };
        movementState.isFalling = !Player.getPlayer()?.field_70122_E; // onGround

        // REMOVED STUCK DETECTION FOR NOW, IT DIDN'T DO ANYTHING
        movementState.lastPosition = currentPos;

        updatePathFollow();
        if (movementState.isWalking) {
            mc.options.forwardKey.setPressed(true);
            mc.options.sprintKey.setPressed(!movementState.isFalling);
        }
    });

    movementRenderRegister = register('postRenderWorld', () => {
        if (movementState.isWalking) {
            updateRotations();
        }
        renderPath();
    });
}

function handleRustPathCommand(...args) {
    stopPathing();

    const renderOnly =
        args.length === 7 && args[6]?.toLowerCase() === 'renderonly';

    if (args.length < 6) {
        global.showNotification(
            'Invalid Command',
            'Usage: /rustpath <x1> <y1> <z1> <x2> <y2> <z2> [renderonly]',
            'ERROR',
            5000
        );
        return;
    }

    const coords = args.slice(0, 6).map(Number);
    if (coords.some(isNaN)) {
        global.showNotification(
            'Invalid Coordinates',
            'All coordinates must be valid numbers.',
            'ERROR',
            5000
        );
        return;
    }

    const [x1, y1, z1, x2, y2, z2] = coords;
    const url = `${localhost}/api/pathfinding?start=${x1},${y1},${z1}&end=${x2},${y2},${z2}&map=mines`;

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (!body?.path?.length || !body?.spline?.length) {
                global.showNotification(
                    'Pathfinding Failed',
                    'Invalid response from server.',
                    'ERROR',
                    5000
                );
                return;
            }

            pathNodes = body.path;
            keyNodes = body.keynodes || [];

            if (renderOnly) {
                movementRenderRegister = register(
                    'postRenderWorld',
                    renderPath
                );
                global.showNotification(
                    'Path Rendered',
                    'Movement not initiated.',
                    'INFO',
                    3000
                );
            } else {
                startPathing(body.path, body.spline);
            }
        })
        .catch((err) => {
            global.showNotification(
                'Pathfinding Error',
                'See console for details.',
                'ERROR',
                5000
            );
            console.log(`Pathfinding request failed: ${err}`);
        });
}

function handlePathCommand(...args) {
    stopPathing();

    if (args.length < 3) {
        global.showNotification(
            'Invalid Command',
            'Usage: /path <x> <y> <z>',
            'ERROR',
            5000
        );
        return;
    }

    const coords = args.slice(0, 3).map(Number);
    if (coords.some(isNaN)) {
        global.showNotification(
            'Invalid Coordinates',
            'All coordinates must be valid numbers.',
            'ERROR',
            5000
        );
        return;
    }

    const x1 = Math.floor(Player.getX());
    const y1 = Math.floor(Player.getY()) - 1;
    const z1 = Math.floor(Player.getZ());

    const [x2, y2, z2] = coords;

    const url = `${localhost}/api/pathfinding?start=${x1},${y1},${z1}&end=${x2},${y2},${z2}&map=mines`;

    ChatLib.chat(
        `§aPathfinding from §e${x1}, ${y1}, ${z1}§a to §e${x2}, ${y2}, ${z2}`
    );

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (!body?.path?.length || !body?.spline?.length) {
                global.showNotification(
                    'Pathfinding Failed',
                    'Invalid response from server.',
                    'ERROR',
                    5000
                );
                return;
            }

            pathNodes = body.path;
            keyNodes = body.keynodes || [];

            startPathing(body.path, body.spline);
        })
        .catch((err) => {
            global.showNotification(
                'Pathfinding Error',
                'See console for details.',
                'ERROR',
                5000
            );
            console.log(`Pathfinding request failed: ${err}`);
        });
}

register('command', handleRustPathCommand).setName('rustpath', true);
register('command', handlePathCommand).setName('path', true);
register('command', stopPathing).setName('stop', true);
