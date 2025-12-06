import * as RotationRecorder from './RotationRecorder';
const ENABLE_RECORDING = true;

import { MathUtils } from '../../Math';
import { PathRotationsUtility } from './PathRotationsUtility';
import { renderSplineBoxes } from '../PathDebug';
import { detectStuck, resetStuckDetection } from './PathStuckRecovery';

// Make yaw look ahead thingy dynamic and based off speed ; slower speed = smaller. look ahead max look ahead is to be 5 (anything over 300 speed should have 5 look ahead)
/* Quick analysis 
anything  under 4 bps = ~1
over 4 & under 7 = ~2
over 7 = ~5
*/

const MIN_SPEED_CONSTANT = 60; // Fastest rotation time (ms).
const MAX_SPEED_CONSTANT = 80; // Slowest rotation time (ms).
const ANGLE_SCALING_FACTOR = 20; // Scales speed reduction for large turns.

const GENERAL_PITCH_DAMPENING = 0.7; // Softens vertical angle changes (slopes).
const JUMP_SMOOTHING_FACTOR = 0.3;

const LOOK_AHEAD_DISTANCE = 3; // Path boxes ahead for pitch target.
const BASE_YAW_AHEAD_DISTANCE = 4;
const YAW_AHEAD_JUMP_MULTIPLIER = 1.3; // Path boxes ahead for yaw target.

const MAX_YAW_ADJUSTMENT = 20; // Max horizontal angle change per tick.
const MAX_YAW_ADJUSTMENT_INITIAL = 70; // Max horizontal angle change per tick for the first rotation

const ADVANCE_DISTANCE = 1; // Distance (blocks) to pass a box and advance.
const BOX_RESET_SEARCH_RANGE = 20; // Range to re-find the closest box on path correction.
const BOX_SWITCH_HYSTERESIS = 3; // Stop switching fast back and forth.

// Both of these are useless.
const MAX_ALLOWED_PITCH_DOWN = 89.9; // Hard limit to prevent pointing straight down.
const MAX_ALLOWED_PITCH_UP = -89.9; // Hard limit to prevent pointing straight up.

const JUMP_VELOCITY_THRESHOLD = 0.1; // Min vertical velocity to detect a jump.

let currentBoxIndex = 1;
let currentPathPosition = 1.0;
let lastSmoothedYaw = Player.getYaw() || 0;
let lastSmoothedPitch = Player.getPitch() || 0;
let isInitialized = false;
let isJumping = false;
let complete = false;

let smoothedYawLookahead = BASE_YAW_AHEAD_DISTANCE;
const YAW_LOOKAHEAD_SMOOTHING = 0.2;

export function PathComplete() {
    return complete;
}

export function ResetRotations() {
    currentBoxIndex = 1;
    currentPathPosition = 1.0;
    isInitialized = false;
    isJumping = false;
    complete = false;
    smoothedYawLookahead = BASE_YAW_AHEAD_DISTANCE;
    resetStuckDetection();
}

function detectJumping() {
    const player = Player.getPlayer();
    if (!player) return false;

    const velocityY = player.getVelocity().y;
    const isMovingUp = velocityY > JUMP_VELOCITY_THRESHOLD;
    const onGround = player.isOnGround();

    if (isMovingUp) isJumping = true;
    else if (onGround) isJumping = false;

    return isJumping;
}

function findClosestBoxIndex(boxPositions, currentIndex, playerEyes) {
    let closestBoxDistanceSq = Infinity;
    let newCurrentBoxIndex = currentIndex;

    const startIndex = Math.max(0, currentIndex - BOX_RESET_SEARCH_RANGE);
    const endIndex = Math.min(boxPositions.length, currentIndex + BOX_RESET_SEARCH_RANGE);

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

    return newCurrentBoxIndex;
}

function updateBoxIndex(newIndex, currentIndex) {
    if (newIndex >= currentIndex) {
        return newIndex;
    } else if (newIndex < currentIndex - BOX_SWITCH_HYSTERESIS) {
        return newIndex;
    }
    return currentIndex;
}

function calculatePathPosition(currentBox, nextBox, playerEyes) {
    const vectorX = nextBox.x - currentBox.x;
    const vectorZ = nextBox.z - currentBox.z;
    const segmentLengthSq = vectorX * vectorX + vectorZ * vectorZ;

    const pointX = playerEyes.x - (currentBox.x + 0.5);
    const pointZ = playerEyes.z - (currentBox.z + 0.5);

    let t = 0;
    if (segmentLengthSq > 0.0001) {
        t = (pointX * vectorX + pointZ * vectorZ) / segmentLengthSq;
    }

    return Math.max(0, Math.min(1, t));
}

export function pathRotations(splineData) {
    const boxPositions = renderSplineBoxes(splineData, 1.5);
    const playerEyes = Player.getPlayer().getEyePos();

    // Check completion
    if (boxPositions.length === 0 || currentBoxIndex >= boxPositions.length - 1) {
        if (!complete) {
            complete = true;
            if (ENABLE_RECORDING && RotationRecorder.isCurrentlyRecording()) {
                RotationRecorder.stopRecording();
                RotationRecorder.saveRecording();
            }
        }
        return;
    }

    const stuckCheck = detectStuck(boxPositions, currentBoxIndex);
    if (stuckCheck === 'RECALCULATE') {
        complete = true;
        if (global.requestPathRecalculation) {
            global.requestPathRecalculation();
        }
        return;
    } else if (typeof stuckCheck === 'number') {
        currentBoxIndex = stuckCheck;
    }

    const newCurrentBoxIndex = findClosestBoxIndex(boxPositions, currentBoxIndex, playerEyes);
    currentBoxIndex = updateBoxIndex(newCurrentBoxIndex, currentBoxIndex);

    if (currentBoxIndex < 0 || currentBoxIndex >= boxPositions.length) {
        currentBoxIndex = Math.max(0, Math.min(boxPositions.length - 1, currentBoxIndex));
        return;
    }

    const nextBox = boxPositions[currentBoxIndex + 1];
    const currentBox = boxPositions[currentBoxIndex];

    if (!nextBox) {
        currentBoxIndex = boxPositions.length - 1;
        return;
    }

    const positionFraction = calculatePathPosition(currentBox, nextBox, playerEyes);
    currentPathPosition = currentBoxIndex + positionFraction;

    const isCurrentlyJumping = detectJumping();
    const targetYawLookahead = isCurrentlyJumping ? BASE_YAW_AHEAD_DISTANCE * YAW_AHEAD_JUMP_MULTIPLIER : BASE_YAW_AHEAD_DISTANCE;

    smoothedYawLookahead += (targetYawLookahead - smoothedYawLookahead) * YAW_LOOKAHEAD_SMOOTHING;

    const targetPathIndex = currentPathPosition + LOOK_AHEAD_DISTANCE;
    const targetYawPathIndex = currentPathPosition + smoothedYawLookahead;

    const pitchStartIndex = Math.min(Math.floor(targetPathIndex), boxPositions.length - 2);
    const yawStartIndex = Math.min(Math.floor(targetYawPathIndex), boxPositions.length - 2);

    const pitchFraction = targetPathIndex - pitchStartIndex;
    const yawFraction = targetYawPathIndex - yawStartIndex;

    const lookAheadBoxCenter = PathRotationsUtility.interpolateBoxPosition(boxPositions, pitchStartIndex, pitchFraction);
    const finalRotationTargetPoint = PathRotationsUtility.interpolateBoxPosition(boxPositions, yawStartIndex, yawFraction);

    if (!lookAheadBoxCenter || !finalRotationTargetPoint) {
        currentBoxIndex = boxPositions.length - 1;
        return;
    }

    const rotationSpeedConstant = PathRotationsUtility.calculateRotationSpeed(lookAheadBoxCenter, MIN_SPEED_CONSTANT, MAX_SPEED_CONSTANT, ANGLE_SCALING_FACTOR);

    const { pitch: calculatedPitch, yaw: targetYaw } = MathUtils.calculateAbsoluteAngles(finalRotationTargetPoint);

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

    const smoothedYaw = PathRotationsUtility.calculateSmoothedYaw(targetYaw, lastSmoothedYaw, currentMaxYawAdjustment);
    lastSmoothedYaw = smoothedYaw;

    const smoothedPitch = PathRotationsUtility.applySmoothPitchTransition(calculatedPitch, lastSmoothedPitch, JUMP_SMOOTHING_FACTOR);
    lastSmoothedPitch = smoothedPitch;

    let finalPitch = smoothedPitch;
    if (isCurrentlyJumping) {
        finalPitch *= GENERAL_PITCH_DAMPENING;
    }

    finalPitch = Math.min(finalPitch, MAX_ALLOWED_PITCH_DOWN);
    finalPitch = Math.max(finalPitch, MAX_ALLOWED_PITCH_UP);

    if (ENABLE_RECORDING) {
        RotationRecorder.recordRotation(smoothedYaw, finalPitch);
    }

    PathRotationsUtility.rotateToAngles(smoothedYaw, finalPitch, false, rotationSpeedConstant);

    const distanceToCurrentPoint = MathUtils.getDistanceToPlayerEyes(currentBox.x + 0.5, currentBox.y + 0.5, currentBox.z + 0.5);

    if (distanceToCurrentPoint < ADVANCE_DISTANCE / 2 && currentPathPosition > currentBoxIndex + 0.9) {
        currentBoxIndex = Math.min(currentBoxIndex + 1, boxPositions.length - 1);
        currentPathPosition = currentBoxIndex;
    }
}
