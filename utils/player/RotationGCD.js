const DRIFT_RESYNC_MS = 120;
let lastYaw = 0;
let lastPitch = 0;
let initialized = false;
let lastApplyAt = 0;

export function calculateGCD() {
    const sensitivity = Client.getMinecraft().options.sensitivity().get();
    const scaled = sensitivity * 0.6 + 0.2;
    return scaled ** 3 * 1.2;
}

const normalizeAngle = (angle) => (((angle % 360) + 540) % 360) - 180;
export const clampPitch = (pitch) => Math.max(-90, Math.min(90, pitch));
export const angleDifference = (a, b) => normalizeAngle(a - b);

export function aimModulo360(currentYaw, targetYaw) {
    if (!Number.isFinite(currentYaw)) return targetYaw;
    if (!Number.isFinite(targetYaw)) return currentYaw;
    return currentYaw + angleDifference(targetYaw, currentYaw);
}

const applyGCD = (delta, previous, gcd, min = null, max = null) => {
    if (!Number.isFinite(delta) || !Number.isFinite(gcd) || gcd <= 0) return previous;
    let result = previous + Math.round(delta / gcd) * gcd;
    if (max !== null && result > max) result -= gcd;
    if (min !== null && result < min) result += gcd;
    return result;
};

export function syncFromPlayer(yaw = null, pitch = null, player = Player.getPlayer()) {
    if (!player) return false;
    const playerYaw = player.getYRot();
    lastYaw = Number.isFinite(yaw) ? aimModulo360(playerYaw, yaw) : playerYaw;
    lastPitch = Number.isFinite(pitch) ? clampPitch(pitch) : clampPitch(player.getXRot());
    initialized = true;
    return true;
}

const resyncIfDrifted = (player, gcd) => {
    const playerYaw = player.getYRot();
    const playerPitch = player.getXRot();
    if (Math.abs(angleDifference(lastYaw, playerYaw)) > gcd * 2 || Math.abs(playerYaw - lastYaw) > 180 || Math.abs(playerPitch - lastPitch) > gcd * 2) {
        lastYaw = playerYaw;
        lastPitch = playerPitch;
    }
};

export function getCurrentRotation(player = Player.getPlayer()) {
    if (!player) return null;
    if (initialized) resyncIfDrifted(player, calculateGCD());
    return { yaw: initialized ? lastYaw : player.getYRot(), pitch: initialized ? lastPitch : player.getXRot() };
}

export function applyToPlayer(yaw, pitch) {
    const player = Player.getPlayer();
    if (!player || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;

    const now = Date.now();
    const gcd = calculateGCD();
    if (!initialized) syncFromPlayer();
    else if (now - lastApplyAt > DRIFT_RESYNC_MS) resyncIfDrifted(player, gcd);

    lastYaw = applyGCD(angleDifference(yaw, lastYaw), lastYaw, gcd);
    lastPitch = applyGCD(clampPitch(pitch) - clampPitch(lastPitch), clampPitch(lastPitch), gcd, -90, 90);
    lastApplyAt = now;
    player.setYRot(lastYaw);
    player.setXRot(lastPitch);
    return { yaw: lastYaw, pitch: lastPitch };
}
