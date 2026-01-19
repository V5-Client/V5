import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { BP, Vec3d } from '../../Constants';
import RenderUtils from '../../render/RendererUtils';

// current path rotation state is really good
// todo
// the dynamic PID scaling and curvature severity is not working well
// its too strong or too weak and idk what to do

class PathRotations {
    constructor() {
        this.MIN_LOOK_AHEAD = 0.5;
        this.MAX_LOOK_AHEAD = 3.0;
        this.CURVATURE_SENSITIVITY = 18.0;
        this.PROXIMITY_THRESHOLD = 4;

        this.STRAIGHT_KP = 0.04;
        this.CURVE_KP = 0.14;
        this.STRAIGHT_KD = 0.28;
        this.CURVE_KD = 0.6;
        this.STRAIGHT_SMOOTH = 0.05;
        this.CURVE_SMOOTH = 0.28;

        this.MAX_VELOCITY = 12.0;
        this.ACCEL_LIMIT = 1.8;
        this.SETTLE_THRESHOLD = 0.1;
        this.PITCH_DEADZONE = 0.8;
        this.YAW_DEADZONE = 0.5;
        this.MAX_LOOK_DISTANCE = 4.5;

        this.resetRotations();
        this.onStep();
    }

    resetRotations() {
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
        this.smoothedCurveSeverity = 0;
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

    getPathCurvature(idx) {
        const p1 = this.boxPositions[idx];
        const p2 = this.boxPositions[idx + 1];
        const p3 = this.boxPositions[idx + 2];
        if (!p1 || !p2 || !p3) return 0;
        const v1 = { x: p2.x - p1.x, z: p2.z - p1.z };
        const v2 = { x: p3.x - p2.x, z: p3.z - p2.z };
        const mag1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z);
        if (mag1 < 0.05 || mag2 < 0.05) return 0;
        const dot = (v1.x * v2.x + v1.z * v2.z) / (mag1 * mag2);
        return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    }

    updateLookPoint() {
        const player = Player.getPlayer();
        if (!player) return;
        const playerEyes = player.getEyePos();

        let bestT = this.currentPathPosition;
        let minDistanceSq = Infinity;
        const startIdx = Math.max(0, Math.floor(this.currentPathPosition) - 5);
        const endIdx = Math.min(this.boxPositions.length - 1, startIdx + 25);

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

        const currIdx = Math.floor(this.currentPathPosition);
        let lookAheadCurvature = 0;
        let weightSum = 0;
        for (let j = 0; j < 6; j++) {
            const checkIdx = Math.min(this.boxPositions.length - 3, currIdx + j);
            const weight = 6 - j;
            lookAheadCurvature += this.getPathCurvature(checkIdx) * weight;
            weightSum += weight;
        }
        const avgCurvature = lookAheadCurvature / weightSum;
        const targetSeverity = Math.min(1.0, avgCurvature / this.CURVATURE_SENSITIVITY);

        this.smoothedCurveSeverity += (targetSeverity - this.smoothedCurveSeverity) * 0.12;

        const dynamicLookAhead = this.MAX_LOOK_AHEAD - this.smoothedCurveSeverity * (this.MAX_LOOK_AHEAD - this.MIN_LOOK_AHEAD);
        const lookAheadT = Math.min(this.boxPositions.length - 1, this.currentPathPosition + dynamicLookAhead);
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
        const currentSmooth = this.STRAIGHT_SMOOTH + this.smoothedCurveSeverity * (this.CURVE_SMOOTH - this.STRAIGHT_SMOOTH);

        const yawDelta = this.getAngleDelta(this.rawTargetYaw, targetYaw);
        if (Math.abs(yawDelta) > this.YAW_DEADZONE) {
            this.rawTargetYaw += yawDelta * currentSmooth;
        }

        const pitchDelta = angles.pitch - this.rawTargetPitch;
        if (Math.abs(pitchDelta) > this.PITCH_DEADZONE) {
            this.rawTargetPitch += pitchDelta * currentSmooth;
        }

        if (this.currentPathPosition >= this.boxPositions.length - 1.1) {
            this.complete = true;
            this.rotationActive = false;
        }
    }

    applyHumanizedPhysics() {
        this.currentYaw = this.wrapAngle(this.currentYaw);
        const yawError = this.getAngleDelta(this.currentYaw, this.rawTargetYaw);
        const pitchError = this.rawTargetPitch - this.currentPitch;

        const dynamicKP = this.STRAIGHT_KP + this.smoothedCurveSeverity * (this.CURVE_KP - this.STRAIGHT_KP);
        const dynamicKD = this.STRAIGHT_KD + this.smoothedCurveSeverity * (this.CURVE_KD - this.STRAIGHT_KD);

        if (Math.abs(yawError) < this.SETTLE_THRESHOLD && Math.abs(this.yawVelocity) < 0.02) {
            this.currentYaw = this.rawTargetYaw;
            this.yawVelocity = 0;
        } else {
            let desiredYawAccel = yawError * dynamicKP - this.yawVelocity * dynamicKD;
            desiredYawAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredYawAccel));
            this.yawVelocity += desiredYawAccel;
            this.yawVelocity *= 0.94;
            this.yawVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.yawVelocity));
            this.currentYaw += this.yawVelocity;
        }

        if (Math.abs(pitchError) < this.SETTLE_THRESHOLD && Math.abs(this.pitchVelocity) < 0.02) {
            this.currentPitch = this.rawTargetPitch;
            this.pitchVelocity = 0;
        } else {
            let desiredPitchAccel = pitchError * dynamicKP - this.pitchVelocity * dynamicKD;
            desiredPitchAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredPitchAccel));
            this.pitchVelocity += desiredPitchAccel;
            this.pitchVelocity *= 0.94;
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
