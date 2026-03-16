class SharedRotationGCD {
    constructor() {
        this.lastYaw = 0;
        this.lastPitch = 0;
        this.initialized = false;
        this.lastApplyAt = 0;
        this.DRIFT_RESYNC_MS = 120;
    }

    getMouseSensitivity() {
        try {
            return Client.getMinecraft().options.mouseSensitivity.value;
        } catch (e) {
            return 0.5;
        }
    }

    calculateGCD() {
        const sensitivity = this.getMouseSensitivity();
        if (!Number.isFinite(sensitivity)) return 0.15;
        const f = sensitivity * 0.6 + 0.2;
        return f * f * f * 1.2;
    }

    normalizeAngle(angle) {
        let result = angle;
        while (result > 180) result -= 360;
        while (result < -180) result += 360;
        return result;
    }

    getRotationDelta(from, to) {
        let delta = this.normalizeAngle(to) - this.normalizeAngle(from);
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }

    angleDifference(a, b) {
        return this.normalizeAngle(a - b);
    }

    aimModulo360(currentYaw, targetYaw) {
        return currentYaw + this.angleDifference(targetYaw, currentYaw);
    }

    applyGCD(rotation, prevRotation, gcd, min = null, max = null) {
        const delta = this.getRotationDelta(prevRotation, rotation);
        const roundedDelta = Math.round(delta / gcd) * gcd;
        let result = prevRotation + roundedDelta;

        if (max !== null && result > max) result -= gcd;
        if (min !== null && result < min) result += gcd;

        return result;
    }

    syncFromPlayer() {
        const player = Player.getPlayer();
        if (!player) return false;

        this.lastYaw = player.getYaw();
        this.lastPitch = player.getPitch();
        this.initialized = true;
        return true;
    }

    getCurrentRotation(player = Player.getPlayer()) {
        if (!player) return null;

        if (this.initialized) {
            const gcd = this.calculateGCD();
            const yawDrift = Math.abs(this.getRotationDelta(this.lastYaw, player.getYaw()));
            const pitchDrift = Math.abs(player.getPitch() - this.lastPitch);
            if (yawDrift > gcd * 2 || pitchDrift > gcd * 2) {
                this.lastYaw = player.getYaw();
                this.lastPitch = player.getPitch();
            }
        }

        return {
            yaw: this.initialized ? this.lastYaw : player.getYaw(),
            pitch: this.initialized ? this.lastPitch : player.getPitch(),
        };
    }

    applyToPlayer(yaw, pitch) {
        const player = Player.getPlayer();
        if (!player) return null;

        const now = Date.now();
        const gcd = this.calculateGCD();

        if (!this.initialized) {
            this.syncFromPlayer();
        } else if (now - this.lastApplyAt > this.DRIFT_RESYNC_MS) {
            const playerYaw = player.getYaw();
            const playerPitch = player.getPitch();
            const yawDrift = Math.abs(this.getRotationDelta(this.lastYaw, playerYaw));
            const pitchDrift = Math.abs(playerPitch - this.lastPitch);

            if (yawDrift > gcd * 2 || pitchDrift > gcd * 2) {
                this.lastYaw = playerYaw;
                this.lastPitch = playerPitch;
            }
        }

        const safeYaw = this.normalizeAngle(yaw);
        const safePitch = Math.max(-90, Math.min(90, pitch));
        const wrappedYaw = this.aimModulo360(this.lastYaw, safeYaw);
        const gcdYaw = this.applyGCD(wrappedYaw, this.lastYaw, gcd);
        const gcdPitch = this.applyGCD(safePitch, this.lastPitch, gcd, -90, 90);

        this.lastYaw = gcdYaw;
        this.lastPitch = gcdPitch;
        this.lastApplyAt = now;

        player.setYaw(gcdYaw);
        player.setPitch(gcdPitch);

        return { yaw: gcdYaw, pitch: gcdPitch };
    }
}

export const RotationGCD = new SharedRotationGCD();
