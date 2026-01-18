import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { Vec3d } from '../../Constants';

class PathRotations {
    constructor() {
        this.LOOK_AHEAD_DISTANCE = 4;
        this.BASE_YAW_AHEAD_DISTANCE = 4;
        this.MIN_YAW_AHEAD_DISTANCE = 0.5;
        this.DYNAMIC_YAW_CURVATURE_RADIUS = 4;
        this.CURVATURE_FULL_REDUCTION_ANGLE = 45;
        this.MIN_PITCH_LOOKAHEAD = 2.5;

        this.YAW_SMOOTH_SPEED = 0.1;
        this.PITCH_SMOOTH_SPEED = 0.03;
        this.TARGET_BLEND_NORMAL = 0.4;
        this.TARGET_BLEND_SKIP = 0.15;
        this.SKIP_RECOVERY_TICKS = 15;
        this.NODE_SKIP_THRESHOLD = 6;

        this.BOX_RESET_SEARCH_RANGE = 20;
        this.BOX_SWITCH_HYSTERESIS = 3;

        this.YAW_DEAD_ZONE = 0.3;
        this.PITCH_DEAD_ZONE = 0.15;

        this.MIN_SMOOTH_SPEED = 0.02;
        this.MAX_YAW_VELOCITY = 60;
        this.SHARP_TURN_THRESHOLD = 55;

        this.resetRotations();
        this.onStep();
    }

    resetRotations() {
        this.currentBoxIndex = 1;
        this.lastBoxIndex = 0;
        this.currentPathPosition = 1.0;
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
        this.cachedLookPoints = null;
        this.boxPositions = null;
    }

    onStep() {
        this.stepRegister = register('step', () => {
            if (!this.rotationActive || !this.cachedLookPoints) return;

            this.handleAll();
        }).setFps(120);
    }

    handleAll() {
        const blendSpeed = this.getDynamicBlendSpeed();
        const curvature = this.computeLocalCurvature(this.currentBoxIndex);

        this.handleSharpTurnDeceleration(curvature);
        this.applySmoothing(blendSpeed);

        PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
    }

    updatePathProgress() {
        const player = Player.getPlayer();
        if (!player) return;

        const playerEyes = player.getEyePos();

        let closestBoxDistSq = Infinity;
        let newIndex = this.currentBoxIndex;

        const start = Math.max(0, this.currentBoxIndex - this.BOX_RESET_SEARCH_RANGE);
        const end = Math.min(this.boxPositions.length, this.currentBoxIndex + this.BOX_RESET_SEARCH_RANGE);

        for (let i = start; i < end; i++) {
            const box = this.boxPositions[i];
            const distSq = this.getDistSq(playerEyes, box);
            if (distSq < closestBoxDistSq) {
                closestBoxDistSq = distSq;
                newIndex = i;
            }
        }

        // Apply hysteresis to prevent index flickering
        if (newIndex >= this.currentBoxIndex || newIndex < this.currentBoxIndex - this.BOX_SWITCH_HYSTERESIS) {
            this.currentBoxIndex = newIndex;
        }

        this.updateSkipDetection();
        this.calculatePrecisePathPosition(playerEyes);
    }

    updateSkipDetection() {
        const skipAmount = this.currentBoxIndex - this.lastBoxIndex;
        this.ticksSinceNodeSkip = skipAmount > this.NODE_SKIP_THRESHOLD ? 0 : this.ticksSinceNodeSkip + 1;
        this.lastBoxIndex = this.currentBoxIndex;
    }

    calculatePrecisePathPosition(playerEyes) {
        const currentBox = this.boxPositions[this.currentBoxIndex];
        const nextBox = this.boxPositions[Math.min(this.currentBoxIndex + 1, this.boxPositions.length - 1)];

        const dx = nextBox.x - currentBox.x;
        const dz = nextBox.z - currentBox.z;
        const lenSq = dx * dx + dz * dz;

        let t = 0;
        if (lenSq > 0.0001) {
            t = ((playerEyes.x - (currentBox.x + 0.5)) * dx + (playerEyes.z - (currentBox.z + 0.5)) * dz) / lenSq;
        }
        this.currentPathPosition = this.currentBoxIndex + Math.max(0, Math.min(1, t));
    }

    calculateRawTargetAngles() {
        const dynamicYawAhead = this.getYawLookaheadDistance();

        const targetYawIdx = Math.min(this.currentPathPosition + dynamicYawAhead, this.boxPositions.length - 1);
        const targetPitchIdx = Math.min(this.currentPathPosition + this.LOOK_AHEAD_DISTANCE, this.boxPositions.length - 1);

        const yawPoint = this.getInterpolatedPoint(targetYawIdx);
        const pitchPoint = this.getInterpolatedPoint(targetPitchIdx);

        if (!yawPoint || !pitchPoint) return;

        this.rawTargetYaw = MathUtils.calculateAbsoluteAngles(yawPoint).yaw;
        this.rawTargetPitch = MathUtils.calculateAbsoluteAngles(pitchPoint).pitch;
    }

    applySmoothing(blendSpeed) {
        const yawToRaw = this.getAngleDelta(this.smoothedTargetYaw, this.rawTargetYaw);
        const pitchToRaw = this.rawTargetPitch - this.smoothedTargetPitch;

        this.smoothedTargetYaw = this.wrapAngle(this.smoothedTargetYaw + yawToRaw * blendSpeed);
        this.smoothedTargetPitch = this.smoothedTargetPitch + pitchToRaw * blendSpeed;

        let yawDelta = this.getAngleDelta(this.currentYaw, this.smoothedTargetYaw);
        if (Math.abs(yawDelta) < this.YAW_DEAD_ZONE) yawDelta = 0;
        yawDelta = Math.max(-this.MAX_YAW_VELOCITY, Math.min(this.MAX_YAW_VELOCITY, yawDelta));

        this.currentYaw = this.wrapAngle(this.currentYaw + yawDelta * this.YAW_SMOOTH_SPEED);

        let pitchDelta = this.smoothedTargetPitch - this.currentPitch;
        if (Math.abs(pitchDelta) < this.PITCH_DEAD_ZONE) pitchDelta = 0;
        this.currentPitch = this.currentPitch + pitchDelta * this.PITCH_SMOOTH_SPEED;
    }

    getInterpolatedPoint(indexFloat) {
        const idx = Math.min(Math.floor(indexFloat), this.boxPositions.length - 2);
        const frac = indexFloat - idx;
        return PathRotationsUtility.interpolateBoxPosition(this.boxPositions, idx, frac);
    }

    getDynamicBlendSpeed() {
        if (this.ticksSinceNodeSkip >= this.SKIP_RECOVERY_TICKS) return this.TARGET_BLEND_NORMAL;
        const recovery = this.ticksSinceNodeSkip / this.SKIP_RECOVERY_TICKS;
        const easedRecovery = 1 - (1 - recovery) * (1 - recovery);
        return this.TARGET_BLEND_SKIP + (this.TARGET_BLEND_NORMAL - this.TARGET_BLEND_SKIP) * easedRecovery;
    }

    handleSharpTurnDeceleration(curvature) {
        if (curvature > this.SHARP_TURN_THRESHOLD) {
            this.YAW_SMOOTH_SPEED = Math.max(this.MIN_SMOOTH_SPEED, this.YAW_SMOOTH_SPEED * 0.4);
        }
    }

    getYawLookaheadDistance() {
        const localCurvature = this.computeLocalCurvature(Math.floor(this.currentPathPosition));
        const normalizedCurvature = Math.max(0, Math.min(1, localCurvature / this.CURVATURE_FULL_REDUCTION_ANGLE));

        const dynamicYawAhead = this.BASE_YAW_AHEAD_DISTANCE - (this.BASE_YAW_AHEAD_DISTANCE - this.MIN_YAW_AHEAD_DISTANCE) * normalizedCurvature;
        return dynamicYawAhead;
    }

    computeLocalCurvature(centerIndex) {
        if (!this.boxPositions || this.boxPositions.length < 3) return 0;

        const radius = this.DYNAMIC_YAW_CURVATURE_RADIUS;
        const start = Math.max(1, centerIndex - radius);
        const end = Math.min(this.boxPositions.length - 2, centerIndex + radius);

        let maxAngleDeg = 0;
        for (let i = start; i <= end; i++) {
            const angle = this.calculateAngleBetweenNodes(this.boxPositions[i - 1], this.boxPositions[i], this.boxPositions[i + 1]);
            if (angle > maxAngleDeg) maxAngleDeg = angle;
        }
        return maxAngleDeg;
    }

    calculateAngleBetweenNodes(prev, curr, next) {
        const v1 = { x: curr.x - prev.x, z: curr.z - prev.z };
        const v2 = { x: next.x - curr.x, z: next.z - curr.z };
        const mag1 = Math.sqrt(v1.x ** 2 + v1.z ** 2);
        const mag2 = Math.sqrt(v2.x ** 2 + v2.z ** 2);

        if (mag1 < 0.0001 || mag2 < 0.0001) return 0;
        let cosAngle = (v1.x * v2.x + v1.z * v2.z) / (mag1 * mag2);
        return (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;
    }

    getDistSq(pos, box) {
        return (pos.x - (box.x + 0.5)) ** 2 + (pos.y - (box.y + 0.5)) ** 2 + (pos.z - (box.z + 0.5)) ** 2;
    }

    wrapAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    getAngleDelta(from, to) {
        return this.wrapAngle(to - from);
    }

    PathRotations(splineData) {
        if (!this.cachedLookPoints) {
            this.cachedLookPoints = Spline.CreateLookPoints(splineData, 1.5, true);
            this.boxPositions = this.cachedLookPoints;
        }

        const player = Player.getPlayer();
        if (!player || !this.boxPositions.length) return;

        if (this.currentBoxIndex >= this.boxPositions.length - 1) {
            this.complete = true;
            this.rotationActive = false;
            return;
        }

        this.updatePathProgress();
        this.calculateRawTargetAngles();

        if (!this.isInitialized) {
            this.currentYaw = player.getYaw();
            this.currentPitch = player.getPitch();
            this.smoothedTargetYaw = this.rawTargetYaw;
            this.smoothedTargetPitch = this.rawTargetPitch;
            this.isInitialized = true;
            this.rotationActive = true;
        }
    }
}

export const Rotations = new PathRotations();
