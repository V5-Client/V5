import { RotationGCD } from './player/RotationGCD';
import { Utils } from './Utils';

const MIN_DURATION_MS = 50;
const MAX_DURATION_MS = 240;
const OVERSHOOT_DEGREES = 18;
const MAX_OVERSHOOT = 3.2;
const MAX_CURVE = 7;

class EtherwarpRotationController {
    constructor() {
        this.active = false;
        this.onDone = null;
        this.startTime = 0;
        this.startYaw = 0;
        this.startPitch = 0;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.yawDiff = 0;
        this.pitchDiff = 0;
        this.overshootYaw = 0;
        this.overshootPitch = 0;
        this.curveYaw = 0;
        this.curvePitch = 0;
        this.ballisticMs = 0;
        this.correctMs = 0;
        this.phase = 'ballistic';
        this.correctStart = 0;
        this.timeoutMs = MAX_DURATION_MS;
        this.speed = 50;
        this.reactionMs = 50;
        register('postRenderWorld', () => this.update());
    }

    get isRotating() {
        return this.active;
    }

    lookAtAngles(yaw, pitch, onDone) {
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return false;
        const player = Player.getPlayer();
        const current = RotationGCD.getCurrentRotation(player);
        if (!player || !current) return false;

        this.clear(false);
        this.targetYaw = RotationGCD.aimModulo360(current.yaw, yaw);
        this.targetPitch = RotationGCD.clampPitch(pitch);
        this.startYaw = current.yaw;
        this.startPitch = current.pitch;
        this.yawDiff = this.targetYaw - this.startYaw;
        this.pitchDiff = this.targetPitch - this.startPitch;
        this.onDone = typeof onDone === 'function' ? onDone : null;

        const distance = Math.hypot(this.yawDiff, this.pitchDiff);
        const precision = this.getPrecision();
        if (distance <= precision) {
            RotationGCD.applyToPlayer(this.targetYaw, this.targetPitch);
            this.complete();
            return true;
        }

        const inv = 1 / distance;
        const overshoot = distance > OVERSHOOT_DEGREES ? Math.min(MAX_OVERSHOOT, distance * 0.035) : 0;
        const curve = Math.min(MAX_CURVE, distance * 0.12) * (Math.random() < 0.5 ? -1 : 1);
        const scale = this.getDurationScale();
        const durationMs = Math.max(MIN_DURATION_MS * scale, Math.min(MAX_DURATION_MS * scale, (45 + distance * 1.8) * scale));
        this.timeoutMs = durationMs + Math.max(80, durationMs * 0.35);

        this.overshootYaw = this.yawDiff * inv * overshoot;
        this.overshootPitch = this.pitchDiff * inv * overshoot;
        this.curveYaw = -this.pitchDiff * inv * curve;
        this.curvePitch = this.yawDiff * inv * curve * 0.4;
        this.ballisticMs = overshoot > 0 ? durationMs * 0.72 : durationMs;
        this.correctMs = overshoot > 0 ? durationMs * 0.28 : 0;
        this.phase = 'ballistic';
        this.startTime = Date.now();
        this.correctStart = 0;
        this.active = true;
        return true;
    }

    lookAtVector(vector, onDone) {
        const angles = this.getAnglesFromVector(vector);
        if (!angles) return false;
        return this.lookAtAngles(angles.yaw, angles.pitch, onDone);
    }

    stop() {
        this.clear(false);
    }

    update() {
        if (!this.active) return;

        const player = Player.getPlayer();
        const current = RotationGCD.getCurrentRotation(player);
        if (!player || !current) {
            this.clear(false);
            return;
        }

        const now = Date.now();
        const elapsed = now - this.startTime;
        const remaining = Math.hypot(this.targetYaw - current.yaw, this.targetPitch - current.pitch);
        if (remaining <= this.getPrecision() || elapsed >= this.timeoutMs) {
            RotationGCD.applyToPlayer(this.targetYaw, this.targetPitch);
            this.complete();
            return;
        }

        let yaw;
        let pitch;
        if (this.phase === 'ballistic') {
            const t = Math.min(1, elapsed / Math.max(1, this.ballisticMs));
            const eased = this.easeProgress(t);
            const curve = Math.sin(Math.PI * t);
            yaw = this.startYaw + (this.yawDiff + this.overshootYaw) * eased + this.curveYaw * curve;
            pitch = this.startPitch + (this.pitchDiff + this.overshootPitch) * eased + this.curvePitch * curve;
            if (t >= 1) {
                if (this.correctMs <= 0) {
                    RotationGCD.applyToPlayer(this.targetYaw, this.targetPitch);
                    this.complete();
                    return;
                }
                this.phase = 'correcting';
                this.correctStart = now;
            }
        } else {
            const t = Math.min(1, (now - this.correctStart) / Math.max(1, this.correctMs));
            const eased = this.easeProgress(t, 2);
            yaw = this.targetYaw + this.overshootYaw * (1 - eased);
            pitch = this.targetPitch + this.overshootPitch * (1 - eased);
            if (t >= 1) {
                RotationGCD.applyToPlayer(this.targetYaw, this.targetPitch);
                this.complete();
                return;
            }
        }

        RotationGCD.applyToPlayer(yaw, RotationGCD.clampPitch(pitch));
    }

    getPrecision() {
        return Math.max(0.05, RotationGCD.calculateGCD() / Math.SQRT2);
    }

    getClampedSpeed() {
        return Math.max(20, Math.min(80, Number(this.speed) || 50));
    }

    getDurationScale() {
        const speed = this.getClampedSpeed();
        if (speed >= 50) return 50 / speed;
        return Math.pow(50 / speed, 2.15);
    }

    easeProgress(t, fastPower = 3) {
        const speed = this.getClampedSpeed();
        const power = speed >= 50 ? fastPower : 1 + ((speed - 20) / 30) * (fastPower - 1);
        return 1 - (1 - Math.max(0, Math.min(1, t))) ** power;
    }

    getAnglesFromVector(vector) {
        const vec = Utils.convertToVector(vector);
        const player = Player.getPlayer();
        if (!vec || !player) return null;

        const eyes = player.getEyePosition();
        const dx = vec.x() - player.getX();
        const dy = vec.y() - eyes.y();
        const dz = vec.z() - player.getZ();
        const horizontal = Math.hypot(dx, dz);
        return {
            yaw: horizontal <= 0.0001 ? player.getYRot() : Math.atan2(-dx, dz) * (180 / Math.PI),
            pitch: RotationGCD.clampPitch(Math.atan2(-dy, horizontal) * (180 / Math.PI)),
        };
    }

    complete() {
        const callback = this.onDone;
        this.clear(false);
        if (typeof callback !== 'function') return;
        try {
            callback();
        } catch (error) {
            console.error('V5 Caught error' + error + error.stack);
        }
    }

    clear(runCallback) {
        const callback = runCallback ? this.onDone : null;
        this.active = false;
        this.onDone = null;
        this.phase = 'ballistic';
        this.startTime = 0;
        this.correctStart = 0;
        if (typeof callback !== 'function') return;
        try {
            callback();
        } catch (error) {
            console.error('V5 Caught error' + error + error.stack);
        }
    }
}

export const EtherwarpRotations = new EtherwarpRotationController();
