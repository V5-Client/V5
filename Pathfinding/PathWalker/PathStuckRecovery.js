import { PathfindingMessages } from '../PathConfig';
import { Vec3d } from '../../Utility/Constants';

let lastPlayerPos = null;
let ticksWithoutMovement = 0;
let recoveryAttempts = 0;
let recoveryLockTicks = 0;

const MIN_MOVEMENT_THRESHOLD = 0.12;
const RECOVERY_ATTEMPT_INTERVALS = [20, 40, 60];
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_LOCK_DURATION = 20;
const SEVERE_STUCK_THRESHOLD = 100;
const BOX_SEARCH_RANGE = 15;

const boxDistanceCache = new Map();
let cacheFrame = 0;

register('tick', () => {
    cacheFrame++;
    if (boxDistanceCache.size > 500) boxDistanceCache.clear();
});

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

function findRecoveryBox(boxPositions, currentIndex, playerX, playerY, playerZ) {
    if (!boxPositions || boxPositions.length === 0) return null;

    let bestIndex = null;
    let bestScore = -Infinity;

    const startIndex = Math.max(0, currentIndex - BOX_SEARCH_RANGE);
    const endIndex = Math.min(boxPositions.length, currentIndex + BOX_SEARCH_RANGE);

    for (let i = startIndex; i < endIndex; i++) {
        if (i === currentIndex) continue;

        const box = boxPositions[i];
        const distance = getCachedBoxDistance(playerX, playerY, playerZ, box);

        // Skip boxes too close or too far
        if (distance < 1.0 || distance > 20) continue;

        // Score: prefer reasonable distance + forward progress
        const distanceScore = 1 / Math.max(distance, 0.1);
        const progressBonus = i > currentIndex ? 1.5 : 0.8;
        const score = distanceScore * progressBonus;

        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }

    return bestIndex;
}

export function detectStuck(boxPositions, currentBoxIndex) {
    if (!boxPositions || boxPositions.length === 0) return null;

    if (recoveryLockTicks > 0) {
        recoveryLockTicks--;
        ticksWithoutMovement++;
        return null;
    }

    const playerX = Player.getX();
    const playerY = Player.getY();
    const playerZ = Player.getZ();

    if (!lastPlayerPos) {
        lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
        ticksWithoutMovement = 0;
        recoveryAttempts = 0;
        return null;
    }

    const distanceMoved = getDistance3D(playerX, playerY, playerZ, lastPlayerPos.x, lastPlayerPos.y, lastPlayerPos.z);

    if (distanceMoved > MIN_MOVEMENT_THRESHOLD) {
        lastPlayerPos = new Vec3d(playerX, playerY, playerZ);
        ticksWithoutMovement = 0;
        recoveryAttempts = 0;
        return null;
    }

    ticksWithoutMovement++;

    if (ticksWithoutMovement >= SEVERE_STUCK_THRESHOLD) {
        PathfindingMessages(`§4[Stuck] Severe (${ticksWithoutMovement} ticks) - requesting path recalculation`);
        resetStuckDetection();
        return 'RECALCULATE';
    }

    if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        const threshold = RECOVERY_ATTEMPT_INTERVALS[recoveryAttempts];

        if (ticksWithoutMovement >= threshold) {
            recoveryAttempts++;

            const newIndex = findRecoveryBox(boxPositions, currentBoxIndex, playerX, playerY, playerZ);

            if (newIndex !== null) {
                const box = boxPositions[newIndex];
                const distance = getCachedBoxDistance(playerX, playerY, playerZ, box);

                PathfindingMessages(
                    `§e[Recovery] Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} - Box ${newIndex} (${distance.toFixed(
                        1
                    )}m) [${ticksWithoutMovement} ticks stuck]`
                );

                recoveryLockTicks = RECOVERY_LOCK_DURATION;
                lastPlayerPos = new Vec3d(playerX, playerY, playerZ);

                return newIndex;
            }

            PathfindingMessages(`§c[Recovery] Attempt ${recoveryAttempts} - No suitable box found [${ticksWithoutMovement} ticks stuck]`);
        }
    }

    return null;
}

export function resetStuckDetection() {
    lastPlayerPos = null;
    ticksWithoutMovement = 0;
    recoveryAttempts = 0;
    recoveryLockTicks = 0;
    boxDistanceCache.clear();
}

export function getStuckInfo() {
    return {
        ticksStuck: ticksWithoutMovement,
        attempts: recoveryAttempts,
        locked: recoveryLockTicks > 0,
    };
}
