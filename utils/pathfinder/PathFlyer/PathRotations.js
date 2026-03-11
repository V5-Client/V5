import { BP, Vec3d } from '../../Constants';
import { raytraceBlocks } from '../../dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from '../../dependencies/BloomCore/Vector3';
import { MathUtils } from '../../Math';
import { PathExecutor } from '../PathExecutor';
import { PathRotationsUtility } from '../PathWalker/PathRotationsUtility';

class PathRotations {
    constructor() {
        this.BASE_KP = 0.045;
        this.KD = 1.1;
        this.MAX_VELOCITY = 4.5;
        this.ACCEL_LIMIT = 0.8;
        this.SETTLE_THRESHOLD = 0.08;
        this.YAW_DEADZONE = 0.4;
        this.PITCH_DEADZONE = 0.6;
        this.PROXIMITY_THRESHOLD = 7.0;
        this.MIN_LOOKAHEAD = 2.5;
        this.MAX_LOOKAHEAD = 6.0;
        this.LOOKAHEAD_STEP = 0.5;
        this.VISIBILITY_CACHE_MS = 50;
        this.ARRIVAL_THRESHOLD_XZ = 4.5;
        this.ARRIVAL_THRESHOLD_Y = 5.5;
        this.FINAL_COMPLETE_XZ = 1.45;
        this.FINAL_COMPLETE_Y = 2.35;
        this.SMOOTH_FACTOR_STRAIGHT = 0.015;
        this.SMOOTH_FACTOR_TURN = 0.15;
        this.STRAIGHT_DEADZONE = 0.15;

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
        this.currentPathPosition = 0.0;
        this.rotationActive = false;
        this.complete = false;
        this.currentTargetPoint = null;
        this.cachedVisible = { t: null, point: null, time: 0 };
        this.currentPathCurvatureDeg = 0;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.rawTargetYaw = 0;
        this.rawTargetPitch = 0;
        PathRotationsUtility.stopRotation();
    }

    isPointVisible(playerEyes, targetPoint) {
        const dx = targetPoint.x - playerEyes.x;
        const dy = targetPoint.y - playerEyes.y;
        const dz = targetPoint.z - playerEyes.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 0.2) return true;
        try {
            const dir = new Vector3(dx / dist, dy / dist, dz / dist);
            const hit = raytraceBlocks(
                [playerEyes.x, playerEyes.y, playerEyes.z],
                dir,
                dist + 0.1,
                (block) => {
                    if (!block || !block.type || block.type.getID() === 0) return false;
                    try {
                        const world = World.getWorld();
                        const pos = new BP(Math.floor(block.getX()), Math.floor(block.getY()), Math.floor(block.getZ()));
                        const state = world.getBlockState(pos);
                        return !state.getCollisionShape(world, pos).isEmpty();
                    } catch (e) {
                        return true;
                    }
                },
                true
            );
            if (!hit) return true;
            const hitX = hit[0] + 0.5;
            const hitY = hit[1] + 0.5;
            const hitZ = hit[2] + 0.5;
            const hitDist = Math.hypot(hitX - playerEyes.x, hitY - playerEyes.y, hitZ - playerEyes.z);
            return hitDist >= dist - 0.35;
        } catch (e) {
            return true;
        }
    }

    getClosestPointOnSegment(p, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq === 0) return 0;
        return Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy + (p.z - p1.z) * dz) / dSq));
    }

    getInterpolatedPoint(indexFloat, path = this.lookPoints) {
        if (!path || path.length === 0) return null;
        const idx = Math.floor(indexFloat);
        const frac = indexFloat - idx;
        const p1 = path[Math.max(0, Math.min(path.length - 1, idx))];
        const p2 = path[Math.max(0, Math.min(path.length - 1, idx + 1))];
        if (!p2 || frac <= 0) return p1;
        return new Vec3d(p1.x + (p2.x - p1.x) * frac, p1.y + (p2.y - p1.y) * frac, p1.z + (p2.z - p1.z) * frac);
    }

    getDistSq(a, b) {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    }

    updatePathPosition(path, currentPathPosition, playerEyes, backtrack, searchRange) {
        if (!path || path.length < 2) return { position: currentPathPosition, minDistSq: Infinity };
        let nextPosition = currentPathPosition;
        let minDistSq = Infinity;
        const closestIndex = Math.floor(currentPathPosition);
        const start = Math.max(0, closestIndex - backtrack);
        const end = Math.min(path.length - 2, closestIndex + searchRange);
        for (let i = start; i <= end; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const segT = this.getClosestPointOnSegment(playerEyes, p1, p2);
            const projected = this.getInterpolatedPoint(i + segT, path);
            if (!projected) continue;
            const dSq = this.getDistSq(playerEyes, projected);
            if (dSq < minDistSq) {
                minDistSq = dSq;
                nextPosition = i + segT;
            }
        }
        return { position: nextPosition, minDistSq };
    }

    isWithinArrivalThreshold(a, b) {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const distSqXZ = dx * dx + dz * dz;
        const yDiff = Math.abs(a.y - b.y);
        return distSqXZ <= this.ARRIVAL_THRESHOLD_XZ * this.ARRIVAL_THRESHOLD_XZ && yDiff <= this.ARRIVAL_THRESHOLD_Y;
    }

    isWithinFinalThreshold(a, b) {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const distSqXZ = dx * dx + dz * dz;
        const yDiff = Math.abs(a.y - b.y);
        return distSqXZ <= this.FINAL_COMPLETE_XZ * this.FINAL_COMPLETE_XZ && yDiff <= this.FINAL_COMPLETE_Y;
    }

    getAngleBetweenVectorsDeg(v1, v2) {
        const mag1 = Math.hypot(v1.x, v1.y, v1.z);
        const mag2 = Math.hypot(v2.x, v2.y, v2.z);
        if (mag1 < 1e-6 || mag2 < 1e-6) return 0;
        const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (mag1 * mag2);
        return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    }

    getCrossTrackError(p, a, b) {
        const num = Math.abs((b.z - a.z) * p.x - (b.x - a.x) * p.z + b.x * a.z - b.z * a.x);
        const den = Math.hypot(b.z - a.z, b.x - a.x);
        return num / (den || 1);
    }

    isPathStraight(startIndex, lookaheadCount) {
        if (!this.lookPoints || startIndex + lookaheadCount >= this.lookPoints.length) return false;
        const startNode = this.lookPoints[startIndex];
        const endNode = this.lookPoints[startIndex + lookaheadCount];
        for (let i = 1; i < lookaheadCount; i++) {
            if (this.getCrossTrackError(this.lookPoints[startIndex + i], startNode, endNode) > 0.35) return false;
        }
        return true;
    }

    getAdaptiveLookaheadPoints() {
        const idx = Math.floor(this.currentPathPosition);
        if (idx + 2 >= this.lookPoints.length) return this.MIN_LOOKAHEAD;
        const a0 = this.lookPoints[idx];
        const a1 = this.lookPoints[Math.min(idx + 1, this.lookPoints.length - 1)];
        const baseDir = { x: a1.x - a0.x, y: a1.y - a0.y, z: a1.z - a0.z };
        let maxAngle = 0;
        for (let k = 2; k <= 8; k++) {
            const i0 = Math.min(idx + k, this.lookPoints.length - 2);
            const b0 = this.lookPoints[i0];
            const b1 = this.lookPoints[i0 + 1];
            const futureDir = { x: b1.x - b0.x, y: b1.y - b0.y, z: b1.z - b0.z };
            maxAngle = Math.max(maxAngle, this.getAngleBetweenVectorsDeg(baseDir, futureDir));
        }
        this.currentPathCurvatureDeg = maxAngle;
        if (maxAngle < 5) return 12.0;
        if (maxAngle < 12) return 8.0;
        if (maxAngle < 22) return 5.5;
        return 3.0;
    }

    findVisibleLookTarget(playerEyes, idealLookaheadPoints) {
        const now = Date.now();
        const lastIndex = this.lookPoints.length - 1;
        let lookahead = Math.min(15.0, Math.max(this.MIN_LOOKAHEAD, idealLookaheadPoints));
        while (lookahead >= this.MIN_LOOKAHEAD - 1e-6) {
            const t = Math.min(lastIndex, this.currentPathPosition + lookahead);
            const point = this.getInterpolatedPoint(t);
            if (point && this.isPointVisible(playerEyes, point)) {
                this.cachedVisible = { t, point, time: now };
                return point;
            }
            lookahead -= this.LOOKAHEAD_STEP;
        }
        const t = Math.min(lastIndex, this.currentPathPosition + this.MIN_LOOKAHEAD);
        const point = this.getInterpolatedPoint(t);
        this.cachedVisible = { t, point, time: now };
        return point || this.lookPoints[lastIndex];
    }

    updateLookPoint() {
        const player = Player.getPlayer();
        if (!player || !this.lookPoints) return;
        const playerEyes = player.getEyePos();
        const projection = this.updatePathPosition(this.lookPoints, this.currentPathPosition, playerEyes, 1, 10);
        const distToPath = Math.sqrt(projection.minDistSq);
        if (projection.position > this.currentPathPosition + 0.05 || distToPath > 1.5) {
            this.currentPathPosition = projection.position;
        }
        const baseLookahead = this.getAdaptiveLookaheadPoints();
        const idx = Math.floor(this.currentPathPosition);
        const isActuallyStraight = this.isPathStraight(idx, 15);
        let idealT = Math.min(this.lookPoints.length - 1, this.currentPathPosition + (isActuallyStraight ? 18.0 : baseLookahead));
        if (isActuallyStraight) {
            const farPoint = this.getInterpolatedPoint(idealT);
            if (farPoint && this.isPointVisible(playerEyes, farPoint)) {
                this.currentTargetPoint = farPoint;
            }
        } else if (!this.currentTargetPoint || Math.abs(idealT - (this.cachedVisible.t || 0)) > 0.2) {
            const newTarget = this.findVisibleLookTarget(playerEyes, idealT);
            if (newTarget) this.currentTargetPoint = newTarget;
        }
        const angles = MathUtils.calculateAbsoluteAngles(this.currentTargetPoint);
        const desiredYaw = MathUtils.wrapTo180(angles.yaw);
        const yawDelta = MathUtils.getAngleDifference(this.rawTargetYaw, desiredYaw);
        let alpha = this.currentPathCurvatureDeg < 4.0 ? this.SMOOTH_FACTOR_STRAIGHT : this.SMOOTH_FACTOR_TURN;
        if (Math.abs(yawDelta) < 2.0) alpha *= 0.5;
        if (!(this.currentPathCurvatureDeg < 4.0 && Math.abs(yawDelta) < this.STRAIGHT_DEADZONE)) {
            this.rawTargetYaw = MathUtils.wrapTo180(this.rawTargetYaw + yawDelta * alpha);
        }
        this.rawTargetPitch = this.rawTargetPitch + (angles.pitch - this.rawTargetPitch) * alpha;
        const lastPoint = this.lookPoints[this.lookPoints.length - 1];
        if (this.currentPathPosition >= this.lookPoints.length - 1.2 || this.isWithinArrivalThreshold(playerEyes, lastPoint)) {
            if (this.isWithinFinalThreshold(playerEyes, lastPoint)) {
                this.complete = true;
                this.rotationActive = false;
            }
        }
    }

    applyHumanizedPhysics() {
        this.currentYaw = MathUtils.wrapTo180(this.currentYaw);
        const yawError = MathUtils.getAngleDifference(this.currentYaw, this.rawTargetYaw);
        const pitchError = this.rawTargetPitch - this.currentPitch;
        const world = World.getWorld();
        const bp = new BP(Math.floor(Player.getX()), Math.floor(Player.getY() + 1), Math.floor(Player.getZ()));
        let isNarrow = false;
        try {
            const side1 = !world
                .getBlockState(bp.add(1, 0, 0))
                .getCollisionShape(world, bp.add(1, 0, 0))
                .isEmpty();
            const side2 = !world
                .getBlockState(bp.add(-1, 0, 0))
                .getCollisionShape(world, bp.add(-1, 0, 0))
                .isEmpty();
            const side3 = !world
                .getBlockState(bp.add(0, 0, 1))
                .getCollisionShape(world, bp.add(0, 0, 1))
                .isEmpty();
            const side4 = !world
                .getBlockState(bp.add(0, 0, -1))
                .getCollisionShape(world, bp.add(0, 0, -1))
                .isEmpty();
            isNarrow = (side1 && side2) || (side3 && side4);
        } catch (e) {}
        const isStraight = this.currentPathCurvatureDeg < 4.0;
        const friction = isStraight ? 0.82 : 0.9;
        const dynamicKD = isNarrow ? this.KD * 1.6 : isStraight ? this.KD * 1.2 : this.KD;
        const dynamicAccel = isNarrow ? this.ACCEL_LIMIT * 0.65 : isStraight ? this.ACCEL_LIMIT * 0.8 : this.ACCEL_LIMIT;
        if (Math.abs(yawError) < this.SETTLE_THRESHOLD && Math.abs(this.yawVelocity) < 0.05) {
            this.currentYaw = this.rawTargetYaw;
            this.yawVelocity = 0;
        } else {
            let desiredYawAccel = yawError * this.BASE_KP - this.yawVelocity * dynamicKD;
            desiredYawAccel = Math.max(-dynamicAccel, Math.min(dynamicAccel, desiredYawAccel));
            this.yawVelocity = (this.yawVelocity + desiredYawAccel) * friction;
            this.yawVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.yawVelocity));
            this.currentYaw += this.yawVelocity;
        }
        if (Math.abs(pitchError) < this.SETTLE_THRESHOLD && Math.abs(this.pitchVelocity) < 0.05) {
            this.currentPitch = this.rawTargetPitch;
            this.pitchVelocity = 0;
        } else {
            let desiredPitchAccel = pitchError * this.BASE_KP - this.pitchVelocity * this.KD;
            desiredPitchAccel = Math.max(-this.ACCEL_LIMIT, Math.min(this.ACCEL_LIMIT, desiredPitchAccel));
            this.pitchVelocity = (this.pitchVelocity + desiredPitchAccel) * friction;
            this.pitchVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.pitchVelocity));
            this.currentPitch += this.pitchVelocity;
        }
        this.currentPitch = Math.max(-90, Math.min(90, this.currentPitch));
    }

    beginFlyRotations(preGeneratedLookPoints) {
        if (!preGeneratedLookPoints || preGeneratedLookPoints.length < 2) {
            this.resetRotations();
            this.complete = true;
            return;
        }
        const player = Player.getPlayer();
        if (!player) return;
        this.lookPoints = preGeneratedLookPoints;
        this.currentPathPosition = 0.0;
        this.complete = false;
        this.cachedVisible = { t: null, point: null, time: 0 };
        this.currentYaw = MathUtils.wrapTo180(player.getYaw());
        this.currentPitch = player.getPitch();
        this.rawTargetYaw = this.currentYaw;
        this.rawTargetPitch = this.currentPitch;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.rotationActive = true;
    }

    stopRotations() {
        this.resetRotations();
    }
}

export const FlyRotations = new PathRotations();
