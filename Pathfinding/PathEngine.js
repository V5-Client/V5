import { updateRotations } from './PathRotations';
import { renderPath } from './PathRenderer';
import {
    updateCurrentNode,
    calculateLookaheadTarget,
    isAtFinalNode,
    adjustSplineToEyeLevel,
    findClosestNodeIndex,
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
        movementState.targetPoint = calculateLookaheadTarget();
        movementState.isFalling = !Player.getPlayer().isOnGround();

        mc.options.forwardKey.setPressed(true);
        mc.options.sprintKey.setPressed(true);
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
