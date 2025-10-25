import * as RotationRecorder from './RotationRecorder';
const ENABLE_RECORDING = true;

import { Vec3d } from '../../Utility/Constants';
import { MathUtils } from '../../Utility/Math';
import { Rotations } from '../../Utility/Rotations';
import { renderSplineBoxes } from '../PathDebug';

const MIN_SPEED_CONSTANT = 60; // Fastest rotation time (ms).
const MAX_SPEED_CONSTANT = 80; // Slowest rotation time (ms).
const ANGLE_SCALING_FACTOR = 20; // Scales speed reduction for large turns.

const GENERAL_PITCH_DAMPENING = 0.7; // Softens vertical angle changes (slopes).

const LOOK_AHEAD_DISTANCE = 3; // Path boxes ahead for pitch target.
const YAW_AHEAD_DISTANCE = 5; // Path boxes ahead for yaw target.
const MAX_YAW_ADJUSTMENT = 20; // Max horizontal angle change per tick.
const MAX_YAW_ADJUSTMENT_INITIAL = 80; // Max horizontal angle change per tick for the first rotation

const ADVANCE_DISTANCE = 1; // Distance (blocks) to pass a box and advance.

// Both of these are useless.
const MAX_ALLOWED_PITCH_DOWN = 89.9; // Hard limit to prevent pointing straight down.
const MAX_ALLOWED_PITCH_UP = -89.9; // Hard limit to prevent pointing straight up.

const BOX_RESET_SEARCH_RANGE = 20; // Range to re-find the closest box on path correction.

let currentBoxIndex = 1; // Current target segment index.
let lastSmoothedYaw = Player.getYaw() || 0; // Last yaw value used for smoothing.
let lastSmoothedPitch = Player.getPitch() || 0; // Last pitch value used for smoothing.
let isInitialized = false; // Flag for initial rotation setup.

let isJumping = false; // True if player is jumping.
const JUMP_VELOCITY_THRESHOLD = 0.1; // Min vertical velocity to detect a jump.
const JUMP_SMOOTHING_FACTOR = 0.3; // Factor to smooth pitch changes on jumps.

let complete = false; // Ends the whole path if rotations are complete.

export function PathComplete() {
    return complete;
}

export function ResetRotations() {
    currentBoxIndex = 1;
    isInitialized = false;
    isJumping = false;
    complete = false;
}

function calculateRotationSpeed(targetPoint) {
    const { yaw: relYaw, pitch: relPitch } =
        MathUtils.calculateAngles(targetPoint);

    const totalAngleDifference = Math.abs(relYaw) + Math.abs(relPitch);

    const range = MAX_SPEED_CONSTANT - MIN_SPEED_CONSTANT;

    let speedConstant =
        MIN_SPEED_CONSTANT +
        range *
            Math.exp((-ANGLE_SCALING_FACTOR * totalAngleDifference) / 180.0);

    speedConstant = Math.max(
        MIN_SPEED_CONSTANT,
        Math.min(MAX_SPEED_CONSTANT, speedConstant)
    );

    return speedConstant;
}

function calculateSmoothedYaw(targetYaw, currentSmoothedYaw, maxAdjustment) {
    const deltaYaw = MathUtils.getAngleDifference(
        currentSmoothedYaw,
        targetYaw
    );

    const adjustment =
        Math.min(Math.abs(deltaYaw), maxAdjustment) * Math.sign(deltaYaw);

    return currentSmoothedYaw + adjustment;
}

function detectJumping() {
    const player = Player.getPlayer();
    if (!player) return false;

    const velocityY = player.getVelocity().y;

    const isMovingUp = velocityY > JUMP_VELOCITY_THRESHOLD;

    const onGround = Player.getPlayer().isOnGround();

    if (isMovingUp) isJumping = true;
    else if (onGround) isJumping = false;

    return isJumping;
}

function applySmoothing(targetPitch, currentPitch) {
    const pitchSmoothingFactor = JUMP_SMOOTHING_FACTOR;

    const smoothedPitch =
        currentPitch + (targetPitch - currentPitch) * pitchSmoothingFactor;

    return smoothedPitch;
}

export function pathRotations(splineData) {
    const boxPositions = renderSplineBoxes(splineData, 1);
    const playerEyes = Player.getPlayer().getEyePos();

    if (
        boxPositions.length === 0 ||
        currentBoxIndex === boxPositions.length - 1
    ) {
        if (!complete) {
            complete = true;

            if (ENABLE_RECORDING && RotationRecorder.isCurrentlyRecording()) {
                RotationRecorder.stopRecording();
                RotationRecorder.saveRecording();
            }
        }

        return;
    }

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
        currentBoxIndex = newCurrentBoxIndex;
    }

    if (currentBoxIndex < 0 || currentBoxIndex >= boxPositions.length) {
        currentBoxIndex = -1;
        return;
    }

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

    let rotationSpeedConstant = calculateRotationSpeed(lookAheadBoxCenter);

    const yawLookAhead = detectJumping()
        ? Math.round(YAW_AHEAD_DISTANCE * 1.5)
        : YAW_AHEAD_DISTANCE;

    const targetYawIndex = Math.min(
        currentBoxIndex + yawLookAhead,
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

    let currentMaxYawAdjustment = MAX_YAW_ADJUSTMENT;

    if (!isInitialized) {
        lastSmoothedYaw = Player.getYaw();
        lastSmoothedPitch = Player.getPitch();
        isInitialized = true;

        currentMaxYawAdjustment = MAX_YAW_ADJUSTMENT_INITIAL;

        if (ENABLE_RECORDING) {
            RotationRecorder.startRecording();
        }
    }

    const smoothedYaw = calculateSmoothedYaw(
        targetYaw,
        lastSmoothedYaw,
        currentMaxYawAdjustment
    );
    lastSmoothedYaw = smoothedYaw;

    const smoothedPitch = applySmoothing(calculatedPitch, lastSmoothedPitch);
    lastSmoothedPitch = smoothedPitch;

    let finalPitch = smoothedPitch;

    if (detectJumping()) finalPitch *= GENERAL_PITCH_DAMPENING;

    finalPitch = Math.min(finalPitch, MAX_ALLOWED_PITCH_DOWN);
    finalPitch = Math.max(finalPitch, MAX_ALLOWED_PITCH_UP);

    if (ENABLE_RECORDING)
        RotationRecorder.recordRotation(smoothedYaw, finalPitch);

    Rotations.rotateToAngles(
        smoothedYaw,
        finalPitch,
        false,
        rotationSpeedConstant
    );

    const distanceToCurrentPoint = MathUtils.getDistanceToPlayerEyes(
        boxPositions[currentBoxIndex].x + 0.5,
        boxPositions[currentBoxIndex].y + 0.5,
        boxPositions[currentBoxIndex].z + 0.5
    );

    if (distanceToCurrentPoint < ADVANCE_DISTANCE) {
        currentBoxIndex++;
    }
}
