import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../PathWalker/PathRotationsUtility';
import { PathExecutor } from '../PathExecutor';

class PathRotations {
    constructor() {
        this.BASE_KP = 0.04;
        this.KD = 0.5;
        this.MAX_VELOCITY = 6.0;
        this.ACCEL_LIMIT = 0.35;
        this.SETTLE_THRESHOLD = 0.1;
        this.DEADZONE = 1.5;

        this.resetRotations();

        PathExecutor.onStep(() => {
            if (!this.rotationActive || !this.lookPoints) return;
            this.updateLookPoint();
            this.applyHumanizedPhysics();
            PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        });
    }

    resetRotations() {
        this.lookPoints = null;
        this.currentIndex = 0;
        this.rotationActive = false;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.rawTargetYaw = 0;
        this.rawTargetPitch = 0;
        PathRotationsUtility.stopRotation();
    }

    updateLookPoint() {
        const player = Player.getPlayer();
        if (!player) return;

        const playerEyes = player.getEyePos();
        let bestIndex = this.currentIndex;

        const searchAhead = Math.min(this.currentIndex + 6, this.lookPoints.length);

        for (let i = this.currentIndex; i < searchAhead; i++) {
            const target = this.lookPoints[i];
            const dx = target.x - playerEyes.x;
            const dy = target.y - playerEyes.y;
            const dz = target.z - playerEyes.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < 25.0) {
                bestIndex = Math.max(bestIndex, i + 1);
            }
        }

        if (bestIndex > this.currentIndex && bestIndex < this.lookPoints.length) {
            this.currentIndex = bestIndex;
        }

        const finalTarget = this.lookPoints[this.currentIndex];
        const angles = MathUtils.calculateAbsoluteAngles(finalTarget);

        this.rawTargetYaw = this.wrapAngle(angles.yaw);
        this.rawTargetPitch = angles.pitch;

        const lastPoint = this.lookPoints[this.lookPoints.length - 1];
        const finalDistSq = Math.pow(playerEyes.x - lastPoint.x, 2) + Math.pow(playerEyes.y - lastPoint.y, 2) + Math.pow(playerEyes.z - lastPoint.z, 2);

        if (this.currentIndex >= this.lookPoints.length - 1 && finalDistSq < 1.0) {
            this.rotationActive = false;
        }
    }

    applyHumanizedPhysics() {
        this.currentYaw = this.wrapAngle(this.currentYaw);
        const yawError = this.getAngleDelta(this.currentYaw, this.rawTargetYaw);
        const pitchError = this.rawTargetPitch - this.currentPitch;

        const softYawError = Math.abs(yawError) < this.DEADZONE ? 0 : yawError;
        const softPitchError = Math.abs(pitchError) < this.DEADZONE ? 0 : pitchError;

        let desiredYawAccel = softYawError * this.BASE_KP - this.yawVelocity * this.KD;
        desiredYawAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredYawAccel));
        this.yawVelocity = (this.yawVelocity + desiredYawAccel) * 0.92;
        this.currentYaw += this.yawVelocity;

        let desiredPitchAccel = softPitchError * this.BASE_KP - this.pitchVelocity * this.KD;
        desiredPitchAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredPitchAccel));
        this.pitchVelocity = (this.pitchVelocity + desiredPitchAccel) * 0.92;
        this.currentPitch += this.pitchVelocity;
    }

    wrapAngle(angle) {
        let wrapped = angle % 360;
        if (wrapped > 180) wrapped -= 360;
        if (wrapped < -180) wrapped += 360;
        return wrapped;
    }

    getAngleDelta(from, to) {
        let delta = (to - from) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }

    beginFlyRotations(preGeneratedLookPoints) {
        if (!preGeneratedLookPoints || !preGeneratedLookPoints.length) return;
        const player = Player.getPlayer();
        this.lookPoints = preGeneratedLookPoints;
        this.currentYaw = this.wrapAngle(player.getYaw());
        this.currentPitch = player.getPitch();
        this.rawTargetYaw = this.currentYaw;
        this.rawTargetPitch = this.currentPitch;
        this.rotationActive = true;
    }
}

export const FlyRotations = new PathRotations();
