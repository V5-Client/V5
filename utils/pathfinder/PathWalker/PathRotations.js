import * as RotationRecorder from './RotationRecorder';
const ENABLE_RECORDING = true;

import { MathUtils } from '../../Math';
import { PathRotationsUtility } from './PathRotationsUtility';
import { renderSplineBoxes } from '../PathDebug';
import { detectStuck, resetStuckDetection } from './PathStuckRecovery';
import { Utils } from '../../Utils';
import { Keybind } from '../../player/Keybinding';
import { Chat } from '../../Chat';

let requestPathRecalculation = null;

export const setRequestPathRecalculation = (callback) => {
    requestPathRecalculation = callback;
};

// Lookahead
const LOOK_AHEAD_DISTANCE = 4;
const BASE_YAW_AHEAD_DISTANCE = 4;
const YAW_AHEAD_JUMP_MULTIPLIER = 1.3;

const YAW_SMOOTH_SPEED = 0.15;
const PITCH_SMOOTH_SPEED = 0.12;
const PITCH_AIRBORNE_SMOOTH_SPEED = 0.045;
const PITCH_WALKING_UPDOWN_SMOOTH_SPEED = 0.008;

const YAW_DEAD_ZONE = 0.3;
const PITCH_DEAD_ZONE = 0.15;
const PITCH_WALKING_UPDOWN_DEAD_ZONE = 1.5;

const Y_CHANGE_THRESHOLD = 0.03;
const Y_CHANGE_SMOOTHING = 0.25;
const Y_CHANGE_DECAY = 0.92;

// improves fall rotations, it smooths out the node skipping (falls usually make it go from like node 20 to 80 instantly)
const NODE_SKIP_THRESHOLD = 6;
const TARGET_BLEND_NORMAL = 0.4;
const TARGET_BLEND_SKIP = 0.15;
const SKIP_RECOVERY_TICKS = 15;

const BASE_ADVANCE_DISTANCE = 1.0;
const MIN_ADVANCE_DISTANCE = 0.3;
const BOX_RESET_SEARCH_RANGE = 20;
const BOX_SWITCH_HYSTERESIS = 3;

// difficulty shit.
const DIFFICULTY_LOOKAHEAD = 8;
const SHARP_TURN_THRESHOLD_DEG = 55;
const VERY_SHARP_TURN_THRESHOLD_DEG = 100;
const LEDGE_Y_THRESHOLD = 0.5;
const STRAFE_LEDGE_Y_THRESHOLD = 1;

// this shit works. it works.
const GRADUAL_STEP_MAX_HEIGHT = 0.6;

const STRAFE_SINGLE_STEP_THRESHOLD = 0.75;
const STRAFE_TOTAL_Y_THRESHOLD = 1.3;
const STRAFE_TOTAL_Y_MIN_SINGLE = 0.6;

// Dynamic yaw ( ˶ˆᗜˆ˵ )
const MIN_YAW_AHEAD_DISTANCE = 0.5;
const DYNAMIC_YAW_CURVATURE_RADIUS = 4;
const CURVATURE_FULL_REDUCTION_ANGLE = 45;

const MIN_PITCH_LOOKAHEAD = 2.5;

const STRAFE_ENABLE_COLLISION_TICKS = 4;
const STRAFE_ANGLE_THRESHOLD = 30;
const STRAFE_DURATION_AFTER_UNCOLLIDE = 12;
const STRAFE_MIN_DISTANCE_TO_DIFFICULTY = 2.5;
const STRAFE_ELIGIBILITY_MEMORY = 10;

const MAX_ALLOWED_PITCH_DOWN = 89.9;
const MAX_ALLOWED_PITCH_UP = -89.9;

let currentBoxIndex = 1;
let currentPathPosition = 1.0;
let isInitialized = false;
let complete = false;

let rawTargetYaw = 0;
let rawTargetPitch = 0;
let smoothedTargetYaw = 0;
let smoothedTargetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;

let isAirborne = false;
let groundedTickCount = 0;
let airborneTickCount = 0;

let lastPlayerY = 0;
let smoothedYChangeRate = 0;
let isWalkingUpDown = false;
let walkingUpDownTicks = 0;

let lastBoxIndex = 0;
let ticksSinceNodeSkip = 999;

let collisionTicks = 0;
let isStrafing = false;
let strafeDirection = 0;
let strafeHoldTicks = 0;
let recentStrafeEligible = 0;

let rotationActive = false;

export function PathComplete() {
    return complete;
}

export function ResetRotations() {
    currentBoxIndex = 1;
    currentPathPosition = 1.0;
    isInitialized = false;
    complete = false;
    resetStuckDetection();

    isAirborne = false;
    groundedTickCount = 0;
    airborneTickCount = 0;

    rawTargetYaw = 0;
    rawTargetPitch = 0;
    smoothedTargetYaw = 0;
    smoothedTargetPitch = 0;
    currentYaw = 0;
    currentPitch = 0;

    lastPlayerY = 0;
    smoothedYChangeRate = 0;
    isWalkingUpDown = false;
    walkingUpDownTicks = 0;

    lastBoxIndex = 0;
    ticksSinceNodeSkip = 999;

    collisionTicks = 0;
    isStrafing = false;
    strafeDirection = 0;
    strafeHoldTicks = 0;
    recentStrafeEligible = 0;
    Keybind.setKey('a', false);
    Keybind.setKey('d', false);

    rotationActive = false;
}

function wrapAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}

function getAngleDelta(from, to) {
    return wrapAngle(to - from);
}

function computeLocalCurvature(boxPositions, centerIndex, radius = DYNAMIC_YAW_CURVATURE_RADIUS) {
    if (!boxPositions || boxPositions.length < 3) return 0;

    const lastIndex = boxPositions.length - 1;
    const start = Math.max(1, centerIndex - radius);
    const end = Math.min(lastIndex - 1, centerIndex + radius);

    let maxAngleDeg = 0;

    for (let i = start; i <= end; i++) {
        const prev = boxPositions[i - 1];
        const curr = boxPositions[i];
        const next = boxPositions[i + 1];

        const v1x = curr.x - prev.x;
        const v1z = curr.z - prev.z;
        const v2x = next.x - curr.x;
        const v2z = next.z - curr.z;

        const mag1 = Math.sqrt(v1x * v1x + v1z * v1z);
        const mag2 = Math.sqrt(v2x * v2x + v2z * v2z);
        if (mag1 < 0.0001 || mag2 < 0.0001) continue;

        let cosAngle = (v1x * v2x + v1z * v2z) / (mag1 * mag2);
        cosAngle = Math.max(-1, Math.min(1, cosAngle));

        const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
        if (angleDeg > maxAngleDeg) maxAngleDeg = angleDeg;
    }

    return maxAngleDeg;
}

function analyzePathAhead(boxPositions, currentIndex) {
    const result = {
        maxAngle: 0,
        totalYChange: 0,
        maxSingleYChange: 0,
        hasLedge: false,
        hasSharpTurn: false,
        hasVerySharpTurn: false,
        turnDirection: 0,
        firstDifficultIndex: -1,
        shouldAllowStrafe: false,
        isGradualSlope: false,
    };

    if (!boxPositions || currentIndex >= boxPositions.length - 2) {
        return result;
    }

    const endIndex = Math.min(currentIndex + DIFFICULTY_LOOKAHEAD, boxPositions.length - 1);

    for (let i = currentIndex; i < endIndex && i < boxPositions.length - 1; i++) {
        const yDiff = Math.abs(boxPositions[i + 1].y - boxPositions[i].y);

        if (yDiff > 0.01) {
            result.totalYChange += yDiff;

            if (yDiff > result.maxSingleYChange) {
                result.maxSingleYChange = yDiff;
            }
        }
    }

    // if no big jump, gradual. im so smart
    result.isGradualSlope = result.maxSingleYChange <= GRADUAL_STEP_MAX_HEIGHT;

    if (!result.isGradualSlope && result.maxSingleYChange > LEDGE_Y_THRESHOLD) {
        result.hasLedge = true;
    }

    for (let i = currentIndex; i < endIndex - 1; i++) {
        const box0 = boxPositions[i];
        const box1 = boxPositions[i + 1];
        const box2 = i + 2 < boxPositions.length ? boxPositions[i + 2] : null;

        if (!result.isGradualSlope) {
            const yDiff = Math.abs(box1.y - box0.y);
            if (yDiff > LEDGE_Y_THRESHOLD && result.firstDifficultIndex === -1) {
                result.firstDifficultIndex = i;
            }
        }

        // angle change type shit
        if (box2) {
            const d1x = box1.x - box0.x;
            const d1z = box1.z - box0.z;
            const d2x = box2.x - box1.x;
            const d2z = box2.z - box1.z;

            const len1 = Math.sqrt(d1x * d1x + d1z * d1z);
            const len2 = Math.sqrt(d2x * d2x + d2z * d2z);

            if (len1 > 0.01 && len2 > 0.01) {
                const dot = (d1x * d2x + d1z * d2z) / (len1 * len2);
                const clampedDot = Math.max(-1, Math.min(1, dot));
                const angleDeg = Math.acos(clampedDot) * (180 / Math.PI);

                if (angleDeg > result.maxAngle) {
                    result.maxAngle = angleDeg;

                    const cross = d1x * d2z - d1z * d2x;
                    result.turnDirection = cross > 0 ? -1 : 1;
                }

                if (angleDeg > SHARP_TURN_THRESHOLD_DEG) {
                    result.hasSharpTurn = true;
                    if (result.firstDifficultIndex === -1) {
                        result.firstDifficultIndex = i;
                    }
                }

                if (angleDeg > VERY_SHARP_TURN_THRESHOLD_DEG) {
                    result.hasVerySharpTurn = true;
                }
            }
        }
    }

    // Strafing!
    const hasSignificantSingleStep = result.maxSingleYChange >= STRAFE_SINGLE_STEP_THRESHOLD;
    const hasSignificantTotalY = result.totalYChange >= STRAFE_TOTAL_Y_THRESHOLD && result.maxSingleYChange >= STRAFE_TOTAL_Y_MIN_SINGLE;
    const hasOriginalCondition = result.maxSingleYChange >= STRAFE_LEDGE_Y_THRESHOLD;
    const significantYChange = hasOriginalCondition || hasSignificantSingleStep || hasSignificantTotalY;

    result.shouldAllowStrafe = result.hasSharpTurn && significantYChange && !result.isGradualSlope;

    if (result.shouldAllowStrafe && result.firstDifficultIndex !== -1) {
        const distanceToDifficulty = result.firstDifficultIndex - currentIndex;
        if (distanceToDifficulty > STRAFE_MIN_DISTANCE_TO_DIFFICULTY * 2) {
            result.shouldAllowStrafe = false;
        }
    }

    return result;
}

function calculateYawLookahead(boxPositions, pathPosition, isGradualSlope, hasSharpTurn) {
    const baseYawAhead = BASE_YAW_AHEAD_DISTANCE * (isAirborne ? YAW_AHEAD_JUMP_MULTIPLIER : 1);
    const minYawAhead = MIN_YAW_AHEAD_DISTANCE * (isAirborne ? YAW_AHEAD_JUMP_MULTIPLIER : 1);

    if (isGradualSlope && !hasSharpTurn) {
        return baseYawAhead;
    }

    if (!boxPositions || boxPositions.length < 3) {
        return baseYawAhead;
    }

    const centerIndex = Math.max(1, Math.min(boxPositions.length - 2, Math.floor(pathPosition)));
    const localCurvature = computeLocalCurvature(boxPositions, centerIndex);

    const normalizedCurvature = Math.max(0, Math.min(1, localCurvature / CURVATURE_FULL_REDUCTION_ANGLE));

    return baseYawAhead - (baseYawAhead - minYawAhead) * normalizedCurvature;
}

function calculatePitchLookahead(isGradualSlope, hasSharpTurn) {
    if (isGradualSlope && !hasSharpTurn) {
        return LOOK_AHEAD_DISTANCE;
    }

    if (hasSharpTurn) {
        return MIN_PITCH_LOOKAHEAD;
    }

    return LOOK_AHEAD_DISTANCE;
}

function calculateStrafeDirection(boxPositions, currentIndex, pathAnalysis) {
    if (currentIndex + 1 >= boxPositions.length) return 0;

    const playerX = Player.getX();
    const playerZ = Player.getZ();
    const next = boxPositions[currentIndex + 1];

    const toNextX = next.x + 0.5 - playerX;
    const toNextZ = next.z + 0.5 - playerZ;

    const playerYaw = Player.getYaw();
    const facingX = -Math.sin((playerYaw * Math.PI) / 180);
    const facingZ = Math.cos((playerYaw * Math.PI) / 180);

    const cross = facingX * toNextZ - facingZ * toNextX;

    const toNextLen = Math.sqrt(toNextX * toNextX + toNextZ * toNextZ);
    if (toNextLen < 0.1) return 0;

    const dot = (facingX * toNextX + facingZ * toNextZ) / toNextLen;
    const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

    if (angleToTarget > STRAFE_ANGLE_THRESHOLD) {
        return cross > 0 ? -1 : 1;
    }

    if (pathAnalysis.hasVerySharpTurn && pathAnalysis.turnDirection !== 0) {
        return pathAnalysis.turnDirection;
    }

    return 0;
}

function updateStrafeState(boxPositions, currentIndex, pathAnalysis) {
    const isCollided = Utils.playerIsCollided();
    const player = Player.getPlayer();
    if (!player) return;

    if (isCollided) {
        collisionTicks++;
    } else {
        collisionTicks = 0;
    }

    if (pathAnalysis.shouldAllowStrafe) {
        recentStrafeEligible = STRAFE_ELIGIBILITY_MEMORY;
    } else if (recentStrafeEligible > 0) {
        recentStrafeEligible--;
    }

    const shouldConsiderStrafe = pathAnalysis.shouldAllowStrafe || recentStrafeEligible > 0;

    let requiredCollisionTicks = STRAFE_ENABLE_COLLISION_TICKS;
    if (pathAnalysis.firstDifficultIndex !== -1) {
        const distanceToDifficulty = pathAnalysis.firstDifficultIndex - currentIndex;
        if (distanceToDifficulty <= 2) {
            requiredCollisionTicks = 3;
        } else if (distanceToDifficulty <= 4) {
            requiredCollisionTicks = 5;
        }
    }

    if (isCollided && collisionTicks >= requiredCollisionTicks && shouldConsiderStrafe) {
        const newDirection = calculateStrafeDirection(boxPositions, currentIndex, pathAnalysis);

        if (newDirection !== 0) {
            strafeDirection = newDirection;
            isStrafing = true;
            strafeHoldTicks = STRAFE_DURATION_AFTER_UNCOLLIDE;
            Chat.messagePathfinder(`§7[Strafe] Enabled: dir=${strafeDirection > 0 ? 'right' : 'left'}, angle=${pathAnalysis.maxAngle.toFixed(1)}°`);
        }
    }

    if (!isCollided && isStrafing) {
        strafeHoldTicks--;
        if (strafeHoldTicks <= 0) {
            isStrafing = false;
            strafeDirection = 0;
        }
    }

    if (!shouldConsiderStrafe && !isCollided) {
        isStrafing = false;
        strafeDirection = 0;
        strafeHoldTicks = 0;
    }

    if (isStrafing && strafeDirection !== 0) {
        Keybind.setKey('a', strafeDirection === -1);
        Keybind.setKey('d', strafeDirection === 1);
    } else {
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
    }
}

function updateMovementState() {
    const player = Player.getPlayer();
    if (!player) return;

    const currentY = player.getY();
    const onGround = player.isOnGround();

    const yChange = Math.abs(currentY - lastPlayerY);

    if (yChange > 0.001) {
        smoothedYChangeRate = smoothedYChangeRate * (1 - Y_CHANGE_SMOOTHING) + yChange * Y_CHANGE_SMOOTHING;
    } else {
        smoothedYChangeRate *= Y_CHANGE_DECAY;
    }

    lastPlayerY = currentY;

    const wasWalkingUpDown = isWalkingUpDown;
    isWalkingUpDown = onGround && smoothedYChangeRate > Y_CHANGE_THRESHOLD;

    if (isWalkingUpDown) {
        walkingUpDownTicks++;
    } else if (wasWalkingUpDown) {
        walkingUpDownTicks = Math.max(0, walkingUpDownTicks - 2);
        isWalkingUpDown = walkingUpDownTicks > 0;
    } else {
        walkingUpDownTicks = 0;
    }

    if (onGround) {
        groundedTickCount++;
        if (groundedTickCount > 2) {
            isAirborne = false;
            airborneTickCount = 0;
        }
    } else {
        groundedTickCount = 0;
        isAirborne = true;
        airborneTickCount++;
    }
}

function updateNodeSkipTracking(newBoxIndex) {
    const skipAmount = newBoxIndex - lastBoxIndex;

    if (skipAmount > NODE_SKIP_THRESHOLD) {
        ticksSinceNodeSkip = 0;
    } else {
        ticksSinceNodeSkip++;
    }

    lastBoxIndex = newBoxIndex;
}

function getTargetBlendSpeed() {
    if (ticksSinceNodeSkip >= SKIP_RECOVERY_TICKS) {
        return TARGET_BLEND_NORMAL;
    }

    const recovery = ticksSinceNodeSkip / SKIP_RECOVERY_TICKS;
    const easedRecovery = 1 - (1 - recovery) * (1 - recovery);
    return TARGET_BLEND_SKIP + (TARGET_BLEND_NORMAL - TARGET_BLEND_SKIP) * easedRecovery;
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

register('tick', () => {
    if (!rotationActive) return;
    if (!ENABLE_RECORDING) return;
    if (!RotationRecorder.isCurrentlyRecording()) return;

    RotationRecorder.recordRotation(currentYaw, currentPitch);
});

register('step', () => {
    if (!rotationActive) return;

    const player = Player.getPlayer();
    if (!player) return;

    const targetBlendSpeed = getTargetBlendSpeed();

    const yawToRaw = getAngleDelta(smoothedTargetYaw, rawTargetYaw);
    const pitchToRaw = rawTargetPitch - smoothedTargetPitch;

    smoothedTargetYaw = wrapAngle(smoothedTargetYaw + yawToRaw * targetBlendSpeed);
    smoothedTargetPitch = smoothedTargetPitch + pitchToRaw * targetBlendSpeed;

    let yawDelta = getAngleDelta(currentYaw, smoothedTargetYaw);
    if (Math.abs(yawDelta) < YAW_DEAD_ZONE) {
        yawDelta = 0;
    }

    let pitchSpeed;
    let pitchDeadZone;

    if (isWalkingUpDown) {
        pitchSpeed = PITCH_WALKING_UPDOWN_SMOOTH_SPEED;
        pitchDeadZone = PITCH_WALKING_UPDOWN_DEAD_ZONE;
    } else if (isAirborne) {
        pitchSpeed = PITCH_AIRBORNE_SMOOTH_SPEED;
        pitchDeadZone = PITCH_DEAD_ZONE;
    } else {
        pitchSpeed = PITCH_SMOOTH_SPEED;
        pitchDeadZone = PITCH_DEAD_ZONE;
    }

    let pitchDelta = smoothedTargetPitch - currentPitch;
    if (Math.abs(pitchDelta) < pitchDeadZone) {
        pitchDelta = 0;
    }

    currentYaw = wrapAngle(currentYaw + yawDelta * YAW_SMOOTH_SPEED);
    currentPitch = currentPitch + pitchDelta * pitchSpeed;

    currentPitch = Math.max(MAX_ALLOWED_PITCH_UP, Math.min(MAX_ALLOWED_PITCH_DOWN, currentPitch));

    PathRotationsUtility.applyRotationWithGCD(currentYaw, currentPitch);

    // REMOVED: Recording was here at 120hz, now moved to tick handler above
}).setFps(120);

export function pathRotations(splineData) {
    const boxPositions = renderSplineBoxes(splineData, 1.5);
    const player = Player.getPlayer();
    if (!player) return;

    const playerEyes = player.getEyePos();

    if (boxPositions.length === 0 || currentBoxIndex >= boxPositions.length - 1) {
        if (!complete) {
            complete = true;
            rotationActive = false;
            Keybind.setKey('a', false);
            Keybind.setKey('d', false);
            if (ENABLE_RECORDING && RotationRecorder.isCurrentlyRecording()) {
                RotationRecorder.setPathRecording(false); // ADD THIS
                RotationRecorder.stopRecording();
                RotationRecorder.saveRecording();
            }
        }
        return;
    }

    updateMovementState();

    const pathAnalysis = analyzePathAhead(boxPositions, currentBoxIndex);

    updateStrafeState(boxPositions, currentBoxIndex, pathAnalysis);

    const stuckCheck = detectStuck(boxPositions, currentBoxIndex);
    if (stuckCheck === 'RECALCULATE') {
        complete = true;
        rotationActive = false;
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
        if (requestPathRecalculation) {
            requestPathRecalculation();
        }
        return;
    } else if (typeof stuckCheck === 'number') {
        currentBoxIndex = stuckCheck;
    }

    const newCurrentBoxIndex = findClosestBoxIndex(boxPositions, currentBoxIndex, playerEyes);
    currentBoxIndex = updateBoxIndex(newCurrentBoxIndex, currentBoxIndex);

    updateNodeSkipTracking(currentBoxIndex);

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

    const yawLookahead = calculateYawLookahead(boxPositions, currentPathPosition, pathAnalysis.isGradualSlope, pathAnalysis.hasSharpTurn);
    const pitchLookahead = calculatePitchLookahead(pathAnalysis.isGradualSlope, pathAnalysis.hasSharpTurn);

    const targetPathIndex = currentPathPosition + pitchLookahead;
    const targetYawPathIndex = currentPathPosition + yawLookahead;

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

    const { pitch: newRawPitch, yaw: newRawYaw } = MathUtils.calculateAbsoluteAngles(finalRotationTargetPoint);

    if (!isInitialized) {
        currentYaw = player.getYaw();
        currentPitch = player.getPitch();
        smoothedTargetYaw = newRawYaw;
        smoothedTargetPitch = newRawPitch;
        rawTargetYaw = newRawYaw;
        rawTargetPitch = newRawPitch;
        lastPlayerY = player.getY();
        lastBoxIndex = currentBoxIndex;
        isInitialized = true;
        rotationActive = true;

        PathRotationsUtility.resetGCDTracking();
        if (ENABLE_RECORDING) {
            RotationRecorder.setPathRecording(true);
            RotationRecorder.startRecording();
        }
    }

    rawTargetYaw = newRawYaw;
    rawTargetPitch = newRawPitch;

    const distanceToCurrentPoint = MathUtils.getDistanceToPlayerEyes(currentBox.x + 0.5, currentBox.y + 0.5, currentBox.z + 0.5);

    if (distanceToCurrentPoint < BASE_ADVANCE_DISTANCE / 2 && currentPathPosition > currentBoxIndex + 0.9) {
        currentBoxIndex = Math.min(currentBoxIndex + 1, boxPositions.length - 1);
        currentPathPosition = currentBoxIndex;
    }
}
