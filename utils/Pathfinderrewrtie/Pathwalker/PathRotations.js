import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { Vec3d } from '../../Constants';

class PathRotations {
    constructor() {
        this.LOOK_AHEAD_DISTANCE = 4;
        this.BASE_YAW_AHEAD_DISTANCE = 4;
        // Removed YAW_AHEAD_JUMP_MULTIPLIER
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

        this.currentBoxIndex = 1;
        this.lastBoxIndex = 0;
        this.currentPathPosition = 1.0;
        this.isInitialized = false;
        this.complete = false;
        this.rotationActive = false;

        this.rawTargetYaw = 0;
        this.rawTargetPitch = 0;
        this.smoothedTargetYaw = 0;
        this.smoothedTargetPitch = 0;
        this.currentYaw = 0;
        this.currentPitch = 0;

        this.ticksSinceNodeSkip = 999;
        this.cachedLookPoints = null;

        register('step', () => {
            if (!this.rotationActive) return;

            const targetBlendSpeed = this.getTargetBlendSpeed();
            const curvature = this.computeLocalCurvature(this.cachedLookPoints, this.currentBoxIndex);

            let dynamicYawSpeed = this.YAW_SMOOTH_SPEED;
            if (curvature > this.SHARP_TURN_THRESHOLD) {
                dynamicYawSpeed = Math.max(this.MIN_SMOOTH_SPEED, this.YAW_SMOOTH_SPEED * 0.4);
            }

            const yawToRaw = this.getAngleDelta(this.smoothedTargetYaw, this.rawTargetYaw);
            const pitchToRaw = this.rawTargetPitch - this.smoothedTargetPitch;

            this.smoothedTargetYaw = this.wrapAngle(this.smoothedTargetYaw + yawToRaw * targetBlendSpeed);
            this.smoothedTargetPitch = this.smoothedTargetPitch + pitchToRaw * targetBlendSpeed;

            let yawDelta = this.getAngleDelta(this.currentYaw, this.smoothedTargetYaw);
            if (Math.abs(yawDelta) < this.YAW_DEAD_ZONE) yawDelta = 0;

            yawDelta = Math.max(-this.MAX_YAW_VELOCITY, Math.min(this.MAX_YAW_VELOCITY, yawDelta));

            this.currentYaw = this.wrapAngle(this.currentYaw + yawDelta * dynamicYawSpeed);

            let pitchDelta = this.smoothedTargetPitch - this.currentPitch;
            if (Math.abs(pitchDelta) < this.PITCH_DEAD_ZONE) pitchDelta = 0;
            this.currentPitch = this.currentPitch + pitchDelta * this.PITCH_SMOOTH_SPEED;

            PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        }).setFps(120);
    }

    pathComplete() {
        return this.complete;
    }

    getCurrentBoxIndex() {
        return this.currentBoxIndex;
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
        this.cachedLookPoints = null;
    }

    wrapAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    getAngleDelta(from, to) {
        return this.wrapAngle(to - from);
    }

    getTargetBlendSpeed() {
        if (this.ticksSinceNodeSkip >= this.SKIP_RECOVERY_TICKS) return this.TARGET_BLEND_NORMAL;
        const recovery = this.ticksSinceNodeSkip / this.SKIP_RECOVERY_TICKS;
        const easedRecovery = 1 - (1 - recovery) * (1 - recovery);
        return this.TARGET_BLEND_SKIP + (this.TARGET_BLEND_NORMAL - this.TARGET_BLEND_SKIP) * easedRecovery;
    }

    computeLocalCurvature(boxPositions, centerIndex, radius = this.DYNAMIC_YAW_CURVATURE_RADIUS) {
        if (!boxPositions || boxPositions.length < 3) return 0;
        const start = Math.max(1, centerIndex - radius);
        const end = Math.min(boxPositions.length - 2, centerIndex + radius);
        let maxAngleDeg = 0;
        for (let i = start; i <= end; i++) {
            const prev = boxPositions[i - 1];
            const curr = boxPositions[i];
            const next = boxPositions[i + 1];
            const v1x = curr.x - prev.x;
            const v1z = curr.z - prev.z;
            const v2x = next.x - curr.x;
            const v2z = next.z - curr.z;
            const mag1 = Math.sqrt(v1x * v1x + v1z * v1z);
            const mag2 = Math.sqrt(v2x * v2x + v2z * v2z);
            if (mag1 < 0.0001 || mag2 < 0.0001) continue;
            let cosAngle = (v1x * v2x + v1z * v2z) / (mag1 * mag2);
            cosAngle = Math.max(-1, Math.min(1, cosAngle));
            const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
            if (angleDeg > maxAngleDeg) maxAngleDeg = angleDeg;
        }
        return maxAngleDeg;
    }

    calculateYawLookahead(boxPositions, pathPosition) {
        const baseYawAhead = this.BASE_YAW_AHEAD_DISTANCE;
        const minYawAhead = this.MIN_YAW_AHEAD_DISTANCE;
        if (!boxPositions || boxPositions.length < 3) return baseYawAhead;
        const centerIndex = Math.max(1, Math.min(boxPositions.length - 2, Math.floor(pathPosition)));
        const localCurvature = this.computeLocalCurvature(boxPositions, centerIndex);
        const normalizedCurvature = Math.max(0, Math.min(1, localCurvature / this.CURVATURE_FULL_REDUCTION_ANGLE));
        return baseYawAhead - (baseYawAhead - minYawAhead) * normalizedCurvature;
    }

    PathRotations(splineData) {
        if (!this.cachedLookPoints) {
            this.cachedLookPoints = Spline.CreateLookPoints(splineData, 1.5, true);
        }
        const boxPositions = this.cachedLookPoints;
        const player = Player.getPlayer();
        if (!player || !boxPositions || boxPositions.length === 0) return;

        if (this.currentBoxIndex >= boxPositions.length - 1) {
            this.complete = true;
            this.rotationActive = false;
            return;
        }

        const playerEyes = player.getEyePos();

        let closestBoxDistanceSq = Infinity;
        let newCurrentBoxIndex = this.currentBoxIndex;
        const startIndex = Math.max(0, this.currentBoxIndex - this.BOX_RESET_SEARCH_RANGE);
        const endIndex = Math.min(boxPositions.length, this.currentBoxIndex + this.BOX_RESET_SEARCH_RANGE);

        for (let i = startIndex; i < endIndex; i++) {
            const box = boxPositions[i];
            const dx = playerEyes.x - (box.x + 0.5);
            const dy = playerEyes.y - (box.y + 0.5);
            const dz = playerEyes.z - (box.z + 0.5);
            const distanceSq = dx * dx + dy * dy + dz * dz;
            if (distanceSq < closestBoxDistanceSq) {
                closestBoxDistanceSq = distanceSq;
                newCurrentBoxIndex = i;
            }
        }

        if (newCurrentBoxIndex >= this.currentBoxIndex) {
            this.currentBoxIndex = newCurrentBoxIndex;
        } else if (newCurrentBoxIndex < this.currentBoxIndex - this.BOX_SWITCH_HYSTERESIS) {
            this.currentBoxIndex = newCurrentBoxIndex;
        }

        const skipAmount = this.currentBoxIndex - this.lastBoxIndex;
        if (skipAmount > this.NODE_SKIP_THRESHOLD) this.ticksSinceNodeSkip = 0;
        else this.ticksSinceNodeSkip++;
        this.lastBoxIndex = this.currentBoxIndex;

        const currentBox = boxPositions[this.currentBoxIndex];
        const nextBox = boxPositions[Math.min(this.currentBoxIndex + 1, boxPositions.length - 1)];
        const dx = nextBox.x - currentBox.x;
        const dz = nextBox.z - currentBox.z;
        const lenSq = dx * dx + dz * dz;
        let t = 0;
        if (lenSq > 0.0001) {
            t = ((playerEyes.x - (currentBox.x + 0.5)) * dx + (playerEyes.z - (currentBox.z + 0.5)) * dz) / lenSq;
        }
        this.currentPathPosition = this.currentBoxIndex + Math.max(0, Math.min(1, t));

        const dynamicYawAhead = this.calculateYawLookahead(boxPositions, this.currentPathPosition);
        const targetYawIdx = Math.min(this.currentPathPosition + dynamicYawAhead, boxPositions.length - 1);
        const targetPitchIdx = Math.min(this.currentPathPosition + this.LOOK_AHEAD_DISTANCE, boxPositions.length - 1);

        const yIdx = Math.min(Math.floor(targetYawIdx), boxPositions.length - 2);
        const yFrac = targetYawIdx - yIdx;
        const yawPoint = PathRotationsUtility.interpolateBoxPosition(boxPositions, yIdx, yFrac);

        const pIdx = Math.min(Math.floor(targetPitchIdx), boxPositions.length - 2);
        const pFrac = targetPitchIdx - pIdx;
        const pitchPoint = PathRotationsUtility.interpolateBoxPosition(boxPositions, pIdx, pFrac);

        if (!yawPoint || !pitchPoint) return;

        const anglesYaw = MathUtils.calculateAbsoluteAngles(yawPoint);
        const anglesPitch = MathUtils.calculateAbsoluteAngles(pitchPoint);

        this.rawTargetYaw = anglesYaw.yaw;
        this.rawTargetPitch = anglesPitch.pitch;

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
