import { MathUtils } from '../../Math';
import { PathRotationsUtility } from '../../pathfinder/PathWalker/PathRotationsUtility';
import { Spline } from '../PathSpline';
import { BP } from '../../Constants';
import RenderUtils from '../../render/RendererUtils';

class PathRotations {
    constructor() {
        this.LOOK_AHEAD_DISTANCE = 4;
        this.AIRBORNE_LOOK_AHEAD = 12;
        this.MAX_AIR_HEIGHT = 10;
        this.BASE_YAW_AHEAD_DISTANCE = 4;
        this.MIN_YAW_AHEAD_DISTANCE = 0.5;
        this.DYNAMIC_YAW_CURVATURE_RADIUS = 4;
        this.CURVATURE_FULL_REDUCTION_ANGLE = 45;
        this.MIN_PITCH_LOOKAHEAD = 2.5;
        this.INITIAL_YAW_SMOOTH_SPEED = 0.1;
        this.YAW_SMOOTH_SPEED = 0.08;
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
        this.CATCH_UP_REACH_DISTANCE = 2.5;

        this.resetRotations();
        this.onStep();
        // this.onRender();
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
        this.YAW_SMOOTH_SPEED = this.INITIAL_YAW_SMOOTH_SPEED;
        this.currentTargetPoint = null;
        this.lockedAirbornePoint = null;
        this.isWaitingForLandingReach = false;

        PathRotationsUtility.stopRotation();
    }

    onStep() {
        this.stepRegister = register('step', () => {
            if (!this.rotationActive || !this.cachedLookPoints) return;
            this.handleAll();
        }).setFps(120);
    }

    onRender() {
        this.render = register('postRenderWorld', () => {
            if (!this.boxPositions) return;
            const px = Player.getX();
            const pz = Player.getZ();
            const airFactor = this.getAirborneFactor();
            for (let i = 0; i < this.boxPositions.length; i++) {
                const pos = this.boxPositions[i];
                if (Math.abs(pos.x - px) < 64 && Math.abs(pos.z - pz) < 64) {
                    RenderUtils.drawBox(pos, [255, 0, 0, 100], true);
                }
            }
            if (this.currentTargetPoint) {
                const color = airFactor > 0 ? [0, 255, 0, 255] : [0, 0, 255, 255];
                RenderUtils.drawBox(this.currentTargetPoint, color, true);
            }
        });
    }

    getDistanceToFloor() {
        let x = Math.floor(Player.getX());
        let y = Math.floor(Player.getY()) - 1;
        let z = Math.floor(Player.getZ());
        const maxDistance = 100;
        const world = World.getWorld();
        for (let distance = 0; distance < maxDistance; distance++) {
            if (y <= 0) return distance;
            const blockPosNMS = new BP(x, y, z);
            const blockState = world.getBlockState(blockPosNMS);
            if (!blockState.getCollisionShape(world, blockPosNMS).isEmpty()) {
                return distance;
            }
            y--;
        }
        return maxDistance;
    }

    getAirborneFactor() {
        const dist = this.getDistanceToFloor();
        if (dist < 7 || Client.getMinecraft().options.jumpKey.wasPressed()) return 0;
        return Math.max(0, Math.min(1, dist / this.MAX_AIR_HEIGHT));
    }

    getLookAheadTurnSeverity() {
        if (!this.boxPositions || this.boxPositions.length < 3) return 1.0;
        const startIndex = Math.floor(this.currentPathPosition);
        const lookAheadCount = 10;
        const endIndex = Math.min(this.boxPositions.length - 2, startIndex + lookAheadCount);
        let totalTurnAngle = 0;
        for (let i = startIndex; i < endIndex; i++) {
            const angle = this.calculateAngleBetweenNodes(this.boxPositions[i], this.boxPositions[i + 1], this.boxPositions[i + 2]);
            totalTurnAngle += angle;
        }
        const maxThreshold = 90;
        const severity = Math.max(0, Math.min(1, totalTurnAngle / maxThreshold));
        return 1.0 + severity * 0.6;
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
        const airFactor = this.getAirborneFactor();
        const isAirborne = airFactor > 0.1;
        const dynamicAirLookahead = this.LOOK_AHEAD_DISTANCE + (this.AIRBORNE_LOOK_AHEAD - this.LOOK_AHEAD_DISTANCE) * airFactor;

        if (isAirborne && !this.isWaitingForLandingReach) {
            const targetIdx = Math.min(this.currentPathPosition + dynamicAirLookahead, this.boxPositions.length - 1);
            this.lockedAirbornePoint = {
                point: this.getInterpolatedPoint(targetIdx),
                index: targetIdx,
            };
            this.isWaitingForLandingReach = true;
        }

        if (this.isWaitingForLandingReach && !isAirborne) {
            const playerPos = Player.getPlayer().getEyePos();
            const distToLock = Math.sqrt(this.getDistSq(playerPos, this.lockedAirbornePoint.point));

            const RELEASE_THRESHOLD = 5.0;

            if (distToLock <= RELEASE_THRESHOLD || this.currentPathPosition >= this.lockedAirbornePoint.index) {
                this.isWaitingForLandingReach = false;
                this.lockedAirbornePoint = null;
            } else {
                this.currentTargetPoint = this.lockedAirbornePoint.point;
                const angles = MathUtils.calculateAbsoluteAngles(this.currentTargetPoint);
                this.rawTargetYaw = angles.yaw;
                this.rawTargetPitch = angles.pitch;
                return;
            }
        }

        let targetYawIdx, targetPitchIdx;

        const dynamicYawAhead = this.getYawLookaheadDistance();
        targetYawIdx = Math.min(this.currentPathPosition + dynamicYawAhead, this.boxPositions.length - 1);
        targetPitchIdx = Math.min(this.currentPathPosition + this.LOOK_AHEAD_DISTANCE, this.boxPositions.length - 1);

        const yawPoint = this.getInterpolatedPoint(targetYawIdx);
        const pitchPoint = this.getInterpolatedPoint(targetPitchIdx);

        if (!yawPoint || !pitchPoint) return;

        this.currentTargetPoint = pitchPoint;
        this.rawTargetYaw = MathUtils.calculateAbsoluteAngles(yawPoint).yaw;
        this.rawTargetPitch = MathUtils.calculateAbsoluteAngles(pitchPoint).pitch;
    }

    applySmoothing(blendSpeed) {
        const absoluteYawDelta = this.getAngleDelta(this.currentYaw, this.rawTargetYaw);
        const absolutePitchDelta = this.rawTargetPitch - this.currentPitch;

        const yawToRaw = this.getAngleDelta(this.smoothedTargetYaw, this.rawTargetYaw);
        const pitchToRaw = this.rawTargetPitch - this.smoothedTargetPitch;

        this.smoothedTargetYaw = this.wrapAngle(this.smoothedTargetYaw + yawToRaw * blendSpeed);
        this.smoothedTargetPitch = this.smoothedTargetPitch + pitchToRaw * blendSpeed;

        let yawDelta = this.getAngleDelta(this.currentYaw, this.smoothedTargetYaw);
        if (Math.abs(yawDelta) < this.YAW_DEAD_ZONE) yawDelta = 0;

        const CATCH_UP_THRESHOLD = 2.0; // Degrees before punishment kicks in
        const PUNISHMENT_FACTOR = 1.5; // How hard to push back (multiplier)

        if (Math.abs(absoluteYawDelta) > CATCH_UP_THRESHOLD) {
            yawDelta += absoluteYawDelta * this.MIN_SMOOTH_SPEED * PUNISHMENT_FACTOR;
        }

        yawDelta = Math.max(-this.MAX_YAW_VELOCITY, Math.min(this.MAX_YAW_VELOCITY, yawDelta));

        this.currentYaw = this.wrapAngle(this.currentYaw + yawDelta * this.YAW_SMOOTH_SPEED);

        let pitchDelta = this.smoothedTargetPitch - this.currentPitch;
        if (Math.abs(pitchDelta) < this.PITCH_DEAD_ZONE) pitchDelta = 0;

        if (Math.abs(absolutePitchDelta) > CATCH_UP_THRESHOLD) {
            pitchDelta += absolutePitchDelta * this.MIN_SMOOTH_SPEED * PUNISHMENT_FACTOR;
        }

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
        const airFactor = this.getAirborneFactor();
        const turnBoostMultiplier = this.getLookAheadTurnSeverity();
        if (airFactor === 0) {
            this.YAW_SMOOTH_SPEED = this.INITIAL_YAW_SMOOTH_SPEED * turnBoostMultiplier;
        }
    }

    getYawLookaheadDistance() {
        const localCurvature = this.computeLocalCurvature(Math.floor(this.currentPathPosition));
        const normalizedCurvature = Math.max(0, Math.min(1, localCurvature / this.CURVATURE_FULL_REDUCTION_ANGLE));
        return this.BASE_YAW_AHEAD_DISTANCE - (this.BASE_YAW_AHEAD_DISTANCE - this.MIN_YAW_AHEAD_DISTANCE) * normalizedCurvature;
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

    pathRotations(splineData) {
        if (!this.cachedLookPoints) {
            this.cachedLookPoints = Spline.CreateLookPoints(splineData, 1.5, false);
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
