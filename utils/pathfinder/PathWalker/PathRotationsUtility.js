import { Vec3d } from '../../Constants';
import { MathUtils } from '../../Math';
import { RotationGCD } from '../../player/RotationGCD';
import { Utils } from '../../Utils';

class PathRotsUtil {
    constructor() {
        this.targetYaw = null;
        this.targetPitch = null;
        this.rotating = false;
        this.currentRotationID = null;

        this.tremorFrequency = 0;
        this.fadeExponent = 0.0025;
        this.Randomness = 0;

        this.instantMode = false;

        this.currentJitterTime = 0;
        this.baseRandomYaw = 0;
        this.baseRandomPitch = 0;

        this.targetVector = null;
        this.precision = 1.0;

        this.actions = [];

        this.initialYaw = 0;
        this.initialPitch = 0;
        this.yawDiff = 0;
        this.pitchDiff = 0;

        this.startTime = 0;
        this.duration = 0;
        this.lastTime = Date.now();

        this.initialMaxDiff = 0;

        register('step', () => this.tick()).setFps(150);
    }

    applyRotationWithGCD(yaw, pitch) {
        RotationGCD.applyToPlayer(yaw, pitch);
    }

    wrapDegrees(degrees) {
        degrees = degrees % 360;
        if (degrees >= 180) degrees -= 360;
        if (degrees < -180) degrees += 360;
        return degrees;
    }

    calculateSmoothedYaw(targetYaw, currentSmoothedYaw, maxAdjustment) {
        const deltaYaw = MathUtils.getAngleDifference(currentSmoothedYaw, targetYaw);
        const adjustment = Math.min(Math.abs(deltaYaw), maxAdjustment) * Math.sign(deltaYaw);
        return currentSmoothedYaw + adjustment;
    }

    applySmoothPitchTransition(targetPitch, currentPitch, smoothingFactor) {
        return currentPitch + (targetPitch - currentPitch) * smoothingFactor;
    }

    interpolateBoxPosition(boxPositions, startIndex, fraction) {
        const startBox = boxPositions[startIndex];
        const endBox = boxPositions[startIndex + 1];

        if (!startBox || !endBox) return null;

        return new Vec3d(
            startBox.x + 0.5 + (endBox.x - startBox.x) * fraction,
            startBox.y + 0.5 + (endBox.y - startBox.y) * fraction,
            startBox.z + 0.5 + (endBox.z - startBox.z) * fraction
        );
    }

    calculateRotationSpeed(targetPoint, minSpeed = 60, maxSpeed = 80, scalingFactor = 20) {
        const { yaw: relYaw, pitch: relPitch } = MathUtils.calculateAngles(targetPoint);
        const totalAngleDifference = Math.abs(relYaw) + Math.abs(relPitch);

        const range = maxSpeed - minSpeed;
        let speedConstant = minSpeed + range * Math.exp((-scalingFactor * totalAngleDifference) / 180.0);

        return Math.max(minSpeed, Math.min(maxSpeed, speedConstant));
    }

    rotateToAngles(yaw, pitch, instant = false, durationMs = 500) {
        this.stopRotation();

        this.targetYaw = yaw;
        this.targetPitch = pitch;
        this.targetVector = null;
        this.instantMode = instant;
        this.rotating = true;

        const player = Player.getPlayer();
        if (!player) return;

        if (this.instantMode) {
            this.applyRotationWithGCD(yaw, pitch);
            this.runCallbacks();
            this.stopRotation();
            return;
        }

        this.initialYaw = player.getYaw();
        this.initialPitch = player.getPitch();

        this.yawDiff = this.wrapDegrees(yaw - this.initialYaw);
        this.pitchDiff = pitch - this.initialPitch;

        this.startTime = Date.now();
        this.lastTime = this.startTime;
        this.duration = durationMs;

        this.initialMaxDiff = Math.max(Math.abs(this.yawDiff), Math.abs(this.pitchDiff));

        this.currentJitterTime = 0;
        this.baseRandomYaw = (Math.random() - 0.5) * this.Randomness;
        this.baseRandomPitch = (Math.random() - 0.5) * this.Randomness;

        this.currentRotationID = Symbol();
    }

    tick() {
        if (!this.rotating || this.instantMode) {
            this.lastTime = Date.now();
            return;
        }

        const player = Player.getPlayer();
        if (!player) {
            this.stopRotation();
            return;
        }

        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        const elapsedTime = now - this.startTime;

        let progress = elapsedTime / this.duration;

        if (progress >= 1.0) {
            this.applyRotationWithGCD(this.targetYaw, this.targetPitch);
            this.runCallbacks();
            this.stopRotation();
            return;
        }

        progress = Math.max(0, Math.min(1.0, progress));

        const easedProgress = Math.sin(progress * (Math.PI / 2));

        let newYaw = this.initialYaw + this.yawDiff * easedProgress;
        let newPitch = this.initialPitch + this.pitchDiff * easedProgress;

        this.currentJitterTime += deltaTime;

        if (this.tremorFrequency > 0 && this.currentJitterTime > 1.0 / this.tremorFrequency) {
            this.baseRandomYaw = (Math.random() - 0.5) * this.Randomness;
            this.baseRandomPitch = (Math.random() - 0.5) * this.Randomness;
            this.currentJitterTime -= 1.0 / this.tremorFrequency;
        }

        const yawOscillation = Math.sin(this.currentJitterTime * 20.0);
        const pitchOscillation = Math.cos(this.currentJitterTime * 20.0);

        const currentJitterYaw = this.baseRandomYaw * yawOscillation;
        const currentJitterPitch = this.baseRandomPitch * pitchOscillation;

        const currentYawDiff = this.wrapDegrees(this.targetYaw - newYaw);
        const currentPitchDiff = this.targetPitch - newPitch;
        let maxCurrentDiff = Math.max(Math.abs(currentYawDiff), Math.abs(currentPitchDiff));
        let normalizedDist = this.initialMaxDiff > 0 ? maxCurrentDiff / this.initialMaxDiff : 0.01;

        let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);
        if (!Number.isFinite(fadeFactor)) {
            fadeFactor = 0;
        }

        let jitterYaw = currentJitterYaw * fadeFactor;
        let jitterPitch = currentJitterPitch * fadeFactor;

        this.applyRotationWithGCD(newYaw + jitterYaw, newPitch + jitterPitch);
    }

    rotateTo(vector, instant = false, durationMs = 500) {
        let vec = Utils.convertToVector(vector);
        let player = Player.getPlayer();
        if (!player || !vec || !Number.isFinite(vec.x) || !Number.isFinite(vec.y) || !Number.isFinite(vec.z)) return;

        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos().y - playerPos.y;

        let dx = vec.x - playerPos.x;
        let dy = vec.y - (playerPos.y + eyeHeight);
        let dz = vec.z - playerPos.z;

        let targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        let dist = Math.hypot(dx, dz);
        let targetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);

        this.rotateToAngles(targetYaw, targetPitch, instant, durationMs);
    }

    runCallbacks() {
        this.actions.forEach((action) => {
            try {
                action.func();
            } catch (e) {
                console.error(`Rotation ${action.name || 'callback'} error:`);
                console.error('V5 Caught error' + e + e.stack);
            }
        });
    }

    onEndRotation(callBack, name = null) {
        this.actions.push({ func: callBack, name });
    }

    removeCallback(name) {
        this.actions = this.actions.filter((action) => action.name !== name);
    }

    stopRotation() {
        this.targetVector = null;
        this.rotating = false;
        this.instantMode = false;
        this.currentRotationID = null;
        this.actions = [];
        this.startTime = 0;
        this.duration = 0;
        this.lastTime = Date.now();
        this.currentJitterTime = 0;
    }

    getPlayerRotation() {
        const player = Player.getPlayer();
        if (!player) return null;
        return { yaw: player.getYaw(), pitch: player.getPitch() };
    }
}

export const PathRotationsUtility = new PathRotsUtil();
