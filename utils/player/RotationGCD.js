class SharedRotationGCD {
    constructor() {
        this.lastYaw = 0;
        this.lastPitch = 0;
        this.initialized = false;
        this.lastApplyAt = 0;
        this.DRIFT_RESYNC_MS = 120;
    }

    calculateGCD() {
        const sensitivity = Client.getMinecraft().options.sensitivity().get();
        const f = sensitivity * 0.6 + 0.2;
        return f * f * f * 1.2;
    }

    normalizeAngle(angle) {
        return (((angle % 360) + 540) % 360) - 180;
    }

    clampPitch(pitch) {
        return Math.max(-90, Math.min(90, pitch));
    }

    angleDifference(a, b) {
        return this.normalizeAngle(a - b);
    }

    aimModulo360(currentYaw, targetYaw) {
        if (!Number.isFinite(currentYaw)) return this.normalizeAngle(targetYaw);
        if (!Number.isFinite(targetYaw)) return this.normalizeAngle(currentYaw);
        return currentYaw + this.angleDifference(targetYaw, currentYaw);
    }

    applyGCD(delta, prevRotation, gcd, min = null, max = null) {
        if (!Number.isFinite(delta) || !Number.isFinite(gcd) || gcd <= 0) return prevRotation;
        const roundedDelta = Math.round(delta / gcd) * gcd;
        let result = prevRotation + roundedDelta;

        if (max !== null && result > max) result -= gcd;
        if (min !== null && result < min) result += gcd;

        return result;
    }

    syncFromPlayer(yaw = null, pitch = null, player = Player.getPlayer()) {
        if (!player) return false;

        this.lastYaw = Number.isFinite(yaw) ? yaw : this.normalizeAngle(player.getYRot());
        this.lastPitch = Number.isFinite(pitch) ? this.clampPitch(pitch) : this.clampPitch(player.getXRot());
        this.initialized = true;
        return true;
    }

    resyncIfDrifted(player, gcd) {
        const yawDrift = Math.abs(this.angleDifference(this.lastYaw, this.normalizeAngle(player.getYRot())));
        const pitchDrift = Math.abs(player.getXRot() - this.lastPitch);

        if (yawDrift > gcd * 2 || pitchDrift > gcd * 2) {
            this.lastYaw = this.normalizeAngle(player.getYRot());
            this.lastPitch = player.getXRot();
        }
    }

    getCurrentRotation(player = Player.getPlayer()) {
        if (!player) return null;

        if (this.initialized) {
            this.resyncIfDrifted(player, this.calculateGCD());
        }

        return {
            yaw: this.initialized ? this.lastYaw : this.normalizeAngle(player.getYRot()),
            pitch: this.initialized ? this.lastPitch : player.getXRot(),
        };
    }

    applyToPlayer(yaw, pitch) {
        const player = Player.getPlayer();
        if (!player) return null;
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;

        const now = Date.now();
        const gcd = this.calculateGCD();

        if (!this.initialized) {
            this.syncFromPlayer();
        } else if (now - this.lastApplyAt > this.DRIFT_RESYNC_MS) {
            this.resyncIfDrifted(player, gcd);
        }

        const gcdYaw = this.applyGCD(this.angleDifference(yaw, this.lastYaw), this.lastYaw, gcd);
        const gcdPitch = this.applyGCD(this.clampPitch(pitch) - this.clampPitch(this.lastPitch), this.clampPitch(this.lastPitch), gcd, -90, 90);

        this.lastYaw = gcdYaw;
        this.lastPitch = gcdPitch;
        this.lastApplyAt = now;

        player.setYRot(gcdYaw);
        player.setXRot(gcdPitch);

        return { yaw: gcdYaw, pitch: gcdPitch };
    }
}

export const RotationGCD = new SharedRotationGCD();
