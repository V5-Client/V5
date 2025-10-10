import { Rotations } from '../Utility/Rotations';
import { movementState } from './PathState';
import { getDistance3D } from './PathMovement';

// THIS IS FOR TESTING, DO NOT ENABLE IN PRODUCTION
const INSTANT_SNAP_MODE = false;

const ROTATION_STEPS = 80; // milliseconds for rotation. lower = responsive, higher = smoother
const MIN_PITCH_DISTANCE = 1.5;

export function updateRotations() {
    if (!movementState.targetPoint) return;
    const eyePos = Player.getPlayer()?.getEyePos();
    if (!eyePos) return;

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

    let pitchMultiplier = 1.0;

    // Only reduce pitch for ACTUAL long falls, not short jumps or steps
    if (movementState.isFalling && movementState.jumpType === 'long_gap') {
        pitchMultiplier = 0.35;
    }

    if (horizontalDist < MIN_PITCH_DISTANCE) {
        pitchMultiplier *= 0.2;
    }

    let targetPitch =
        -Math.atan2(dy * pitchMultiplier, horizontalDist) * (180 / Math.PI);

    targetPitch += 2;

    targetPitch = Math.max(-35, Math.min(35, targetPitch));

    Rotations.rotateToAngles(
        targetYaw,
        targetPitch,
        INSTANT_SNAP_MODE,
        ROTATION_STEPS
    );
}

export function stopRotation() {
    Rotations.stopRotation();
}
