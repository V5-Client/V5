import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { BP, Vec3d } from '../../Constants';
import RenderUtils from '../../render/RendererUtils';

class PathRotations {
    constructor() {
        this.LOOK_AHEAD_DISTANCE = 1.8;
        this.PROGRESS_SMOOTHING = 0.25;
        this.MIN_SPEED = 0.02;
        this.MAX_SPEED = 0.35;
        this.PITCH_STIFFNESS = 0.12;
        this.MAX_YAW_VELOCITY = 60;

        this.TARGET_BLEND_NORMAL = 0.4;
        this.TARGET_BLEND_SKIP = 0.15;
        this.SKIP_RECOVERY_TICKS = 15;
        this.NODE_SKIP_THRESHOLD = 3;

        this.resetRotations();
        this.onStep();
    }

    resetRotations() {
        this.currentBoxIndex = 0;
        this.lastBoxIndex = 0;
        this.currentPathPosition = 0.0;
        this.isInitialized = false;
        this.complete = false;
        this.rotationActive = false;
        this.ticksSinceNodeSkip = 999;
        this.rawTargetYaw = 0;
        this.rawTargetPitch = 0;
        this.smoothedTargetYaw = 0;
        this.smoothedTargetPitch = 0;
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.boxPositions = null;
        this.currentTargetPoint = null;

        PathRotationsUtility.stopRotation();
    }

    onStep() {
        this.stepRegister = register('step', () => {
            if (!this.rotationActive || !this.boxPositions) return;

            this.updatePathProgress();
            this.calculateRawTargetAngles();

            const blendSpeed = this.getDynamicBlendSpeed();
            this.applySmoothing(blendSpeed);

            PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        }).setFps(120);
    }

    updatePathProgress() {
        const player = Player.getPlayer();
        if (!player) return;
        const playerEyes = player.getEyePos();

        let bestT = this.currentPathPosition;
        let minDistanceSq = Infinity;

        const startIdx = Math.max(0, Math.floor(this.currentPathPosition) - 1);
        const endIdx = Math.min(this.boxPositions.length - 1, startIdx + 4);

        for (let i = startIdx; i < endIdx; i++) {
            const p1 = this.boxPositions[i];
            const p2 = this.boxPositions[i + 1];

            const segmentProgress = this.getClosestPointOnSegment(playerEyes, p1, p2);
            const projectedPoint = this.getInterpolatedPoint(i + segmentProgress);
            const distSq = this.getDistSq(playerEyes, projectedPoint);

            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestT = i + segmentProgress;
            }
        }

        if (bestT > this.currentPathPosition) {
            const delta = bestT - this.currentPathPosition;
            this.currentPathPosition += delta * this.PROGRESS_SMOOTHING;
        }

        const newIndex = Math.floor(this.currentPathPosition);
        if (newIndex - this.lastBoxIndex > this.NODE_SKIP_THRESHOLD) {
            this.ticksSinceNodeSkip = 0;
        } else {
            this.ticksSinceNodeSkip++;
        }

        this.lastBoxIndex = newIndex;
        this.currentBoxIndex = newIndex;

        if (this.currentPathPosition >= this.boxPositions.length - 1.2) {
            this.complete = true;
            this.rotationActive = false;
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

    calculateRawTargetAngles() {
        const targetIdx = Math.min(this.currentPathPosition + this.LOOK_AHEAD_DISTANCE, this.boxPositions.length - 1);
        const targetPoint = this.getInterpolatedPoint(targetIdx);

        if (!targetPoint) return;

        this.currentTargetPoint = targetPoint;
        const angles = MathUtils.calculateAbsoluteAngles(targetPoint);
        this.rawTargetYaw = angles.yaw;
        this.rawTargetPitch = angles.pitch;
    }

    getInterpolatedPoint(indexFloat) {
        const idx = Math.floor(indexFloat);
        const frac = indexFloat - idx;

        const p1 = this.boxPositions[idx];
        const p2 = this.boxPositions[Math.min(idx + 1, this.boxPositions.length - 1)];

        if (!p2 || frac <= 0) return p1;
        if (frac >= 1) return p2;

        return new Vec3d(p1.x + (p2.x - p1.x) * frac, p1.y + (p2.y - p1.y) * frac, p1.z + (p2.z - p1.z) * frac);
    }

    applySmoothing(blendSpeed) {
        const yawToRaw = this.getAngleDelta(this.smoothedTargetYaw, this.rawTargetYaw);
        this.smoothedTargetYaw = this.wrapAngle(this.smoothedTargetYaw + yawToRaw * blendSpeed);
        this.smoothedTargetPitch += (this.rawTargetPitch - this.smoothedTargetPitch) * blendSpeed;

        const yawDelta = this.getAngleDelta(this.currentYaw, this.smoothedTargetYaw);
        const absDelta = Math.abs(yawDelta);

        const tension = Math.min(1.0, absDelta / 25.0);
        const rubberBandPower = tension * tension * (3 - 2 * tension);
        const dynamicYawSpeed = this.MIN_SPEED + (this.MAX_SPEED - this.MIN_SPEED) * Math.pow(rubberBandPower, 1.5);

        let step = yawDelta * dynamicYawSpeed;
        step = Math.max(-this.MAX_YAW_VELOCITY, Math.min(this.MAX_YAW_VELOCITY, step));

        this.currentYaw = this.wrapAngle(this.currentYaw + step);

        const pitchDelta = this.smoothedTargetPitch - this.currentPitch;
        const pitchTension = Math.min(1.0, Math.abs(pitchDelta) / 15.0);
        this.currentPitch += pitchDelta * (this.PITCH_STIFFNESS * (0.5 + pitchTension));
    }

    getDynamicBlendSpeed() {
        if (this.ticksSinceNodeSkip >= this.SKIP_RECOVERY_TICKS) return this.TARGET_BLEND_NORMAL;
        const recovery = this.ticksSinceNodeSkip / this.SKIP_RECOVERY_TICKS;
        return this.TARGET_BLEND_SKIP + (this.TARGET_BLEND_NORMAL - this.TARGET_BLEND_SKIP) * (recovery * recovery);
    }

    getDistSq(pos, box) {
        return (pos.x - box.x) ** 2 + (pos.y - box.y) ** 2 + (pos.z - box.z) ** 2;
    }

    wrapAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    getAngleDelta(from, to) {
        return this.wrapAngle(to - from);
    }

    pathRotations(splineData) {
        if (!this.boxPositions) {
            this.boxPositions = Spline.CreateLookPoints(splineData, 1.0, 10.0, false);
            if (!this.boxPositions.length) return;
        }

        const player = Player.getPlayer();
        if (!player) return;

        if (this.currentPathPosition >= this.boxPositions.length - 1) {
            this.complete = true;
            this.rotationActive = false;
            return;
        }

        if (!this.isInitialized) {
            this.currentYaw = player.getYaw();
            this.currentPitch = player.getPitch();
            this.currentPathPosition = 0;

            const firstTarget = this.boxPositions[0];
            const angles = MathUtils.calculateAbsoluteAngles(firstTarget);
            this.smoothedTargetYaw = angles.yaw;
            this.smoothedTargetPitch = angles.pitch;

            this.isInitialized = true;
            this.rotationActive = true;
        }
    }
}

export const Rotations = new PathRotations();
