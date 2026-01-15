import { Keybind } from '../../player/Keybinding';
import { isInRecoveryMode, getRecoveryMovement } from './PathStuckRecovery';

let consecutiveAirborneTicks = 0;
let isFalling = false;
let shouldLimitRotations = false;

const FALL_DETECTION_TICKS = 3;
const OVERSHOOT_ANGLE_THRESHOLD = 85;
const CLOSE_HORIZONTAL_THRESHOLD = 1.5;

let currentTargetBox = null;

export function setMovementTarget(box) {
    currentTargetBox = box;
}

export function clearMovementTarget() {
    currentTargetBox = null;
}

export function getShouldLimitRotations() {
    return shouldLimitRotations;
}

export function resetMovementState() {
    consecutiveAirborneTicks = 0;
    isFalling = false;
    shouldLimitRotations = false;
    currentTargetBox = null;
}

function calculateMovementDecision() {
    const player = Player.getPlayer();
    if (!player || !currentTargetBox) {
        return { holdForward: true, limitRotation: false };
    }

    const playerX = Player.getX();
    const playerZ = Player.getZ();

    const targetX = currentTargetBox.x + 0.5;
    const targetZ = currentTargetBox.z + 0.5;

    const dx = targetX - playerX;
    const dz = targetZ - playerZ;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    if (horizDist < CLOSE_HORIZONTAL_THRESHOLD) {
        return { holdForward: false, limitRotation: true };
    }

    const playerYaw = player.getYaw();
    const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);

    let angleDiff = targetYaw - playerYaw;
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;
    angleDiff = Math.abs(angleDiff);

    if (angleDiff > OVERSHOOT_ANGLE_THRESHOLD) {
        return { holdForward: false, limitRotation: true };
    }

    return { holdForward: true, limitRotation: false };
}

export function PathMovement(on = true) {
    if (isInRecoveryMode()) {
        const recoveryMovement = getRecoveryMovement();
        Keybind.setKey('w', recoveryMovement.forward);
        Keybind.setKey('s', recoveryMovement.backward);
        consecutiveAirborneTicks = 0;
        isFalling = false;
        shouldLimitRotations = false;
        return;
    }

    if (!on) {
        Keybind.stopMovement();
        consecutiveAirborneTicks = 0;
        isFalling = false;
        shouldLimitRotations = false;
        return;
    }

    const player = Player.getPlayer();
    if (!player) {
        Keybind.setKey('w', true);
        Keybind.setKey('s', false);
        shouldLimitRotations = false;
        return;
    }

    const onGround = player.isOnGround();

    if (onGround) {
        consecutiveAirborneTicks = 0;
        isFalling = false;
        shouldLimitRotations = false;
        Keybind.setKey('w', true);
        Keybind.setKey('s', false);
        return;
    }

    consecutiveAirborneTicks++;

    const yVelocity = Player.getMotionY();
    isFalling = yVelocity < -0.1;

    if (consecutiveAirborneTicks >= FALL_DETECTION_TICKS && isFalling) {
        const decision = calculateMovementDecision();
        shouldLimitRotations = decision.limitRotation;
        Keybind.setKey('w', decision.holdForward);
        Keybind.setKey('s', false);
    } else {
        // Still in jump ascent or just started falling
        shouldLimitRotations = false;
        Keybind.setKey('w', true);
        Keybind.setKey('s', false);
    }
}
