import { Rotations } from '../Utility/Rotations';
import { movementState } from './PathState';
import { getDistance3D } from './PathMovement';

// THIS IS FOR TESTING, DO NOT ENABLE IN PRODUCTION
const INSTANT_SNAP_MODE = false;

const ROTATION_SMOOTHING = 0.035;
const TARGET_STABILITY_THRESHOLD = 0.5;
const TARGET_STABILITY_FRAMES = 3;
const MAX_ROTATION_SPEED = 20;

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

    // skip smoothing and just snap
    if (INSTANT_SNAP_MODE) {
        movementState.lastRotation = { yaw: targetYaw, pitch: targetPitch };
        Rotations.rotateToAngles(targetYaw, targetPitch, true); // set instant mode of the utility rotations to true
        return;
    }

    // smooth rotation stuff. still uses /Utility/Rotations instant mode, since it has its own custom smoothing
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
    Rotations.rotateToAngles(newYaw, newPitch, true); // set instant mode of the utility rotations to true (it has custom smoothing dw)
}

export function stopRotation() {
    Rotations.stopRotation();
}
