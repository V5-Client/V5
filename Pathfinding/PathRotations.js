import { Rotations } from '../Utility/Rotations';
import { movementState } from './PathState';

const INSTANT_SNAP_MODE = false;
const ROTATION_STEPS = 40;
const MIN_PITCH_DISTANCE = 1.5;

let lastPitch = 0;
let consecutiveJumps = 0;
let ticksSinceLastJump = 0;

export function updateRotations() {
    if (!movementState.targetPoint) return;

    const eyePos = Player.getPlayer()?.getEyePos();
    if (!eyePos) return;

    if (movementState.jumpTriggered) {
        consecutiveJumps++;
        ticksSinceLastJump = 0;
    } else {
        ticksSinceLastJump++;
        if (ticksSinceLastJump > 20) {
            consecutiveJumps = 0;
        }
    }

    const isInJumpSequence =
        consecutiveJumps >= 2 ||
        (consecutiveJumps > 0 && ticksSinceLastJump < 10);

    if (
        movementState.jumpStartYaw !== null &&
        movementState.jumpStartPitch !== null &&
        movementState.jumpType !== 'step' &&
        movementState.fallingTicks > 0 &&
        movementState.fallingTicks <= 15
    ) {
        Rotations.rotateToAngles(
            movementState.jumpStartYaw,
            movementState.jumpStartPitch,
            INSTANT_SNAP_MODE,
            ROTATION_STEPS
        );
        return;
    }

    const dx = movementState.targetPoint.x - eyePos.x;
    const dy = movementState.targetPoint.y - eyePos.y;
    const dz = movementState.targetPoint.z - eyePos.z;
    const horizontalDist = Math.hypot(dx, dz);

    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);

    let targetPitch = 0;

    if (isInJumpSequence) {
        targetPitch = lastPitch * 0.95;
    } else {
        const verticalDiff = Math.abs(dy);
        const shouldUsePitch = verticalDiff > 2.0 && horizontalDist < 5;

        if (shouldUsePitch) {
            let pitchMultiplier = 0.3;

            if (
                movementState.isFalling &&
                movementState.jumpType === 'long_gap'
            ) {
                pitchMultiplier = 0.2;
            }

            if (horizontalDist < MIN_PITCH_DISTANCE) {
                pitchMultiplier *= 0.1;
            }

            targetPitch =
                -Math.atan2(dy * pitchMultiplier, horizontalDist) *
                (180 / Math.PI);
        }

        targetPitch = lastPitch * 0.4 + targetPitch * 0.6;
    }

    targetPitch = Math.max(-15, Math.min(15, targetPitch));
    lastPitch = targetPitch;

    Rotations.rotateToAngles(
        targetYaw,
        targetPitch,
        INSTANT_SNAP_MODE,
        ROTATION_STEPS
    );
}

export function stopRotation() {
    Rotations.stopRotation();
    lastPitch = 0;
    consecutiveJumps = 0;
    ticksSinceLastJump = 0;
}
