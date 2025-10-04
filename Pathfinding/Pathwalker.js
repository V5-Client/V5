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
const NODE_PASS_DISTANCE = 2.0;
const LOOK_AHEAD_DISTANCE = 3.0;
const ROTATION_SMOOTHING = 0.035;
const FINAL_NODE_THRESHOLD = 3.5;
const EYE_HEIGHT = 1.62;
const DEBUG_MODE = false;
const TARGET_STABILITY_THRESHOLD = 0.5;
const TARGET_STABILITY_FRAMES = 3;
const MAX_ROTATION_SPEED = 20;
const VISIBILITY_LOOKAHEAD = 12.0;

let pathNodes = [];
let keyNodes = [];
let movementTickRegister = null;
let movementRenderRegister = null;

let movementState = {
    isWalking: false,
    splinePath: [],
    currentNodeIndex: 0,
    targetPoint: null,
    isFalling: false,
    lastRotation: { yaw: 0, pitch: 0 },
    lastTargetPoint: null,
    targetStableFrames: 0,
};

const getDistance3D = (p1, p2) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
const adjustSplineToEyeLevel = (spline) =>
    spline.map((node) => ({ ...node, y: node.y + EYE_HEIGHT - 2 }));

function canSeePoint(point, eyePos = Player.getPlayer()?.getEyePos()) {
    if (!eyePos) return false;

    const distance = getDistance3D(point, eyePos);
    if (distance > VISIBILITY_LOOKAHEAD) {
        if (DEBUG_MODE)
            ChatLib.chat(
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
        if (block && block.type.getID() !== 0) {
            if (DEBUG_MODE)
                ChatLib.chat(
                    `§cBlocked by block at ${x}, ${y}, ${z} - ID: ${block.type.getID()}`
                );
            return true;
        }
        return false;
    });
}

function updateCurrentNode() {
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
                ChatLib.chat(
                    `§bSkipping ahead to node ${i} (was at ${movementState.currentNodeIndex})`
                );
            movementState.currentNodeIndex = i;
            break;
        }
    }
}

function calculateLookaheadTarget() {
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

function updateRotations() {
    if (!movementState.targetPoint) return;
    const eyePos = Player.getPlayer()?.getEyePos();
    if (!eyePos) return;

    const targetChanged =
        movementState.lastTargetPoint &&
        getDistance3D(
            movementState.targetPoint,
            movementState.lastTargetPoint
        ) > TARGET_STABILITY_THRESHOLD;
    movementState.targetStableFrames = targetChanged
        ? 0
        : movementState.targetStableFrames + 1;
    movementState.lastTargetPoint = { ...movementState.targetPoint };

    const dx = movementState.targetPoint.x - eyePos.x;
    const dy =
        (movementState.targetPoint.y - eyePos.y) *
        (movementState.isFalling ? 0.3 : 1);
    const dz = movementState.targetPoint.z - eyePos.z;

    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    let targetPitch = -Math.atan2(dy, Math.hypot(dx, dz)) * (180 / Math.PI) + 3;
    targetPitch = Math.max(-35, Math.min(35, targetPitch));

    let yawDiff =
        ((targetYaw - movementState.lastRotation.yaw + 540) % 360) - 180;
    let pitchDiff = targetPitch - movementState.lastRotation.pitch;

    if (
        targetChanged &&
        movementState.targetStableFrames < TARGET_STABILITY_FRAMES
    ) {
        yawDiff =
            Math.sign(yawDiff) *
            Math.min(Math.abs(yawDiff), MAX_ROTATION_SPEED);
        pitchDiff =
            Math.sign(pitchDiff) *
            Math.min(Math.abs(pitchDiff), MAX_ROTATION_SPEED);
    }

    const smoothing =
        ROTATION_SMOOTHING * (Player.getPlayer().isSprinting() ? 1.5 : 1);
    const newYaw = movementState.lastRotation.yaw + yawDiff * smoothing;
    const newPitch = movementState.lastRotation.pitch + pitchDiff * smoothing;

    movementState.lastRotation = { yaw: newYaw, pitch: newPitch };
    Rotations.rotateToAngles(newYaw, newPitch);
}

function renderPath() {
    movementState.splinePath.forEach((node, i) => {
        const isCurrent = i === movementState.currentNodeIndex;
        const color = isCurrent
            ? new Color(1, 1, 0)
            : i < movementState.currentNodeIndex
            ? new Color(0.3, 0.3, 0.3, 0.3)
            : new Color(0, 1, 0, 0.5);
        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            isCurrent,
            color
        );
    });

    keyNodes.forEach((node) =>
        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            true,
            new Color(1, 0, 0, 0.8)
        )
    );

    if (movementState.isWalking && movementState.targetPoint) {
        RendererMain.drawWaypoint(
            new Vec3i(
                movementState.targetPoint.x,
                movementState.targetPoint.y,
                movementState.targetPoint.z
            ),
            true,
            new Color(0, 1, 1)
        );
    }
}

export function stopPathing() {
    movementTickRegister?.unregister();
    movementRenderRegister?.unregister();
    movementTickRegister = movementRenderRegister = null;
    movementState.isWalking = false;
    try {
        mc.options.forwardKey.setPressed(false);
        mc.options.sprintKey.setPressed(false);
        mc.options.jumpKey.setPressed(false);
    } catch (e) {}
    Rotations.stopRotation();
}

function startPathing(splinePath) {
    stopPathing();
    if (!splinePath?.length) return;

    const adjustedSpline = adjustSplineToEyeLevel(splinePath);
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    const closestIndex = adjustedSpline.reduce(
        (closest, node, i) =>
            getDistance3D(playerPos, node) < closest.dist
                ? { i, dist: getDistance3D(playerPos, node) }
                : closest,
        { i: 0, dist: Infinity }
    ).i;

    Object.assign(movementState, {
        isWalking: true,
        splinePath: adjustedSpline,
        currentNodeIndex: closestIndex,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
        lastTargetPoint: null,
        targetStableFrames: 0,
    });

    movementTickRegister = register('tick', () => {
        if (!movementState.isWalking) return;
        const player = Player.getPlayer();
        if (!player) {
            stopPathing();
            return;
        }

        const playerPos = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
        };
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
        movementState.isFalling = !player.field_70122_E; // onGround
        mc.options.forwardKey.setPressed(true);
        mc.options.sprintKey.setPressed(!movementState.isFalling);
    });

    movementRenderRegister = register('postRenderWorld', () => {
        if (movementState.isWalking) updateRotations();
        renderPath();
    });
}

function findAndFollowPath(start, end, renderOnly = false) {
    stopPathing();
    const url = `${localhost}/api/pathfinding?start=${start.join(
        ','
    )}&end=${end.join(',')}&map=mines`;
    ChatLib.chat(
        `§aPathfinding from §e${start.join(', ')}§a to §e${end.join(', ')}`
    );

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (!body?.path?.length || !body?.spline?.length) {
                return global.showNotification(
                    'Pathfinding Failed',
                    'Invalid response from server.',
                    'ERROR',
                    5000
                );
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
                startPathing(body.spline);
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

function handleCommand(args, isRustPath) {
    const requiredCoords = isRustPath ? 6 : 3;
    const renderOnly =
        isRustPath &&
        args.length === 7 &&
        args[6]?.toLowerCase() === 'renderonly';

    if (args.length < requiredCoords) {
        const usage = isRustPath
            ? '/rustpath <x1> <y1> <z1> <x2> <y2> <z2> [renderonly]'
            : '/path <x> <y> <z>';
        return global.showNotification(
            'Invalid Command',
            `Usage: ${usage}`,
            'ERROR',
            5000
        );
    }

    const coords = args.slice(0, requiredCoords).map(Number);
    if (coords.some(isNaN)) {
        return global.showNotification(
            'Invalid Coordinates',
            'All coordinates must be valid numbers.',
            'ERROR',
            5000
        );
    }

    const start = isRustPath
        ? coords.slice(0, 3)
        : [
              Math.floor(Player.getX()),
              Math.floor(Player.getY()) - 1,
              Math.floor(Player.getZ()),
          ];
    const end = isRustPath ? coords.slice(3, 6) : coords.slice(0, 3);
    findAndFollowPath(start, end, renderOnly);
}

register('command', (...args) => handleCommand(args, true)).setName(
    'rustpath',
    true
);
register('command', (...args) => handleCommand(args, false)).setName(
    'path',
    true
);
register('command', stopPathing).setName('stop', true);
