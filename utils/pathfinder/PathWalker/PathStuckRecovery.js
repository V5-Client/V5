import { Vec3d } from '../../Constants';
import { Utils } from '../../Utils';
import { Keybind } from '../../player/Keybinding';
import { Chat } from '../../Chat';

let lastPlayerPos = null;
let ticksWithoutMovement = 0;
let recoveryAttempts = 0;
let recoveryLockTicks = 0;
let lastRecoveryStrategy = null;
let recoveryStartBoxIndex = -1;

const MIN_MOVEMENT_THRESHOLD = 0.12;
const MIN_MOVEMENT_THRESHOLD_COLLIDED = 0.05;

const RECOVERY_ATTEMPT_INTERVALS = [3, 14, 25];
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_LOCK_DURATION = 25;
const SEVERE_STUCK_THRESHOLD = 40;
const MIN_PROGRESS_BOXES = 2;

const JUMP_DURATION = 8;

const PHASE_BACKUP = 'backup';
const PHASE_JUMP = 'jump';
const PHASE_FORWARD = 'forward';

let isRecoveryJumping = false;
let jumpRecoveryTicks = 0;

let inRecoveryMode = false;
let recoveryPhase = null;
let recoveryPhaseTicks = 0;
let backupDuration = 0;
let forwardDelay = 0;

let recoveryMovement = {
    forward: false,
    backward: false,
};

const boxDistanceCache = new Map();
let cacheFrame = 0;

register('tick', () => {
    cacheFrame++;
    if (boxDistanceCache.size > 500) boxDistanceCache.clear();

    if (inRecoveryMode) {
        updateRecoveryPhase();
    }

    if (jumpRecoveryTicks > 0) {
        jumpRecoveryTicks--;
        Keybind.setKey('space', true);
        isRecoveryJumping = true;

        if (jumpRecoveryTicks === 0) {
            isRecoveryJumping = false;
        }
    }
});

function updateRecoveryPhase() {
    recoveryPhaseTicks++;

    switch (recoveryPhase) {
        case PHASE_BACKUP:
            recoveryMovement.forward = false;
            recoveryMovement.backward = true;

            if (recoveryPhaseTicks >= backupDuration) {
                recoveryPhase = PHASE_JUMP;
                recoveryPhaseTicks = 0;
                recoveryMovement.backward = false;
                jumpRecoveryTicks = JUMP_DURATION;
                Chat.messagePathfinder(`§7[Recovery] Backup complete, jumping...`);
            }
            break;

        case PHASE_JUMP:
            recoveryMovement.forward = true;
            recoveryMovement.backward = false;

            if (recoveryPhaseTicks >= JUMP_DURATION + forwardDelay) {
                recoveryPhase = PHASE_FORWARD;
                recoveryPhaseTicks = 0;
                Chat.messagePathfinder(`§7[Recovery] Resuming forward movement`);
            }
            break;

        case PHASE_FORWARD:
            recoveryMovement.forward = true;
            recoveryMovement.backward = false;

            if (recoveryPhaseTicks >= 5) {
                endRecoveryMode();
            }
            break;
    }
}

function startRecoveryMode(backupTicks, forwardDelayTicks) {
    inRecoveryMode = true;
    backupDuration = backupTicks;
    forwardDelay = forwardDelayTicks;
    recoveryPhaseTicks = 0;

    if (backupTicks <= 0) {
        recoveryPhase = PHASE_JUMP;
        recoveryMovement = { forward: true, backward: false };
        jumpRecoveryTicks = JUMP_DURATION;
        Chat.messagePathfinder(`§7[Recovery] Jumping...`);
    } else {
        recoveryPhase = PHASE_BACKUP;
        recoveryMovement = { forward: false, backward: true };
        Chat.messagePathfinder(`§7[Recovery] Starting backup for ${backupTicks} ticks`);
    }
}

function endRecoveryMode() {
    inRecoveryMode = false;
    recoveryPhase = null;
    recoveryPhaseTicks = 0;
    recoveryMovement = { forward: false, backward: false };
}

export function isInRecoveryMode() {
    return inRecoveryMode;
}

export function getRecoveryMovement() {
    return recoveryMovement;
}

export function isStuckRecoveryJumping() {
    return isRecoveryJumping;
}

function getDistance3D(x1, y1, z1, x2, y2, z2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dz = z1 - z2;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getCachedBoxDistance(playerX, playerY, playerZ, box) {
    const key = `${Math.floor(playerX * 10)},${Math.floor(playerY * 10)},${Math.floor(playerZ * 10)},${box.x},${box.y},${box.z},${cacheFrame}`;

    if (!boxDistanceCache.has(key)) {
        const distance = getDistance3D(playerX, playerY, playerZ, box.x + 0.5, box.y + 0.5, box.z + 0.5);
        boxDistanceCache.set(key, distance);
    }

    return boxDistanceCache.get(key);
}

function tryJumpOnly(currentBoxIndex, boxPositions, playerX, playerY, playerZ) {
    const targetIndex = Math.max(0, currentBoxIndex - 1);
    const box = boxPositions[targetIndex];
    const distance = getCachedBoxDistance(playerX, playerY, playerZ, box);

    Chat.messagePathfinder(`§e[Recovery 1/${MAX_RECOVERY_ATTEMPTS}] Jump only (${distance.toFixed(1)}m away, box ${targetIndex})`);

    startRecoveryMode(0, 3);

    lastRecoveryStrategy = 'JUMP_ONLY';
    return targetIndex;
}

function tryBackupAndJump(currentBoxIndex, boxPositions, playerX, playerY, playerZ) {
    const backupBoxes = 3;
    const targetIndex = Math.max(0, currentBoxIndex - backupBoxes);

    const box = boxPositions[targetIndex];
    const distance = getCachedBoxDistance(playerX, playerY, playerZ, box);

    Chat.messagePathfinder(`§e[Recovery 2/${MAX_RECOVERY_ATTEMPTS}] Backing up ${backupBoxes} boxes + jump (${distance.toFixed(1)}m away, box ${targetIndex})`);

    startRecoveryMode(12, 4);

    lastRecoveryStrategy = 'BACKUP_JUMP';
    return targetIndex;
}

function tryMajorBackup(currentBoxIndex, boxPositions, playerX, playerY, playerZ) {
    const backupBoxes = 6;
    const targetIndex = Math.max(0, currentBoxIndex - backupBoxes);

    const box = boxPositions[targetIndex];
    const distance = getCachedBoxDistance(playerX, playerY, playerZ, box);

    Chat.messagePathfinder(`§e[Recovery 3/${MAX_RECOVERY_ATTEMPTS}] Major backup ${backupBoxes} boxes (${distance.toFixed(1)}m away, box ${targetIndex})`);

    startRecoveryMode(20, 5);

    lastRecoveryStrategy = 'MAJOR_BACKUP';
    return targetIndex;
}

export function detectStuck(boxPositions, currentBoxIndex) {
    if (!boxPositions || boxPositions.length === 0) return null;
    if (inRecoveryMode) return null;

    const playerX = Player.getX();
    const playerY = Player.getY();
    const playerZ = Player.getZ();

    if (!lastPlayerPos) {
        lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
        ticksWithoutMovement = 0;
        recoveryAttempts = 0;
        recoveryStartBoxIndex = -1;
        return null;
    }

    const distanceMoved = getDistance3D(playerX, playerY, playerZ, lastPlayerPos.x, lastPlayerPos.y, lastPlayerPos.z);

    const isCollided = Utils.playerIsCollided();
    const movementThreshold = isCollided ? MIN_MOVEMENT_THRESHOLD_COLLIDED : MIN_MOVEMENT_THRESHOLD;

    if (recoveryLockTicks > 0) {
        recoveryLockTicks--;
        ticksWithoutMovement++;

        if (recoveryLockTicks === 0) {
            const madeProgress = currentBoxIndex >= recoveryStartBoxIndex + MIN_PROGRESS_BOXES;

            if (madeProgress) {
                Chat.messagePathfinder(`§a[Recovery] Success! Advanced from box ${recoveryStartBoxIndex} to ${currentBoxIndex}`);
                lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
                ticksWithoutMovement = 0;
                recoveryAttempts = 0;
                recoveryStartBoxIndex = -1;
                return null;
            } else {
                Chat.messagePathfinder(`§c[Recovery] Failed! Only at box ${currentBoxIndex} (started at ${recoveryStartBoxIndex})`);
                lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
            }
        }

        return null;
    }

    if (distanceMoved > movementThreshold) {
        lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
        ticksWithoutMovement = 0;
        recoveryAttempts = 0;
        recoveryStartBoxIndex = -1;
        return null;
    }

    ticksWithoutMovement++;

    if (ticksWithoutMovement >= SEVERE_STUCK_THRESHOLD) {
        Chat.messagePathfinder(`§4[Stuck] Severe (${ticksWithoutMovement} ticks) - requesting path recalculation`);
        resetStuckDetection();
        return 'RECALCULATE';
    }

    if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        const threshold = RECOVERY_ATTEMPT_INTERVALS[recoveryAttempts];

        if (ticksWithoutMovement >= threshold) {
            recoveryAttempts++;
            recoveryLockTicks = RECOVERY_LOCK_DURATION;
            recoveryStartBoxIndex = currentBoxIndex;
            lastPlayerPos = new Vec3d(playerX, playerY, playerZ);

            let result = null;

            if (recoveryAttempts === 1) {
                result = tryJumpOnly(currentBoxIndex, boxPositions, playerX, playerY, playerZ);
            } else if (recoveryAttempts === 2) {
                result = tryBackupAndJump(currentBoxIndex, boxPositions, playerX, playerY, playerZ);
            } else if (recoveryAttempts === 3) {
                result = tryMajorBackup(currentBoxIndex, boxPositions, playerX, playerY, playerZ);
            }

            return result;
        }
    }

    return null;
}

export function resetStuckDetection() {
    lastPlayerPos = null;
    ticksWithoutMovement = 0;
    recoveryAttempts = 0;
    recoveryLockTicks = 0;
    lastRecoveryStrategy = null;
    recoveryStartBoxIndex = -1;
    jumpRecoveryTicks = 0;
    isRecoveryJumping = false;
    boxDistanceCache.clear();

    endRecoveryMode();
}

export function getStuckInfo() {
    return {
        ticksStuck: ticksWithoutMovement,
        attempts: recoveryAttempts,
        locked: recoveryLockTicks > 0,
        strategy: lastRecoveryStrategy,
        isCollided: Utils.playerIsCollided(),
        isRecoveryJumping: isRecoveryJumping,
        recoveryStartBox: recoveryStartBoxIndex,
        inRecoveryMode: inRecoveryMode,
        recoveryPhase: recoveryPhase,
        recoveryPhaseTicks: recoveryPhaseTicks,
    };
}
