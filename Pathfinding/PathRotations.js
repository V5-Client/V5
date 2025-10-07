import { Rotations } from '../Utility/Rotations';
import { movementState } from './PathState';
import { getDistance3D } from './PathMovement';

// THIS IS FOR TESTING, DO NOT ENABLE IN PRODUCTION
const INSTANT_SNAP_MODE = false;

const ROTATION_STEPS = 100; // milliseconds for rotation. lower = responsive, higher = smoother

export function updateRotations() {
    if (!movementState.targetPoint) return;
    const eyePos = Player.getPlayer()?.getEyePos();
    if (!eyePos) return;

    const dx = movementState.targetPoint.x - eyePos.x;
    const dy =
        (movementState.targetPoint.y - eyePos.y) *
        (movementState.isFalling ? 0.3 : 1);
    const dz = movementState.targetPoint.z - eyePos.z;

    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    let targetPitch = -Math.atan2(dy, Math.hypot(dx, dz)) * (180 / Math.PI) + 3;
    targetPitch = Math.max(-35, Math.min(35, targetPitch));

    // use the thread rotation
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
