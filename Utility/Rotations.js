import { Vector } from './DataClasses/Vec';
import { Utils } from './Utils';

class RotationsTo {
    constructor() {
        this.targetYaw = null;
        this.targetPitch = null;
        this.rotating = false;
        this.currentRotationID = null; // for cancelling old rotations

        this.tremorFrequency = 1; // jitter updates per second
        this.fadeExponent = 0.0025; // controls jitter fade
        this.Randomness = 0.007; // max random offset

        this.instantMode = false;

        this.currentRandomYaw = 0;
        this.currentRandomPitch = 0;
        this.lastTremorTime = 0;

        this.targetVector = null;
        this.precision = 1.0;

        this.actions = [];

        this.initialYaw = 0;
        this.initialPitch = 0;
        this.yawDiff = 0;
        this.pitchDiff = 0;
        this.stepCount = 0;
        this.maxSteps = 0;
        this.initialMaxDiff = 0;

        register('renderWorld', () => {
            this.tick();
        });
    }

    wrapDegrees(degrees) {
        degrees = degrees % 360;
        if (degrees >= 180) degrees -= 360;
        if (degrees < -180) degrees += 360;
        return degrees;
    }

    /**
     * Rotates the player's view to the target angles with a natural ease-out motion.
     * @param {number} yaw - The target yaw angle.
     * @param {number} pitch - The target pitch angle.
     * @param {boolean} [instant=false] - If true, snap instantly to the target.
     * @param {number} [steps=100] - The number of steps for the rotation animation.
     */
    rotateToAngles(yaw, pitch, instant = false, steps = 100) {
        this.stopRotation();

        this.targetYaw = yaw;
        this.targetPitch = pitch;
        this.targetVector = null;
        this.instantMode = instant;
        this.rotating = true;

        const player = Player.getPlayer();
        if (!player) return;

        if (this.instantMode) {
            player.setYaw(yaw);
            player.setPitch(pitch);
            this.runCallbacks();
            this.stopRotation();
            return;
        }

        this.initialYaw = player.getYaw();
        this.initialPitch = player.getPitch();

        this.yawDiff = this.wrapDegrees(yaw - this.initialYaw);
        this.pitchDiff = pitch - this.initialPitch;

        this.stepCount = 0;
        this.maxSteps = steps;

        this.initialMaxDiff = Math.max(
            Math.abs(this.yawDiff),
            Math.abs(this.pitchDiff)
        );

        this.currentRotationID = Symbol();
    }

    tick() {
        if (!this.rotating || this.instantMode) {
            return;
        }

        const player = Player.getPlayer();
        if (!player) {
            this.stopRotation();
            return;
        }

        this.stepCount++;

        if (this.stepCount > this.maxSteps) {
            player.setYaw(this.targetYaw);
            player.setPitch(this.targetPitch);
            this.runCallbacks();
            this.stopRotation();
            return;
        }

        const progress = this.stepCount / this.maxSteps;

        const easedProgress = Math.sin(progress * (Math.PI / 2));

        let newYaw = this.initialYaw + this.yawDiff * easedProgress;
        let newPitch = this.initialPitch + this.pitchDiff * easedProgress;

        // Calculate jitter for a "natural" feel
        const currentYawDiff = this.wrapDegrees(this.targetYaw - newYaw);
        const currentPitchDiff = this.targetPitch - newPitch;
        let maxCurrentDiff = Math.max(
            Math.abs(currentYawDiff),
            Math.abs(currentPitchDiff)
        );
        let normalizedDist =
            this.initialMaxDiff > 0
                ? maxCurrentDiff / this.initialMaxDiff
                : 0.01;

        let now = Date.now();
        if (now - this.lastTremorTime > 1000 / this.tremorFrequency) {
            this.currentRandomYaw = (Math.random() - 0.5) * this.Randomness;
            this.currentRandomPitch = (Math.random() - 0.5) * this.Randomness;
            this.lastTremorTime = now;
        }

        let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);
        let jitterYaw = this.currentRandomYaw * fadeFactor;
        let jitterPitch = this.currentRandomPitch * fadeFactor;

        player.setYaw(newYaw + jitterYaw);
        player.setPitch(newPitch + jitterPitch);
    }

    rotateTo(vector, instant = false, steps = 100) {
        let vec = Utils.convertToVector(vector);
        let player = Player.getPlayer();
        if (!player) return;

        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos().y - playerPos.y;

        let dx = vec.x - playerPos.x;
        let dy = vec.y - (playerPos.y + eyeHeight);
        let dz = vec.z - playerPos.z;

        let targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        let dist = Math.sqrt(dx * dx + dz * dz);
        let targetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);

        this.rotateToAngles(targetYaw, targetPitch, instant, steps);
    }

    runCallbacks() {
        this.actions.forEach((action) => {
            try {
                action.func();
            } catch (e) {
                console.error(
                    `Rotation ${action.name || 'callback'} error:`,
                    e
                );
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
        this.stepCount = 0;
        this.maxSteps = 0;
    }

    getPlayerRotation() {
        const player = Player.getPlayer();
        if (!player) return null;
        return { yaw: player.getYaw(), pitch: player.getPitch() };
    }
}

export const Rotations = new RotationsTo();
