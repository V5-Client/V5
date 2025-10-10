import { updateRotations } from './PathRotations';
import { renderPath } from './PathRenderer';
import {
    updateCurrentNode,
    calculateLookaheadTarget,
    isAtFinalNode,
    adjustSplineToEyeLevel,
    findClosestNodeIndex,
    shouldJump,
    detectAndRecoverFromStuck,
} from './PathMovement';
import { movementState, initializeMovementState } from './PathState';
import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';

const mc = Client.getMinecraft();
const localhost = `${Links.PATHFINDER_API_URL}`;

let movementTickRegister = null;
let movementRenderRegister = null;
let destinationCoords = null;
let pathCompleteCallback = null;
let isRecalculating = false;

function handleAirState(player) {
    const isOnGround = player.isOnGround();

    if (!isOnGround) {
        movementState.fallingTicks++;
        movementState.wasInAir = true;
    } else if (movementState.wasInAir) {
        resetAfterLanding();
    } else if (movementState.ticksSinceLanding !== null) {
        movementState.ticksSinceLanding++;
    }

    movementState.isFalling = movementState.fallingTicks > 4;
}

function resetAfterLanding() {
    if (movementState.jumpType === 'step') {
        movementState.jumpStartYaw = null;
        movementState.jumpStartPitch = null;
    }

    Object.assign(movementState, {
        jumpTriggered: false,
        anticipatingFall: false,
        wasInAir: false,
        ticksSinceLanding: 0,
        jumpType: null,
    });
}

function handleJumping(player) {
    const canJump =
        !movementState.jumpTriggered &&
        player.isOnGround() &&
        (movementState.ticksSinceLanding === null ||
            movementState.ticksSinceLanding >= 2);

    if (canJump && shouldJump()) {
        movementState.jumpTriggered = true;

        if (movementState.jumpType !== 'step') {
            movementState.jumpStartYaw = Player.getYaw();
            movementState.jumpStartPitch = Player.getPitch();
        }

        movementState.ticksSinceLanding = null;
        mc.options.jumpKey.setPressed(true);
    } else {
        mc.options.jumpKey.setPressed(
            movementState.jumpTriggered && !player.isOnGround()
        );
    }
}

function requestNewPathFromEngine(start, end) {
    const url = `${localhost}/api/pathfinding?start=${start.join(
        ','
    )}&end=${end.join(',')}&map=mines`;
    return request({ url, json: true, timeout: 15000 });
}

function triggerPathRecalculation() {
    if (isRecalculating || !destinationCoords) {
        console.log(
            '§c[Path Recalc] Already recalculating or no destination set'
        );
        return;
    }

    isRecalculating = true;
    console.log('§6[Path Recalc] Requesting new path from current position...');

    const currentPos = [
        Math.floor(Player.getX()),
        Math.floor(Player.getY()) - 1,
        Math.floor(Player.getZ()),
    ];

    requestNewPathFromEngine(currentPos, destinationCoords)
        .then((body) => {
            if (!body || !body.spline || !body.spline.length) {
                console.log(
                    '§c[Path Recalc] Failed to get new path - no spline received'
                );
                Chat.message(
                    '§c[Pathfinding] Failed to recalculate path. Stopping...'
                );
                pathCompleteCallback && pathCompleteCallback();
                isRecalculating = false;
                return;
            }

            const adjustedSpline = adjustSplineToEyeLevel(body.spline);
            const closestIndex = findClosestNodeIndex(adjustedSpline);
            initializeMovementState(adjustedSpline, closestIndex);
            isRecalculating = false;
            console.log('§a[Path Recalc] New path received and activated');
            Chat.message('§a[Pathfinding] New path calculated!');
        })
        .catch((err) => {
            console.log(
                '§c[Path Recalc] Network error requesting new path: ' + err
            );
            Chat.message(
                '§c[Pathfinding] Network error during recalculation. Stopping...'
            );
            pathCompleteCallback && pathCompleteCallback();
            isRecalculating = false;
        });
}

export function startPathing(splinePath, destination, onComplete) {
    stopEngine();
    if (!splinePath || !splinePath.length) return;

    destinationCoords = destination;
    pathCompleteCallback = onComplete;
    isRecalculating = false;

    const adjustedSpline = adjustSplineToEyeLevel(splinePath);
    const closestIndex = findClosestNodeIndex(adjustedSpline);
    initializeMovementState(adjustedSpline, closestIndex);

    movementTickRegister = register('tick', () => {
        if (!movementState.isWalking) return;

        const player = Player.getPlayer();
        if (!player) {
            onComplete && onComplete();
            return;
        }

        if (isAtFinalNode()) {
            onComplete && onComplete();
            global.showNotification(
                'Path Complete',
                'Destination reached.',
                'SUCCESS',
                2000
            );
            return;
        }

        updateCurrentNode();
        detectAndRecoverFromStuck();

        movementState.targetPoint = calculateLookaheadTarget();

        handleAirState(player);
        handleJumping(player);

        mc.options.forwardKey.setPressed(true);
        mc.options.sprintKey.setPressed(!movementState.isFalling);
    });

    movementRenderRegister = register('postRenderWorld', () => {
        if (movementState.isWalking) updateRotations();
        renderPath();
    });
}

export function stopEngine() {
    if (movementTickRegister) movementTickRegister.unregister();
    if (movementRenderRegister) movementRenderRegister.unregister();
    movementTickRegister = movementRenderRegister = null;
    destinationCoords = null;
    pathCompleteCallback = null;
    isRecalculating = false;
}

global.pathEngineStop = stopEngine;
global.pathEngineRecalculate = triggerPathRecalculation;
