import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { BP, Vec3d } from '../../Constants';
import RenderUtils from '../../render/RendererUtils';

class PathRotations {
    constructor() {
        this.LOOK_AHEAD_INDEX_OFFSET = 2.5;
        this.PROXIMITY_THRESHOLD = 4;
        this.BASE_KP = 0.08;
        this.KD = 0.45;
        this.MAX_VELOCITY = 8.0;
        this.ACCEL_LIMIT = 1.2;
        this.SETTLE_THRESHOLD = 0.1;
        this.PITCH_DEADZONE = 2.5;
        this.YAW_DEADZONE = 1.5;
        this.SMOOTH_FACTOR = 0.15;
        this.MAX_LOOK_DISTANCE = 3.0;

        this.resetRotations();
        this.onStep();
        this.onRender();
    }

    resetRotations() {
        this.currentBoxIndex = 0;
        this.lastBoxIndex = 0;
        this.currentPathPosition = 0.0;
        this.isInitialized = false;
        this.complete = false;
        this.rotationActive = false;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.rawTargetYaw = 0;
        this.rawTargetPitch = 0;
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.boxPositions = null;
        this.currentTargetPoint = null;
        PathRotationsUtility.stopRotation();
    }

    onStep() {
        this.stepRegister = register('step', () => {
            if (!this.rotationActive || !this.boxPositions) return;
            this.updateLookPoint();
            this.applyHumanizedPhysics();
            PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        }).setFps(120);
    }

    onRender() {
        register('postrenderWorld', () => {
            if (!this.rotationActive || !this.currentTargetPoint) return;
            RenderUtils.drawBox(new Vec3d(this.currentTargetPoint.x, this.currentTargetPoint.y, this.currentTargetPoint.z), [0, 0, 255, 80], true);
        });
    }

    updateLookPoint() {
        const player = Player.getPlayer();
        if (!player) return;
        const playerEyes = player.getEyePos();

        let bestT = this.currentPathPosition;
        let minDistanceSq = Infinity;

        const startIdx = Math.max(0, Math.floor(this.currentPathPosition) - 2);
        const endIdx = Math.min(this.boxPositions.length - 1, startIdx + 8);

        for (let i = startIdx; i < endIdx; i++) {
            const p1 = this.boxPositions[i];
            const p2 = this.boxPositions[i + 1];
            if (!p1 || !p2) continue;

            const segmentProgress = this.getClosestPointOnSegment(playerEyes, p1, p2);
            const projectedPoint = this.getInterpolatedPoint(i + segmentProgress);
            const distSq = this.getDistSq(playerEyes, projectedPoint);

            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestT = i + segmentProgress;
            }
        }

        if (Math.sqrt(minDistanceSq) < this.PROXIMITY_THRESHOLD) {
            this.currentPathPosition = bestT;
        }

        const lookAheadT = Math.min(this.boxPositions.length - 1, this.currentPathPosition + this.LOOK_AHEAD_INDEX_OFFSET);
        let targetPoint = this.getInterpolatedPoint(lookAheadT);

        const dx = targetPoint.x - playerEyes.x;
        const dy = targetPoint.y - playerEyes.y;
        const dz = targetPoint.z - playerEyes.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > this.MAX_LOOK_DISTANCE) {
            const scale = this.MAX_LOOK_DISTANCE / dist;
            targetPoint = new Vec3d(playerEyes.x + dx * scale, playerEyes.y + dy * scale, playerEyes.z + dz * scale);
        }

        this.currentTargetPoint = targetPoint;
        const angles = MathUtils.calculateAbsoluteAngles(this.currentTargetPoint);

        const targetYaw = this.wrapAngle(angles.yaw);
        const yawDelta = Math.abs(this.getAngleDelta(this.rawTargetYaw, targetYaw));

        if (yawDelta > this.YAW_DEADZONE) {
            this.rawTargetYaw += this.getAngleDelta(this.rawTargetYaw, targetYaw) * this.SMOOTH_FACTOR;
        }

        const pitchDelta = Math.abs(angles.pitch - this.rawTargetPitch);
        if (pitchDelta > this.PITCH_DEADZONE) {
            this.rawTargetPitch += (angles.pitch - this.rawTargetPitch) * this.SMOOTH_FACTOR;
        }

        if (this.currentPathPosition >= this.boxPositions.length - 1.05) {
            this.complete = true;
            this.rotationActive = false;
        }
    }

    applyHumanizedPhysics() {
        this.currentYaw = this.wrapAngle(this.currentYaw);
        const yawError = this.getAngleDelta(this.currentYaw, this.rawTargetYaw);
        const pitchError = this.rawTargetPitch - this.currentPitch;

        if (Math.abs(yawError) < this.SETTLE_THRESHOLD && Math.abs(this.yawVelocity) < 0.02) {
            this.currentYaw = this.rawTargetYaw;
            this.yawVelocity = 0;
        } else {
            let desiredYawAccel = yawError * this.BASE_KP - this.yawVelocity * this.KD;
            desiredYawAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredYawAccel));
            this.yawVelocity += desiredYawAccel;
            this.yawVelocity *= 0.92;
            this.yawVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.yawVelocity));
            this.currentYaw += this.yawVelocity;
        }

        if (Math.abs(pitchError) < this.SETTLE_THRESHOLD && Math.abs(this.pitchVelocity) < 0.02) {
            this.currentPitch = this.rawTargetPitch;
            this.pitchVelocity = 0;
        } else {
            let desiredPitchAccel = pitchError * this.BASE_KP - this.pitchVelocity * this.KD;
            desiredPitchAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredPitchAccel));
            this.pitchVelocity += desiredPitchAccel;
            this.pitchVelocity *= 0.92;
            this.pitchVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.pitchVelocity));
            this.currentPitch += this.pitchVelocity;
        }
    }

    getClosestPointOnSegment(p, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq === 0) return 0;
        const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy + (p.z - p1.z) * dz) / dSq;
        return Math.max(0, Math.min(1, t));
    }

    getInterpolatedPoint(indexFloat) {
        const idx = Math.floor(indexFloat);
        const frac = indexFloat - idx;
        const p1 = this.boxPositions[idx];
        const p2 = this.boxPositions[Math.min(idx + 1, this.boxPositions.length - 1)];
        if (!p2 || frac <= 0) return p1;
        return new Vec3d(p1.x + (p2.x - p1.x) * frac, p1.y + (p2.y - p1.y) * frac, p1.z + (p2.z - p1.z) * frac);
    }

    getDistSq(pos, box) {
        return (pos.x - box.x) ** 2 + (pos.y - box.y) ** 2 + (pos.z - box.z) ** 2;
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

    pathRotations(splineData) {
        if (!this.boxPositions) {
            this.boxPositions = Spline.CreateLookPoints(splineData, 0.25, 4.5, false);
            if (!this.boxPositions || !this.boxPositions.length) return;
        }
        const player = Player.getPlayer();
        if (!player) return;
        if (!this.isInitialized) {
            this.currentYaw = player.getYaw();
            this.currentPitch = player.getPitch();
            this.rawTargetYaw = this.currentYaw;
            this.rawTargetPitch = this.currentPitch;
            this.yawVelocity = 0;
            this.pitchVelocity = 0;
            this.currentPathPosition = 0;
            this.isInitialized = true;
            this.rotationActive = true;
        }
    }
}

export const Rotations = new PathRotations();
