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
    }

    wrapDegrees(degrees) {
        degrees = degrees % 360;
        if (degrees >= 180) degrees -= 360;
        if (degrees < -180) degrees += 360;
        return degrees;
    }

    rotateToAngles(yaw, pitch, instant = false, steps = 100) {
        this.targetYaw = yaw;
        this.targetPitch = pitch;
        this.targetVector = null;
        this.instantMode = instant;
        this.rotating = true;

        const player = Player.getPlayer();
        if (!player) return;

        // Instant mode - just snap
        if (this.instantMode) {
            player.setYaw(yaw);
            player.setPitch(pitch);
            this.runCallbacks();
            this.stopRotation();
            return;
        }

        // thread based rotation
        const currentYaw = player.getYaw();
        const currentPitch = player.getPitch();

        let yawDiff = this.wrapDegrees(yaw - currentYaw);
        let pitchDiff = pitch - currentPitch;

        const rotationID = Symbol();
        this.currentRotationID = rotationID;

        const initialYawDiff = yawDiff;
        const initialPitchDiff = pitchDiff;
        const initialMaxDiff = Math.max(
            Math.abs(initialYawDiff),
            Math.abs(initialPitchDiff)
        );

        new Thread(() => {
            for (let i = 0; i < steps; i++) {
                if (this.currentRotationID !== rotationID) {
                    return;
                }

                const p = Player.getPlayer();
                if (!p) return;

                const currentYawDiff = this.wrapDegrees(
                    this.targetYaw - p.getYaw()
                );
                const currentPitchDiff = this.targetPitch - p.getPitch();

                let maxCurrentDiff = Math.max(
                    Math.abs(currentYawDiff),
                    Math.abs(currentPitchDiff)
                );

                let normalizedDist =
                    initialMaxDiff > 0 ? maxCurrentDiff / initialMaxDiff : 0.01;

                let now = Date.now();
                if (now - this.lastTremorTime > 1000 / this.tremorFrequency) {
                    this.currentRandomYaw =
                        (Math.random() - 0.5) * this.Randomness;
                    this.currentRandomPitch =
                        (Math.random() - 0.5) * this.Randomness;
                    this.lastTremorTime = now;
                }

                let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);
                let jitterYaw = this.currentRandomYaw * fadeFactor;
                let jitterPitch = this.currentRandomPitch * fadeFactor;

                const newYaw = p.getYaw() + yawDiff / steps + jitterYaw;
                const newPitch = p.getPitch() + pitchDiff / steps + jitterPitch;

                p.setYaw(newYaw);
                p.setPitch(newPitch);

                try {
                    Thread.sleep(1);
                } catch (err) {}
            }

            const finalPlayer = Player.getPlayer();
            if (finalPlayer) {
                let finalYawDiff = Math.abs(
                    this.wrapDegrees(this.targetYaw - finalPlayer.getYaw())
                );
                let finalPitchDiff = Math.abs(
                    this.targetPitch - finalPlayer.getPitch()
                );

                if (
                    finalYawDiff < this.precision &&
                    finalPitchDiff < this.precision
                ) {
                    this.runCallbacks();
                    this.stopRotation();
                }
            }
        }).start();
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
        this.currentRotationID = null; // cancel any ongoing rotations
        this.actions = [];
    }

    getPlayerRotation() {
        const player = Player.getPlayer();
        if (!player) return null;
        return { yaw: player.getYaw(), pitch: player.getPitch() };
    }
}

export const Rotations = new RotationsTo();
