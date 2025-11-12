import { pathState } from './PathState';
import { PathfindingMessages } from '../PathConfig';

/**
 * Refine logic
 * Remove pathstate
 */

const STUCK_THRESHOLD_TICKS = 20;
const MIN_MOVEMENT_DISTANCE = 0.12;
const SEVERE_STUCK_THRESHOLD = 100;

const RECOVERY_ATTEMPT_INTERVALS = [15, 30, 40]; // Ticks before each recovery
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_LOCK_TICKS = 20;

const BACKWARDS_SEARCH_RANGE = 20;
const FORWARD_SEARCH_RANGE = 15;
const CLOSEST_SEARCH_RANGE = 10;

const recoveryState = {
    lastPosition: null,
    ticksWithoutMovement: 0,
    recoveryAttempts: 0,
    recoveryLockTicks: 0,
    hasRequestedRecalc: false,
};

function getDistance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getDistance2D(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function isBoxBehindPlayer(boxPos, playerPos, playerYaw) {
    const dx = boxPos.x - playerPos.x;
    const dz = boxPos.z - playerPos.z;
    const angleToBox = Math.atan2(-dx, dz) * (180 / Math.PI);
    const angleDiff = Math.abs(((angleToBox - playerYaw + 540) % 360) - 180);

    return angleDiff > 90;
}

function attemptBackwardRecovery(playerPos, playerYaw) {
    const { boxPositions, currentBoxIndex } = pathState;

    const startIndex = Math.max(0, currentBoxIndex - BACKWARDS_SEARCH_RANGE);

    for (let i = currentBoxIndex - 1; i >= startIndex; i--) {
        const box = boxPositions[i];
        const dist = getDistance3D(playerPos, box);
        // look for reasonable boxes
        if (dist > 1.5 && dist < 10 && isBoxBehindPlayer(box, playerPos, playerYaw)) {
            PathfindingMessages(`§e[Recovery] Retreating to box ${i} (${dist.toFixed(2)}m behind)`);
            pathState.currentBoxIndex = i;
            recoveryState.recoveryLockTicks = RECOVERY_LOCK_TICKS;
            return true;
        }
    }

    return false;
}

function attemptClosestBoxRecovery(playerPos) {
    const { boxPositions, currentBoxIndex } = pathState;

    let closestIndex = currentBoxIndex;
    let closestDist = Infinity;

    const startIndex = Math.max(0, currentBoxIndex - CLOSEST_SEARCH_RANGE);
    const endIndex = Math.min(boxPositions.length, currentBoxIndex + CLOSEST_SEARCH_RANGE);

    for (let i = startIndex; i < endIndex; i++) {
        const dist = getDistance3D(playerPos, boxPositions[i]);

        if (dist < closestDist && dist > 0.8 && dist < 15) {
            closestDist = dist;
            closestIndex = i;
        }
    }

    if (closestIndex !== currentBoxIndex && Math.abs(closestIndex - currentBoxIndex) > 2) {
        PathfindingMessages(`§c[Recovery] Jumping to closest box ${closestIndex} (${closestDist.toFixed(2)}m away)`);
        pathState.currentBoxIndex = closestIndex;
        recoveryState.recoveryLockTicks = RECOVERY_LOCK_TICKS;
        return true;
    }

    return false;
}

function attemptForwardSkipRecovery(playerPos) {
    const { boxPositions, currentBoxIndex } = pathState;

    const startIndex = currentBoxIndex + 3;
    const endIndex = Math.min(boxPositions.length, currentBoxIndex + FORWARD_SEARCH_RANGE);

    for (let i = startIndex; i < endIndex; i++) {
        const box = boxPositions[i];
        const dist = getDistance3D(playerPos, box);

        if (dist < 8) {
            PathfindingMessages(`§6[Recovery] Skipping forward to box ${i} (${dist.toFixed(2)}m ahead)`);
            pathState.currentBoxIndex = i;
            recoveryState.recoveryLockTicks = RECOVERY_LOCK_TICKS;
            return true;
        }
    }

    return false;
}

function performRecoveryAttempt(attemptNumber) {
    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };
    const playerYaw = Player.getYaw();

    PathfindingMessages(`§c[Stuck] Recovery attempt ${attemptNumber}/${MAX_RECOVERY_ATTEMPTS}`);

    switch (attemptNumber) {
        case 1:
            if (attemptBackwardRecovery(playerPos, playerYaw)) {
                return true;
            }
            return attemptClosestBoxRecovery(playerPos);

        case 2:
            if (attemptClosestBoxRecovery(playerPos)) {
                return true;
            }
            return attemptForwardSkipRecovery(playerPos);

        case 3:
            if (attemptForwardSkipRecovery(playerPos)) {
                return true;
            }
            return attemptClosestBoxRecovery(playerPos);

        default:
            return false;
    }
}

function requestPathRecalculation() {
    if (!global.pathEngineRecalculate) {
        PathfindingMessages('§c[Stuck] Path recalculation not available!');
        return false;
    }

    PathfindingMessages('§4[Stuck] Severely stuck - requesting path recalculation...');
    global.pathEngineRecalculate();
    recoveryState.hasRequestedRecalc = true;
    return true;
}

export function detectAndRecoverStuck() {
    if (recoveryState.recoveryLockTicks > 0) {
        recoveryState.recoveryLockTicks--;
        if (recoveryState.recoveryLockTicks === 0) {
            PathfindingMessages('§a[Recovery] Lock released, resuming normal navigation');
        }
        return { stuck: false, recovered: false };
    }

    const currentPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    if (!recoveryState.lastPosition) {
        recoveryState.lastPosition = currentPos;
        recoveryState.ticksWithoutMovement = 0;
        recoveryState.recoveryAttempts = 0;
        recoveryState.hasRequestedRecalc = false;
        return { stuck: false, recovered: false };
    }

    const distanceMoved = Math.hypot(
        currentPos.x - recoveryState.lastPosition.x,
        currentPos.y - recoveryState.lastPosition.y,
        currentPos.z - recoveryState.lastPosition.z
    );

    if (distanceMoved > MIN_MOVEMENT_DISTANCE) {
        recoveryState.lastPosition = currentPos;
        recoveryState.ticksWithoutMovement = 0;
        recoveryState.recoveryAttempts = 0;
        recoveryState.hasRequestedRecalc = false;
        return { stuck: false, recovered: false };
    }

    recoveryState.ticksWithoutMovement++;

    if (recoveryState.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        if (recoveryState.ticksWithoutMovement >= SEVERE_STUCK_THRESHOLD && !recoveryState.hasRequestedRecalc) {
            requestPathRecalculation();
        }
        return { stuck: true, recovered: false };
    }

    const nextAttemptThreshold = RECOVERY_ATTEMPT_INTERVALS[recoveryState.recoveryAttempts];

    if (recoveryState.ticksWithoutMovement === nextAttemptThreshold) {
        recoveryState.recoveryAttempts++;
        const recovered = performRecoveryAttempt(recoveryState.recoveryAttempts);

        if (recovered) {
            recoveryState.lastPosition = currentPos;
            recoveryState.ticksWithoutMovement = 0;
            return { stuck: true, recovered: true };
        } else {
            PathfindingMessages('§c[Recovery] No valid recovery found');
            return { stuck: true, recovered: false };
        }
    }

    if (recoveryState.ticksWithoutMovement >= STUCK_THRESHOLD_TICKS) {
        return { stuck: true, recovered: false };
    }

    return { stuck: false, recovered: false };
}

export function resetStuckRecovery() {
    recoveryState.lastPosition = null;
    recoveryState.ticksWithoutMovement = 0;
    recoveryState.recoveryAttempts = 0;
    recoveryState.recoveryLockTicks = 0;
    recoveryState.hasRequestedRecalc = false;
}

export function getRecoveryState() {
    return { ...recoveryState };
}
