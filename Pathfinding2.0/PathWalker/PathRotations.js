import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { MathUtils } from '../../Utility/Math';
import { Rotations } from '../../Utility/Rotations';
import { renderSplineBoxes } from '../PathDebug';
import { pathState } from './PathState';

const MIN_SPEED_CONSTANT = 40;
const MAX_SPEED_CONSTANT = 60;
const ANGLE_SCALING_FACTOR = 20;

const GENERAL_PITCH_DAMPENING = 0.5;
const MAX_UPWARD_PITCH_GRADE = -15.0;
const MAX_DOWNWARD_PITCH_GRADE = 20.0;

const LOOK_AHEAD_DISTANCE = 3;
const YAW_AHEAD_DISTANCE = 5;
const MAX_YAW_ADJUSTMENT = 15;

const ADVANCE_DISTANCE = 1;

const MAX_ALLOWED_PITCH_DOWN = 89.9;
const MAX_ALLOWED_PITCH_UP = -89.9;

const BOX_RESET_SEARCH_RANGE = 20;

const JUMP_VELOCITY_THRESHOLD = 0.1;
const JUMP_SMOOTHING_FACTOR = 0.3;

let isJumping = false;

function calculateRotationSpeed(targetPoint) {
    const { yaw: relYaw, pitch: relPitch } =
        MathUtils.calculateAngles(targetPoint);
    const totalAngleDifference = Math.abs(relYaw) + Math.abs(relPitch);

    const range = MAX_SPEED_CONSTANT - MIN_SPEED_CONSTANT;
    let speedConstant =
        MIN_SPEED_CONSTANT +
        range *
            Math.exp((-ANGLE_SCALING_FACTOR * totalAngleDifference) / 180.0);

    return Math.max(
        MIN_SPEED_CONSTANT,
        Math.min(MAX_SPEED_CONSTANT, speedConstant)
    );
}

function calculateSmoothedYaw(targetYaw, currentSmoothedYaw) {
    const deltaYaw = MathUtils.getAngleDifference(
        currentSmoothedYaw,
        targetYaw
    );
    const adjustment =
        Math.min(Math.abs(deltaYaw), MAX_YAW_ADJUSTMENT) * Math.sign(deltaYaw);
    return currentSmoothedYaw + adjustment;
}

function detectJumping() {
    const player = Player.getPlayer();
    if (!player) return false;

    const velocityY = player.getVelocity().y;
    isJumping = velocityY > JUMP_VELOCITY_THRESHOLD;
    return isJumping;
}

function applySmoothing(targetPitch, currentPitch) {
    return currentPitch + (targetPitch - currentPitch) * JUMP_SMOOTHING_FACTOR;
}

function updateCurrentBox() {
    const playerEyes = Player.getPlayer()?.getEyePos();
    if (!playerEyes) return;

    const { boxPositions, currentBoxIndex } = pathState;

    let closestBoxDistanceSq = Infinity;
    let newCurrentBoxIndex = currentBoxIndex;
    const startIndex = Math.max(0, currentBoxIndex - BOX_RESET_SEARCH_RANGE);
    const endIndex = Math.min(
        boxPositions.length,
        currentBoxIndex + BOX_RESET_SEARCH_RANGE
    );

    for (let i = startIndex; i < endIndex; i++) {
        const box = boxPositions[i];
        const dx = playerEyes.x - (box.x + 0.5);
        const dz = playerEyes.z - (box.z + 0.5);
        const horizontalDistanceSq = dx * dx + dz * dz;

        if (horizontalDistanceSq < closestBoxDistanceSq) {
            closestBoxDistanceSq = horizontalDistanceSq;
            newCurrentBoxIndex = i;
        }
    }

    if (newCurrentBoxIndex >= currentBoxIndex - 5) {
        pathState.currentBoxIndex = newCurrentBoxIndex;
    }

    const horizontalDistanceToNextPoint = Math.sqrt(closestBoxDistanceSq);
    if (horizontalDistanceToNextPoint < ADVANCE_DISTANCE) {
        pathState.currentBoxIndex = Math.min(
            pathState.currentBoxIndex + 1,
            boxPositions.length - 1
        );
    }
}

export function pathRotations(splineData) {
    if (!pathState.boxPositions.length) {
        pathState.boxPositions = renderSplineBoxes(splineData, 1);
    }

    const { boxPositions, currentBoxIndex } = pathState;
    const playerEyes = Player.getPlayer()?.getEyePos();

    if (
        !playerEyes ||
        boxPositions.length === 0 ||
        currentBoxIndex >= boxPositions.length - 1
    ) {
        return;
    }

    updateCurrentBox();
    detectJumping();

    const targetPitchIndex = Math.min(
        currentBoxIndex + LOOK_AHEAD_DISTANCE,
        boxPositions.length - 1
    );
    const targetPitchPoint = boxPositions[targetPitchIndex];
    if (!targetPitchPoint) return;

    const lookAheadBoxCenter = new Vec3d(
        targetPitchPoint.x + 0.5,
        targetPitchPoint.y + 0.5,
        targetPitchPoint.z + 0.5
    );

    const rotationSpeedConstant = calculateRotationSpeed(lookAheadBoxCenter);

    const targetYawIndex = Math.min(
        currentBoxIndex + YAW_AHEAD_DISTANCE,
        boxPositions.length - 1
    );
    const targetYawPoint = boxPositions[targetYawIndex];
    if (!targetYawPoint) return;

    const finalRotationTargetPoint = new Vec3d(
        targetYawPoint.x + 0.5,
        targetYawPoint.y + 0.5,
        targetYawPoint.z + 0.5
    );

    const { pitch: calculatedPitch, yaw: targetYaw } =
        MathUtils.calculateAbsoluteAngles(finalRotationTargetPoint);

    if (!pathState.rotationInitialized) {
        pathState.lastSmoothedYaw = targetYaw;
        pathState.lastSmoothedPitch = calculatedPitch;
        pathState.rotationInitialized = true;
    }

    const smoothedYaw = calculateSmoothedYaw(
        targetYaw,
        pathState.lastSmoothedYaw
    );
    pathState.lastSmoothedYaw = smoothedYaw;

    const smoothedPitch = applySmoothing(
        calculatedPitch,
        pathState.lastSmoothedPitch
    );
    pathState.lastSmoothedPitch = smoothedPitch;

    let finalPitch = smoothedPitch * GENERAL_PITCH_DAMPENING;
    finalPitch = Math.max(finalPitch, MAX_UPWARD_PITCH_GRADE);
    finalPitch = Math.min(finalPitch, MAX_DOWNWARD_PITCH_GRADE);
    finalPitch = Math.min(finalPitch, MAX_ALLOWED_PITCH_DOWN);
    finalPitch = Math.max(finalPitch, MAX_ALLOWED_PITCH_UP);

    Rotations.rotateToAngles(
        smoothedYaw,
        finalPitch,
        false,
        rotationSpeedConstant
    );
}
