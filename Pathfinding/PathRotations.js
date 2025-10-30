import { Rotations } from '../Utility/Rotations';
import { movementState } from './PathState';
import { getDistance3D } from './PathMovement';

const INSTANT_SNAP_MODE = false;
const ROTATION_STEPS = 40;
const LARGE_PITCH_THRESHOLD = 45;
const LARGE_PITCH_DAMPENING = 0.3;
const MIN_PITCH_DISTANCE = 3.5;

let lastCalculatedPitch = 0;

function findPitchTargetNode() {
    const { splinePath, currentNodeIndex } = movementState;
    if (!splinePath || !splinePath.length) return null;

    const player = Player.getPlayer();
    const eyePos = player?.getEyePos();
    if (!eyePos) return null;

    let targetForPitch = movementState.targetPoint;
    if (!targetForPitch) return null;

    const distToTarget = getDistance3D(eyePos, targetForPitch);

    if (distToTarget < MIN_PITCH_DISTANCE) {
        for (let i = currentNodeIndex + 1; i < splinePath.length; i++) {
            const node = splinePath[i];
            const dist = getDistance3D(eyePos, node);

            if (dist >= MIN_PITCH_DISTANCE) {
                return node;
            }
        }
        return splinePath[splinePath.length - 1];
    }

    return targetForPitch;
}

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
        Rotations.rotateToAngles(movementState.jumpStartYaw, movementState.jumpStartPitch, INSTANT_SNAP_MODE, ROTATION_STEPS);
        return;
    }

    const dx = movementState.targetPoint.x - eyePos.x;
    const dz = movementState.targetPoint.z - eyePos.z;
    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);

    const pitchTarget = findPitchTargetNode();
    let targetPitch = 0;

    if (pitchTarget) {
        const dyPitch = pitchTarget.y - eyePos.y;
        const dzPitch = pitchTarget.z - eyePos.z;
        const dxPitch = pitchTarget.x - eyePos.x;
        const horizontalDistPitch = Math.hypot(dxPitch, dzPitch);

        targetPitch = -Math.atan2(dyPitch, horizontalDistPitch) * (180 / Math.PI);

        const pitchChange = Math.abs(targetPitch - lastCalculatedPitch);

        if (pitchChange > LARGE_PITCH_THRESHOLD) {
            const blendedPitch = lastCalculatedPitch + (targetPitch - lastCalculatedPitch) * LARGE_PITCH_DAMPENING;
            targetPitch = blendedPitch;
        }
    }

    targetPitch = Math.max(-30, Math.min(30, targetPitch));

    lastCalculatedPitch = targetPitch;

    Rotations.rotateToAngles(targetYaw, targetPitch, INSTANT_SNAP_MODE, ROTATION_STEPS);
}

export function stopRotation() {
    Rotations.stopRotation();
    lastCalculatedPitch = 0;
}
