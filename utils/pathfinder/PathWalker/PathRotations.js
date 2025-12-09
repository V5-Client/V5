import * as RotationRecorder from './RotationRecorder';
const ENABLE_RECORDING = true;

import { MathUtils } from '../../Math';
import { PathRotationsUtility } from './PathRotationsUtility';
import { renderSplineBoxes } from '../PathDebug';
import { detectStuck, resetStuckDetection } from './PathStuckRecovery';
import { Utils } from '../../Utils';
import { Keybind } from '../../player/Keybinding';
import { PathfindingMessages } from '../PathConfig';

// Lookahead ╭( ๐_๐)╮ these need to be adjusted. Rn it's good for GETTING there, but it over rotates on difficult terrain (/path -128 200 -36 from the bottom, its so shitty)
const LOOK_AHEAD_DISTANCE = 4;
const BASE_YAW_AHEAD_DISTANCE = 4;
const YAW_AHEAD_JUMP_MULTIPLIER = 1.3;
const YAW_LOOKAHEAD_SMOOTHING = 0.2;

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

// change these to improve fall rotations, it smooths out the node skipping (falls usually make it go from like node 20 to 80 instantly)
const NODE_SKIP_THRESHOLD = 6;
const TARGET_BLEND_NORMAL = 0.4;
const TARGET_BLEND_SKIP = 0.15;
const SKIP_RECOVERY_TICKS = 15;

const BASE_ADVANCE_DISTANCE = 1.0;
const MIN_ADVANCE_DISTANCE = 0.3;
const BOX_RESET_SEARCH_RANGE = 20;
const BOX_SWITCH_HYSTERESIS = 3;

// difficulty shit. based on nodes, not player
const DIFFICULTY_LOOKAHEAD = 8;
const SHARP_TURN_THRESHOLD_DEG = 55;
const VERY_SHARP_TURN_THRESHOLD_DEG = 100;
const LEDGE_Y_THRESHOLD = 0.5;
const STRAFE_LEDGE_Y_THRESHOLD = 1;

const MIN_YAW_LOOKAHEAD = 1.5;
const MIN_PITCH_LOOKAHEAD = 1.5;

const STRAFE_ENABLE_COLLISION_TICKS = 6;
const STRAFE_ANGLE_THRESHOLD = 30;
const STRAFE_DURATION_AFTER_UNCOLLIDE = 6;

// useless. why is this still here?
const MAX_ALLOWED_PITCH_DOWN = 89.9;
const MAX_ALLOWED_PITCH_UP = -89.9;

// states should be moved into pathstate later? this is just here cuz im
let currentBoxIndex = 1;
let currentPathPosition = 1.0;
let isInitialized = false;
let complete = false;
let smoothedYawLookahead = BASE_YAW_AHEAD_DISTANCE;

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
let lastNodeSkipAmount = 0;

let currentDifficulty = 0;
let upcomingSharpTurn = false;
let upcomingLedge = false;
let smoothedDifficulty = 0;

let collisionTicks = 0;
let isStrafing = false;
let strafeDirection = 0;
let strafeHoldTicks = 0;

let rotationActive = false;

export function PathComplete() {
    return complete;
}

export function ResetRotations() {
    currentBoxIndex = 1;
    currentPathPosition = 1.0;
    isInitialized = false;
    complete = false;
    smoothedYawLookahead = BASE_YAW_AHEAD_DISTANCE;
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
    lastNodeSkipAmount = 0;

    currentDifficulty = 0;
    upcomingSharpTurn = false;
    upcomingLedge = false;
    smoothedDifficulty = 0;

    collisionTicks = 0;
    isStrafing = false;
    strafeDirection = 0;
    strafeHoldTicks = 0;
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

function analyzePathAhead(boxPositions, currentIndex) {
    const result = {
        maxAngle: 0,
        totalYChange: 0,
        maxSingleYChange: 0,
        hasLedge: false,
        hasSharpTurn: false,
        hasVerySharpTurn: false,
        difficulty: 0,
        turnDirection: 0,
        firstDifficultIndex: -1,
        shouldAllowStrafe: false,
    };

    if (!boxPositions || currentIndex >= boxPositions.length - 2) {
        return result;
    }

    const endIndex = Math.min(currentIndex + DIFFICULTY_LOOKAHEAD, boxPositions.length - 1);

    for (let i = currentIndex; i < endIndex - 1; i++) {
        const box0 = boxPositions[i];
        const box1 = boxPositions[i + 1];
        const box2 = i + 2 < boxPositions.length ? boxPositions[i + 2] : null;

        const yDiff = box1.y - box0.y;
        if (yDiff > 0) {
            result.totalYChange += yDiff;
            if (yDiff > result.maxSingleYChange) {
                result.maxSingleYChange = yDiff;
            }
        }

        if (yDiff > LEDGE_Y_THRESHOLD) {
            result.hasLedge = true;
            if (result.firstDifficultIndex === -1) {
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

    const turnDifficulty = Math.min(1, result.maxAngle / 90);
    const ledgeDifficulty = result.hasLedge ? Math.min(1, result.totalYChange / 1.5) : 0;

    const comboMultiplier = result.hasLedge && result.hasSharpTurn ? 1.4 : 1.0;
    result.difficulty = Math.min(1, (turnDifficulty + ledgeDifficulty) * comboMultiplier);

    result.shouldAllowStrafe = result.hasVerySharpTurn && result.maxSingleYChange >= STRAFE_LEDGE_Y_THRESHOLD;

    return result;
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

    const shouldConsiderStrafe = pathAnalysis.shouldAllowStrafe;

    if (isCollided && collisionTicks >= STRAFE_ENABLE_COLLISION_TICKS && shouldConsiderStrafe) {
        const newDirection = calculateStrafeDirection(boxPositions, currentIndex, pathAnalysis);

        if (newDirection !== 0) {
            strafeDirection = newDirection;
            isStrafing = true;
            strafeHoldTicks = STRAFE_DURATION_AFTER_UNCOLLIDE;
            PathfindingMessages(
                `§7[Strafe] Enabled: dir=${strafeDirection > 0 ? 'right' : 'left'}, angle=${pathAnalysis.maxAngle.toFixed(
                    1
                )}°, yChange=${pathAnalysis.maxSingleYChange.toFixed(2)}`
            );
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
        lastNodeSkipAmount = skipAmount;
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

function getAdvanceDistance() {
    return BASE_ADVANCE_DISTANCE - (BASE_ADVANCE_DISTANCE - MIN_ADVANCE_DISTANCE) * smoothedDifficulty;
}

function getAdjustedYawLookahead() {
    const base = isAirborne ? BASE_YAW_AHEAD_DISTANCE * YAW_AHEAD_JUMP_MULTIPLIER : BASE_YAW_AHEAD_DISTANCE;
    return base - (base - MIN_YAW_LOOKAHEAD) * smoothedDifficulty;
}

function getAdjustedPitchLookahead() {
    return LOOK_AHEAD_DISTANCE - (LOOK_AHEAD_DISTANCE - MIN_PITCH_LOOKAHEAD) * smoothedDifficulty;
}

function isAlignedForAdvance(boxPositions, currentIndex, playerYaw) {
    if (currentIndex + 2 >= boxPositions.length) return true;

    const current = boxPositions[currentIndex];
    const next = boxPositions[currentIndex + 1];

    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    if (len < 0.1) return true;

    const pathYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
    const yawDiff = Math.abs(getAngleDelta(playerYaw, pathYaw));

    const maxAllowedDiff = 90 - 50 * smoothedDifficulty;

    return yawDiff < maxAllowedDiff;
}

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

    player.setYaw(currentYaw);
    player.setPitch(currentPitch);

    if (ENABLE_RECORDING && RotationRecorder.isCurrentlyRecording()) {
        RotationRecorder.recordRotation(currentYaw, currentPitch);
    }
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
                RotationRecorder.stopRecording();
                RotationRecorder.saveRecording();
            }
        }
        return;
    }

    updateMovementState();

    const pathAnalysis = analyzePathAhead(boxPositions, currentBoxIndex);
    currentDifficulty = pathAnalysis.difficulty;
    upcomingSharpTurn = pathAnalysis.hasSharpTurn;
    upcomingLedge = pathAnalysis.hasLedge;

    smoothedDifficulty += (currentDifficulty - smoothedDifficulty) * 0.15;

    updateStrafeState(boxPositions, currentBoxIndex, pathAnalysis);

    const stuckCheck = detectStuck(boxPositions, currentBoxIndex);
    if (stuckCheck === 'RECALCULATE') {
        complete = true;
        rotationActive = false;
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
        if (global.requestPathRecalculation) {
            global.requestPathRecalculation();
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

    const adjustedYawLookahead = getAdjustedYawLookahead();
    smoothedYawLookahead += (adjustedYawLookahead - smoothedYawLookahead) * YAW_LOOKAHEAD_SMOOTHING;

    const adjustedPitchLookahead = getAdjustedPitchLookahead();

    const targetPathIndex = currentPathPosition + adjustedPitchLookahead;
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

        if (ENABLE_RECORDING) {
            RotationRecorder.startRecording();
        }
    }

    rawTargetYaw = newRawYaw;
    rawTargetPitch = newRawPitch;

    const advanceDistance = getAdvanceDistance();
    const distanceToCurrentPoint = MathUtils.getDistanceToPlayerEyes(currentBox.x + 0.5, currentBox.y + 0.5, currentBox.z + 0.5);

    const alignedForAdvance = smoothedDifficulty < 0.2 || isAlignedForAdvance(boxPositions, currentBoxIndex, currentYaw);

    if (distanceToCurrentPoint < advanceDistance / 2 && currentPathPosition > currentBoxIndex + 0.9 && alignedForAdvance) {
        currentBoxIndex = Math.min(currentBoxIndex + 1, boxPositions.length - 1);
        currentPathPosition = currentBoxIndex;
    }
}
