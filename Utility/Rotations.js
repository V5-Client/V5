import { Vector } from './DataClasses/Vec';
import { Utils } from './Utils';

class RotationsTo {
    constructor() {
        this.targetYaw = null;
        this.targetPitch = null;
        this.rotating = false;

        this.Speed = 0.0275; // speed of rotation per tick
        this.tremorFrequency = 1; // jitter updates per second
        this.fadeExponent = 0.005; // controls jitter fade
        this.Randomness = 0.005; // max random offset (degrees)

        this.instantMode = false; // set inside rotation call, do not change here

        this.currentRandomYaw = 0;
        this.currentRandomPitch = 0;
        this.lastTremorTime = 0;

        this.targetVector = null;
        this.precision = 1.0;

        this.actions = [];

        this.lookRegister = register('postRenderWorld', () => {
            if (!this.rotating) {
                this.stopRotation();
                return;
            }

            let player = Player.getPlayer();
            if (!player) return;

            let currentYaw = player.getYaw();
            let currentPitch = player.getPitch();

            if (this.targetVector) {
                let playerPos = player.getPos();
                let eyeHeight = player.getEyePos().y - playerPos.y;

                let dx = this.targetVector.x - playerPos.x;
                let dy = this.targetVector.y - (playerPos.y + eyeHeight);
                let dz = this.targetVector.z - playerPos.z;

                this.targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
                let dist = Math.sqrt(dx * dx + dz * dz);
                this.targetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);
            }

            // instant snap mode
            if (this.instantMode) {
                player.setYaw(this.targetYaw);
                player.setPitch(this.targetPitch);
                this.runCallbacks();
                this.stopRotation();
                return;
            }

            let yawDiff = this.wrapDegrees(this.targetYaw - currentYaw);
            let pitchDiff = this.wrapDegrees(this.targetPitch - currentPitch);

            let isYawClose = Math.abs(yawDiff) < this.precision;
            let isPitchClose = Math.abs(pitchDiff) < this.precision;

            if (isYawClose && isPitchClose) {
                this.runCallbacks();
                this.stopRotation();
                return;
            }

            let maxDiff = Math.max(Math.abs(yawDiff), Math.abs(pitchDiff));
            let normalizedDist = Math.min(maxDiff / 180, 1);

            let now = Date.now();
            if (now - this.lastTremorTime > 1000 / this.tremorFrequency) {
                this.currentRandomYaw = (Math.random() - 0.5) * this.Randomness;
                this.currentRandomPitch =
                    (Math.random() - 0.5) * this.Randomness;
                this.lastTremorTime = now;
            }

            let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);

            let jitterYaw = this.currentRandomYaw * fadeFactor;
            let jitterPitch = this.currentRandomPitch * fadeFactor;

            let newYaw = currentYaw + yawDiff * this.Speed + jitterYaw;
            let newPitch = currentPitch + pitchDiff * this.Speed + jitterPitch;

            player.setYaw(newYaw);
            player.setPitch(newPitch);
        });
    }

    wrapDegrees(degrees) {
        degrees = degrees % 360;
        if (degrees >= 180) degrees -= 360;
        if (degrees < -180) degrees += 360;
        return degrees;
    }

    rotateToAngles(yaw, pitch, instant = false) {
        this.targetYaw = yaw;
        this.targetPitch = pitch;
        this.targetVector = null;
        this.instantMode = instant;
        this.rotating = true;
        this.lookRegister.register();
    }

    rotateTo(vector, instant = false) {
        let vec = Utils.convertToVector(vector);
        this.rotating = true;
        this.instantMode = instant;
        this.targetVector = new Vector(vec.x, vec.y, vec.z);
        this.lookRegister.register();
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
        this.instantMode = false; // reset to default
        this.lookRegister.unregister();
        this.actions = [];
    }

    getPlayerRotation() {
        const player = Player.getPlayer();
        if (!player) return null;
        return { yaw: player.getYaw(), pitch: player.getPitch() };
    }
}

export const Rotations = new RotationsTo();
