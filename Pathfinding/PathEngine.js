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

const mc = Client.getMinecraft();

let movementTickRegister = null;
let movementRenderRegister = null;

export function startPathing(splinePath, onComplete) {
    stopEngine();
    if (!splinePath?.length) return;

    const adjustedSpline = adjustSplineToEyeLevel(splinePath);
    const closestIndex = findClosestNodeIndex(adjustedSpline);

    initializeMovementState(adjustedSpline, closestIndex);

    movementTickRegister = register('tick', () => {
        if (!movementState.isWalking) return;
        const player = Player.getPlayer();
        if (!player) {
            onComplete?.();
            return;
        }

        if (isAtFinalNode()) {
            onComplete?.();
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

        const isOnGround = player.isOnGround();

        if (!isOnGround) {
            movementState.fallingTicks++;
            if (!movementState.wasInAir) {
                movementState.wasInAir = true;
            }
        } else {
            const wasInAirBefore = movementState.wasInAir;
            movementState.fallingTicks = 0;

            if (wasInAirBefore) {
                if (movementState.jumpType === 'step') {
                    movementState.jumpStartYaw = null;
                    movementState.jumpStartPitch = null;
                }

                movementState.jumpTriggered = false;
                movementState.anticipatingFall = false;
                movementState.wasInAir = false;
                movementState.ticksSinceLanding = 0;
                movementState.jumpType = null;
            } else if (movementState.ticksSinceLanding !== null) {
                movementState.ticksSinceLanding++;
            }
        }

        movementState.isFalling = movementState.fallingTicks > 4;

        const canCheckForJump =
            !movementState.jumpTriggered &&
            isOnGround &&
            (movementState.ticksSinceLanding === null ||
                movementState.ticksSinceLanding >= 2);

        if (canCheckForJump && shouldJump()) {
            movementState.jumpTriggered = true;

            if (movementState.jumpType !== 'step') {
                movementState.jumpStartYaw = Player.getYaw();
                movementState.jumpStartPitch = Player.getPitch();
            }

            movementState.ticksSinceLanding = null;
            mc.options.jumpKey.setPressed(true);
        } else if (movementState.jumpTriggered && !isOnGround) {
            mc.options.jumpKey.setPressed(false);
        } else if (!movementState.jumpTriggered) {
            mc.options.jumpKey.setPressed(false);
        }

        mc.options.forwardKey.setPressed(true);
        mc.options.sprintKey.setPressed(!movementState.isFalling);
    });

    movementRenderRegister = register('postRenderWorld', () => {
        if (movementState.isWalking) updateRotations();
        renderPath();
    });
}

export function stopEngine() {
    movementTickRegister?.unregister();
    movementRenderRegister?.unregister();
    movementTickRegister = movementRenderRegister = null;
}

// expose stop function globally so PathAPI can call it
global.pathEngineStop = stopEngine;
