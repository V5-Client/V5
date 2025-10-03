import request from 'requestV2';
import RendererMain from '../Rendering/RendererMain';
import { Links } from '../Utility/Constants';
import { Rotations } from '../Utility/Rotations';
import './Connection';

const Color = java.awt.Color;
const mc = Client.getMinecraft();
const localhost = `${Links.PATHFINDER_API_URL}`;

const STUCK_THRESHOLD = 60;
const NODE_REACH_DISTANCE = 3.0;
const NODE_REACH_DISTANCE_SPRINT = 4.5;
const LOOK_AHEAD_DISTANCE = 0.1;
const ROTATION_SMOOTHING = 0.15;

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

function findClosestPointIndex(playerPos, path) {
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < path.length; i++) {
        const distance = getDistance3D(playerPos, path[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }
    return closestIndex;
}

function updatePathFollow() {
    if (!movementState.splinePath?.length) {
        stopPathing();
        return;
    }

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    const isSprinting = Player.getPlayer()?.isSprinting();

    if (movementState.currentNodeIndex >= movementState.splinePath.length - 1) {
        if (
            getDistance3D(
                playerPos,
                movementState.splinePath[movementState.splinePath.length - 1]
            ) < NODE_REACH_DISTANCE
        ) {
            stopPathing();
            return;
        }
    }

    const reachDistance = isSprinting
        ? NODE_REACH_DISTANCE_SPRINT
        : NODE_REACH_DISTANCE;
    while (
        movementState.currentNodeIndex <
        movementState.splinePath.length - 1
    ) {
        const currentNode =
            movementState.splinePath[movementState.currentNodeIndex];
        const nextNode =
            movementState.splinePath[movementState.currentNodeIndex + 1];

        const distToNode = movementState.isFalling
            ? getDistance2D(playerPos, currentNode)
            : getDistance3D(playerPos, currentNode);

        if (
            distToNode < reachDistance ||
            getDistance3D(playerPos, nextNode) <
                getDistance3D(currentNode, nextNode)
        ) {
            movementState.currentNodeIndex++;
        } else {
            break;
        }
    }

    let accumulatedDist = 0;
    movementState.targetPoint =
        movementState.splinePath[movementState.splinePath.length - 1];

    for (
        let i = movementState.currentNodeIndex;
        i < movementState.splinePath.length - 1;
        i++
    ) {
        const p1 = movementState.splinePath[i];
        const p2 = movementState.splinePath[i + 1];
        const segmentDist = getDistance3D(p1, p2);

        if (accumulatedDist + segmentDist >= LOOK_AHEAD_DISTANCE) {
            const t = (LOOK_AHEAD_DISTANCE - accumulatedDist) / segmentDist;
            movementState.targetPoint = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t,
            };
            break;
        }
        accumulatedDist += segmentDist;
    }
}

function updateRotations() {
    if (!movementState.targetPoint) return;

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    const dx = movementState.targetPoint.x - playerPos.x;
    let dy = movementState.targetPoint.y - playerPos.y;
    const dz = movementState.targetPoint.z - playerPos.z;

    if (movementState.isFalling) dy *= 0.3;

    const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    const dist2D = Math.hypot(dx, dz);
    let pitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);

    pitch += 7; // look 7 degrees down because humans do that

    pitch = Math.max(-30, Math.min(30, pitch));

    let yawDiff = yaw - movementState.lastRotation.yaw;
    while (yawDiff > 180) yawDiff -= 360;
    while (yawDiff < -180) yawDiff += 360;

    const smoothing = Player.getPlayer()?.isSprinting()
        ? ROTATION_SMOOTHING * 1.5
        : ROTATION_SMOOTHING;
    const newYaw = movementState.lastRotation.yaw + yawDiff * smoothing;
    const newPitch =
        movementState.lastRotation.pitch +
        (pitch - movementState.lastRotation.pitch) * smoothing;

    movementState.lastRotation = { yaw: newYaw, pitch: newPitch };
    Rotations.rotateToAngles(newYaw, newPitch);
}

function renderPath() {
    // Draw raw path nodes (color changes if visited)
    for (let i = 0; i < pathNodes.length; i++) {
        const node = pathNodes[i];
        const isVisited =
            (movementState.rawToSpline?.[i] ?? 0) <
            movementState.currentNodeIndex;
        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            false,
            isVisited
                ? new Color(0.5, 0.5, 0.5, 0.3)
                : new Color(0.0, 1.0, 0.0, 0.8)
        );
    }
    // Draw key nodes (red)
    keyNodes.forEach((node) => {
        RendererMain.drawWaypoint(
            new Vec3i(node.x, node.y, node.z),
            true,
            new Color(1.0, 0.0, 0.0, 1.0)
        );
    });
    // Draw current target node (yellow)
    if (
        movementState.isWalking &&
        movementState.currentNodeIndex < movementState.splinePath.length
    ) {
        const target = movementState.splinePath[movementState.currentNodeIndex];
        RendererMain.drawWaypoint(
            new Vec3i(target.x, target.y, target.z),
            true,
            new Color(1.0, 1.0, 0.0, 1.0)
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

    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    Object.assign(movementState, {
        isWalking: true,
        splinePath: splinePath,
        currentNodeIndex: findClosestPointIndex(playerPos, splinePath),
        lastPosition: playerPos,
        stuckTimer: 0,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
        rawToSpline: rawPath.map((node) =>
            findClosestPointIndex(node, splinePath)
        ),
    });

    // Register tick event for movement
    movementTickRegister = register('tick', () => {
        if (!movementState.isWalking) return;

        const currentPos = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
        };
        movementState.isFalling = !Player.getPlayer()?.field_70122_E; // onGround

        // Stuck detection
        if (
            Math.floor(currentPos.x) ===
                Math.floor(movementState.lastPosition.x) &&
            Math.floor(currentPos.y) ===
                Math.floor(movementState.lastPosition.y) &&
            Math.floor(currentPos.z) ===
                Math.floor(movementState.lastPosition.z) &&
            !movementState.isFalling
        ) {
            if (++movementState.stuckTimer >= STUCK_THRESHOLD) {
                global.showNotification(
                    'Stuck Detected',
                    'Trying to jump.',
                    'WARNING',
                    3000
                );
                mc.options.jumpKey.setPressed(true);
                Client.scheduleTask(5, () =>
                    mc.options.jumpKey.setPressed(false)
                );
                movementState.stuckTimer = 0;
            }
        } else {
            movementState.stuckTimer = 0;
        }
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

register('command', handleRustPathCommand).setName('rustpath', true);
register('command', stopPathing).setName('stop', true);
