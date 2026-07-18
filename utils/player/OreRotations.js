import { Utils } from '../Utils';
import { RotationGCD } from './RotationGCD';

class OreRotationController {
    constructor() {
        this.active = false;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.initialYawDistance = 0;
        this.initialPitchDistance = 0;
        this.step = 0;
        this.warmupSteps = 5;
        this.speed = 0.12;
        this.speedOverride = null;
        this.snapThreshold = 0.5;
        this.gcd = 0;
        this.lastUpdateAt = 0;
        this.yawRemainder = 0;
        this.pitchRemainder = 0;
        this.trackingVector = null;

        register('postRenderWorld', () => this.update());
    }

    get isRotating() {
        return this.active;
    }

    setSpeed(speed) {
        if (Number.isFinite(speed) && speed > 0) this.speed = speed;
        return this;
    }

    setSnapThreshold(degrees) {
        if (Number.isFinite(degrees) && degrees >= 0) this.snapThreshold = degrees;
        return this;
    }

    rotateToVector(vector, speedOverride = null) {
        const player = Player.getPlayer();
        const target = Utils.convertToVector(vector);
        if (!player || !target) return false;

        const eyes = player.getEyePosition();
        const dx = target.x() - player.getX();
        const dy = target.y() - eyes.y();
        const dz = target.z() - player.getZ();
        const horizontalDistance = Math.hypot(dx, dz);
        const yaw = horizontalDistance <= 0.0001 ? player.getYRot() : Math.atan2(-dx, dz) * (180 / Math.PI);

        return this.rotateToAngles(yaw, Math.atan2(-dy, horizontalDistance) * (180 / Math.PI), speedOverride);
    }

    rotateToAngles(yaw, pitch, speedOverride = null) {
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || !Player.getPlayer()) return false;

        const player = Player.getPlayer();
        const currentYaw = player.getYRot();
        const currentPitch = player.getXRot();

        this.targetYaw = RotationGCD.aimModulo360(currentYaw, yaw);
        this.targetPitch = RotationGCD.clampPitch(pitch);
        this.initialYawDistance = Math.abs(RotationGCD.angleDifference(this.targetYaw, currentYaw));
        this.initialPitchDistance = Math.abs(this.targetPitch - currentPitch);

        const distance = Math.hypot(this.initialYawDistance, this.initialPitchDistance);
        this.warmupSteps = distance > 60 ? 1 : distance > 20 ? 3 : 5;
        this.step = 0;
        this.speedOverride = Number.isFinite(speedOverride) ? speedOverride : null;
        this.gcd = RotationGCD.calculateGCD();
        this.lastUpdateAt = Date.now();
        this.yawRemainder = 0;
        this.pitchRemainder = 0;
        this.trackingVector = null;
        this.active = true;
        return true;
    }

    trackVector(vector, speedOverride = null) {
        if (!this.active) {
            if (!this.rotateToVector(vector, speedOverride)) return false;
            this.trackingVector = vector;
            return true;
        }

        const player = Player.getPlayer();
        if (!player || !vector || !this.refreshTrackedTarget(player, vector)) return false;
        this.trackingVector = vector;
        if (Number.isFinite(speedOverride)) this.speedOverride = speedOverride;
        return true;
    }

    stop() {
        this.trackingVector = null;
        this.lastUpdateAt = 0;
        this.yawRemainder = 0;
        this.pitchRemainder = 0;
        this.active = false;
    }

    update() {
        if (!this.active) return;

        const player = Player.getPlayer();
        if (!player) return this.stop();
        if (this.trackingVector && !this.refreshTrackedTarget(player, this.trackingVector)) return this.stop();

        const now = Date.now();
        const elapsedMs = this.lastUpdateAt ? Math.max(1, Math.min(100, now - this.lastUpdateAt)) : 1000 / 60;
        this.lastUpdateAt = now;

        const currentYaw = player.getYRot();
        const currentPitch = player.getXRot();
        const deltaYaw = RotationGCD.angleDifference(this.targetYaw, currentYaw);
        const deltaPitch = this.targetPitch - currentPitch;
        const distance = Math.hypot(deltaYaw, deltaPitch);

        if (distance <= this.snapThreshold) {
            if (this.trackingVector) return;
            this.stop();
            return;
        }

        this.initialYawDistance = Math.max(this.initialYawDistance, Math.abs(deltaYaw));
        this.initialPitchDistance = Math.max(this.initialPitchDistance, Math.abs(deltaPitch));

        const updateScale = elapsedMs / 50;
        const warmup = Math.min((this.step += updateScale) / this.warmupSteps, 1);
        const baseSpeed = this.speedOverride ?? this.speed;
        const yawFactor = this.initialYawDistance > 0.1 ? Math.pow(this.initialYawDistance / Math.max(0.1, Math.abs(deltaYaw)), 0.1) : 1;
        const pitchFactor = this.initialPitchDistance > 0.1 ? Math.pow(this.initialPitchDistance / Math.max(0.1, Math.abs(deltaPitch)), 0.3) : 1;
        const yawBlendAt50Ms = Math.max(0, Math.min(0.95, baseSpeed * warmup * yawFactor));
        const pitchBlendAt50Ms = Math.max(0, Math.min(0.95, baseSpeed * warmup * pitchFactor));
        const yawBlend = 1 - Math.pow(1 - yawBlendAt50Ms, updateScale);
        const pitchBlend = 1 - Math.pow(1 - pitchBlendAt50Ms, updateScale);
        const rawYawStep = deltaYaw * yawBlend + this.yawRemainder;
        const rawPitchStep = deltaPitch * pitchBlend + this.pitchRemainder;
        const yawStep = Math.round(rawYawStep / this.gcd) * this.gcd;
        const pitchStep = Math.round(rawPitchStep / this.gcd) * this.gcd;
        this.yawRemainder = rawYawStep - yawStep;
        this.pitchRemainder = rawPitchStep - pitchStep;

        player.setYRot(currentYaw + yawStep);
        player.setXRot(RotationGCD.clampPitch(currentPitch + pitchStep));
    }

    refreshTrackedTarget(player, vector) {
        const target = Utils.convertToVector(vector);
        if (!target) return false;

        const eyes = player.getEyePosition();
        const dx = target.x() - player.getX();
        const dy = target.y() - eyes.y();
        const dz = target.z() - player.getZ();
        const currentYaw = player.getYRot();
        const horizontalDistance = Math.hypot(dx, dz);
        const yaw = horizontalDistance <= 0.0001 ? currentYaw : Math.atan2(-dx, dz) * (180 / Math.PI);
        this.targetYaw = RotationGCD.aimModulo360(currentYaw, yaw);
        this.targetPitch = RotationGCD.clampPitch(Math.atan2(-dy, horizontalDistance) * (180 / Math.PI));
        return true;
    }
}

export const OreRotations = new OreRotationController();
