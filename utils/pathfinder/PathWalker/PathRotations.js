import { BP, Vec3d } from '../../Constants';
import { raytraceBlocks } from '../../dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from '../../dependencies/BloomCore/Vector3';
import { MathUtils } from '../../Math';
import { PathExecutor } from '../PathExecutor';
import { Spline } from '../PathSpline';
import { PathRotationsUtility } from './PathRotationsUtility';

class PathRotations {
    constructor() {
        this.MIN_LOOKAHEAD = 1.1;
        this.MAX_LOOKAHEAD = 3.5;
        this.RECOVERY_MIN_LOOKAHEAD = 0.1;
        this.PROXIMITY_THRESHOLD = 4.0;
        this.COMPLETION_RADIUS = 1.6;
        this.BASE_KP = 0.05;
        this.KD = 0.55;
        this.MAX_VELOCITY = 8.0;
        this.ACCEL_LIMIT = 1.2;
        this.SETTLE_THRESHOLD = 0.15;
        this.PITCH_DEADZONE = 1.8;
        this.YAW_DEADZONE = 1.2;
        this.SMOOTH_FACTOR = 0.1;
        this.MAX_LOOK_DISTANCE = 0.8;
        this.LOOKAHEAD_STEP = 0.4;
        this.RECOVERY_LOOKAHEAD_STEP = 0.15;
        this.VISIBILITY_CACHE_MS = 50;
        this.MAX_DIRECTION_DIVERGENCE = 50.0;
        this.MAX_UPWARD_PITCH = -45.0;
        this.lookaheadOverride = null;
        this.lookaheadOverrideExpiry = 0;
        this.currentPathCurvature = 0;

        this.resetRotations();

        PathExecutor.onStep(() => {
            if (!this.rotationActive || !this.boxPositions) return;
            this.updateLookPoint();
            this.applyHumanizedPhysics();
            PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        });

        PathExecutor.onTick(() => {
            if (this.lookaheadOverrideExpiry > 0) {
                this.lookaheadOverrideExpiry--;
                if (this.lookaheadOverrideExpiry <= 0) {
                    this.lookaheadOverride = null;
                }
            }
        });
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
        this.smoothedLookahead = this.MAX_LOOKAHEAD;
        this.cachedLookahead = null;
        this.lastVisibilityCheck = 0;
        this.lookaheadOverride = null;
        this.lookaheadOverrideExpiry = 0;
        this.unseenSince = 0;
        this.currentPathCurvature = 0;
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
            return hitDist >= dist - 0.5;
        } catch (e) {
            return true;
        }
    }

    getAngleBetweenVectors(v1, v2) {
        const mag1 = Math.hypot(v1.x, v1.y, v1.z);
        const mag2 = Math.hypot(v2.x, v2.y, v2.z);
        if (mag1 < 0.001 || mag2 < 0.001) return 0;
        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
        const val = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(val) * (180 / Math.PI);
    }

    setTemporaryLookahead(distance, durationTicks = 30) {
        this.lookaheadOverride = distance;
        this.lookaheadOverrideExpiry = durationTicks;
        this.smoothedLookahead = distance;
        this.cachedLookahead = null;
    }

    clearLookaheadOverride() {
        this.lookaheadOverride = null;
        this.lookaheadOverrideExpiry = 0;
    }

    isInRecoveryMode() {
        return this.lookaheadOverride !== null && this.lookaheadOverrideExpiry > 0;
    }

    findVisibleLookahead(playerEyes, idealLookahead) {
        const now = Date.now();
        if (!this.isInRecoveryMode() && this.cachedLookahead !== null && now - this.lastVisibilityCheck < this.VISIBILITY_CACHE_MS) {
            const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + this.cachedLookahead);
            return { point: this.getInterpolatedPoint(t), lookahead: this.cachedLookahead };
        }
        this.lastVisibilityCheck = now;
        const immediateT = Math.min(this.boxPositions.length - 1, this.currentPathPosition + 0.5);
        const immediatePoint = this.getInterpolatedPoint(immediateT);
        const vecImmediate = {
            x: immediatePoint.x - playerEyes.x,
            y: immediatePoint.y - playerEyes.y,
            z: immediatePoint.z - playerEyes.z,
        };
        const inRecovery = this.isInRecoveryMode();
        const effectiveMin = inRecovery ? this.RECOVERY_MIN_LOOKAHEAD : this.MIN_LOOKAHEAD;
        let lookahead = inRecovery ? idealLookahead : Math.max(idealLookahead, this.MIN_LOOKAHEAD);
        while (lookahead >= effectiveMin) {
            const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + lookahead);
            const point = this.getInterpolatedPoint(t);
            const dx = point.x - playerEyes.x;
            const dy = point.y - playerEyes.y;
            const dz = point.z - playerEyes.z;
            const horzDist = Math.hypot(dx, dz);
            if (lookahead >= this.MIN_LOOKAHEAD) {
                if (dy > 1.8 && horzDist < 0.8) {
                    lookahead -= this.LOOKAHEAD_STEP;
                    continue;
                }
                const pitch = -Math.atan2(dy, horzDist) * (180 / Math.PI);
                if (pitch < this.MAX_UPWARD_PITCH && horzDist < 1.5) {
                    lookahead -= this.LOOKAHEAD_STEP;
                    continue;
                }
                const vecTarget = { x: dx, y: dy, z: dz };
                const divergence = this.getAngleBetweenVectors(vecImmediate, vecTarget);
                if (divergence > this.MAX_DIRECTION_DIVERGENCE) {
                    lookahead -= this.LOOKAHEAD_STEP;
                    continue;
                }
            }
            if (this.isPointVisible(playerEyes, point)) {
                this.cachedLookahead = lookahead;
                return { point, lookahead };
            }
            const step = lookahead < this.MIN_LOOKAHEAD ? this.RECOVERY_LOOKAHEAD_STEP : this.LOOKAHEAD_STEP;
            lookahead -= step;
        }
        this.cachedLookahead = effectiveMin;
        const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + effectiveMin);
        return { point: this.getInterpolatedPoint(t), lookahead: effectiveMin };
    }

    getAdaptiveLookahead(playerEyes) {
        if (this.lookaheadOverride !== null && this.lookaheadOverrideExpiry > 0) return this.lookaheadOverride;
        const targetIndex = Math.floor(this.currentPathPosition);
        if (targetIndex + 3 >= this.boxPositions.length) return this.smoothedLookahead;
        const pathPoint = this.getInterpolatedPoint(this.currentPathPosition);
        const deviationFromPath = Math.hypot(playerEyes.x - pathPoint.x, playerEyes.z - pathPoint.z);
        const deviationFactor = Math.min(1, Math.max(0, (deviationFromPath - 1.6) / 2.0));
        const startIndex = this.boxPositions[targetIndex];
        const endIndex = this.boxPositions[Math.min(targetIndex + 2, this.boxPositions.length - 1)];
        const currDx = endIndex.x - startIndex.x;
        const currDy = endIndex.y - startIndex.y;
        const currDz = endIndex.z - startIndex.z;
        const startDirection = { x: currDx, y: currDy, z: currDz };
        const startDirectionMagnitude = Math.hypot(currDx, currDy, currDz);
        let maxAngle = 0;
        for (let lookahead = 4; lookahead <= 8; lookahead += 2) {
            const futureTargetIndex = Math.min(targetIndex + lookahead, this.boxPositions.length - 3);
            if (futureTargetIndex <= targetIndex + 2) continue;
            const futureA = this.boxPositions[futureTargetIndex];
            const futureB = this.boxPositions[Math.min(futureTargetIndex + 2, this.boxPositions.length - 1)];
            const futureDx = futureB.x - futureA.x;
            const futureDy = futureB.y - futureA.y;
            const futureDz = futureB.z - futureA.z;
            const futureDirection = { x: futureDx, y: futureDy, z: futureDz };
            const futureDirectionMagnitude = Math.hypot(futureDx, futureDy, futureDz);
            if (startDirectionMagnitude > 0.8 && futureDirectionMagnitude > 0.8) {
                const dotProduct =
                    (startDirection.x * futureDirection.x + startDirection.y * futureDirection.y + startDirection.z * futureDirection.z) /
                    (startDirectionMagnitude * futureDirectionMagnitude);
                const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                maxAngle = Math.max(maxAngle, angle);
            }
        }
        this.currentPathCurvature = maxAngle;
        const isFalling = Player.getMotionY() < -0.1;
        if (isFalling) maxAngle *= 0.5;
        const curveFactor = Math.min(1, Math.max(0, (maxAngle - 0.61) / 0.7));
        const adjustFactor = Math.max(deviationFactor, curveFactor);
        const targetLookaheadDistance = this.MAX_LOOKAHEAD - (this.MAX_LOOKAHEAD - this.MIN_LOOKAHEAD) * adjustFactor;
        let lerpFactor = targetLookaheadDistance > this.smoothedLookahead ? 0.1 : 0.05;
        this.smoothedLookahead += (targetLookaheadDistance - this.smoothedLookahead) * lerpFactor;
        return this.smoothedLookahead;
    }

    updateLookPoint() {
        const player = Player.getPlayer();
        if (!player) return;
        const playerEyes = player.getEyePos();
        const isFalling = Player.getMotionY() < -0.4;
        let bestT = this.currentPathPosition;
        let minDistanceSq = Infinity;
        const startIdx = Math.max(0, Math.floor(this.currentPathPosition) - 2);
        const endIdx = Math.min(this.boxPositions.length - 2, startIdx + 8);
        for (let i = startIdx; i <= endIdx; i++) {
            const p1 = this.boxPositions[i];
            const p2 = this.boxPositions[i + 1];
            if (!p1 || !p2) continue;
            const segmentProgress = isFalling ? this.getClosestPointOnSegmentHorizontal(playerEyes, p1, p2) : this.getClosestPointOnSegment(playerEyes, p1, p2);
            const candidateT = i + segmentProgress;
            if (isFalling && candidateT < this.currentPathPosition) continue;
            const projectedPoint = this.getInterpolatedPoint(candidateT);
            let distSq = isFalling
                ? Math.pow(playerEyes.x - projectedPoint.x, 2) + Math.pow(playerEyes.z - projectedPoint.z, 2)
                : this.getDistSq(playerEyes, projectedPoint);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestT = candidateT;
            }
        }
        if (minDistanceSq < this.PROXIMITY_THRESHOLD * this.PROXIMITY_THRESHOLD) this.currentPathPosition = bestT;
        const adaptiveLookahead = this.getAdaptiveLookahead(playerEyes);
        let result = this.findVisibleLookahead(playerEyes, adaptiveLookahead);
        const effectiveMin = this.isInRecoveryMode() ? this.RECOVERY_MIN_LOOKAHEAD : this.MIN_LOOKAHEAD;
        let targetVisible = this.isPointVisible(playerEyes, result.point);
        if (result.lookahead <= effectiveMin + 0.001 && !targetVisible) {
            if (!this.unseenSince) this.unseenSince = Date.now();
            if (Date.now() - this.unseenSince >= 600) {
                let attempts = 0;
                while (this.currentPathPosition > 0 && attempts < 8) {
                    this.currentPathPosition = Math.max(0, this.currentPathPosition - 1);
                    const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + effectiveMin);
                    if (this.isPointVisible(playerEyes, this.getInterpolatedPoint(t))) {
                        this.unseenSince = 0;
                        this.cachedLookahead = null;
                        result = this.findVisibleLookahead(playerEyes, adaptiveLookahead);
                        targetVisible = this.isPointVisible(playerEyes, result.point);
                        break;
                    }
                    attempts++;
                }
            }
        } else this.unseenSince = 0;
        let targetPoint = result.point;
        if (result.lookahead < this.smoothedLookahead) this.smoothedLookahead = this.smoothedLookahead * 0.9 + result.lookahead * 0.1;
        const rawDx = targetPoint.x - playerEyes.x;
        const rawDy = targetPoint.y - playerEyes.y;
        const rawDz = targetPoint.z - playerEyes.z;
        const rawHorz = Math.hypot(rawDx, rawDz);
        const rawPitch = -Math.atan2(rawDy, rawHorz) * (180 / Math.PI);
        if (rawPitch < -50 && rawHorz < 1.0) {
            const newDy = rawHorz * Math.tan(30 * (Math.PI / 180));
            targetPoint = new Vec3d(targetPoint.x, playerEyes.y + newDy, targetPoint.z);
        }
        const dx = targetPoint.x - playerEyes.x;
        const dy = targetPoint.y - playerEyes.y;
        const dz = targetPoint.z - playerEyes.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > this.MAX_LOOK_DISTANCE) {
            const scale = this.MAX_LOOK_DISTANCE / dist;
            targetPoint = new Vec3d(playerEyes.x + dx * scale, playerEyes.y + dy * scale, playerEyes.z + dz * scale);
        }
        this.currentTargetPoint = targetPoint;
        const angles = MathUtils.calculateAbsoluteAngles(this.currentTargetPoint);
        const targetYaw = this.wrapAngle(angles.yaw);
        const yawDelta = this.getAngleDelta(this.rawTargetYaw, targetYaw);
        const lastIndex = this.boxPositions.length - 1;
        const remainingPath = lastIndex - this.currentPathPosition;
        const finishFactor = remainingPath < 3.0 ? Math.max(0.1, remainingPath / 3.0) : 1.0;
        const isStraight = this.currentPathCurvature < 0.15;
        const dynamicSmooth = (isStraight ? this.SMOOTH_FACTOR * 0.5 : this.SMOOTH_FACTOR) / finishFactor;
        const dynamicYawDeadzone = (isStraight ? this.YAW_DEADZONE * 1.5 : this.YAW_DEADZONE) * finishFactor;
        if (Math.abs(yawDelta) > dynamicYawDeadzone) {
            this.rawTargetYaw = this.wrapAngle(this.rawTargetYaw + yawDelta * Math.min(1.0, dynamicSmooth));
        }
        const pitchDelta = angles.pitch - this.rawTargetPitch;
        if (Math.abs(pitchDelta) > this.PITCH_DEADZONE * finishFactor) {
            this.rawTargetPitch += pitchDelta * Math.min(1.0, dynamicSmooth);
        }
        const lastPoint = this.boxPositions[lastIndex];
        const endDistSq = Math.pow(playerEyes.x - lastPoint.x, 2) + Math.pow(playerEyes.y - lastPoint.y, 2) + Math.pow(playerEyes.z - lastPoint.z, 2);
        const nearEndBy3D = endDistSq <= Math.pow(this.COMPLETION_RADIUS, 2) && this.currentPathPosition >= lastIndex - 2.0;
        const atEndByPosition = this.currentPathPosition >= lastIndex - 0.25;

        if (isFalling) {
            if (nearEndBy3D) {
                this.currentPathPosition = lastIndex;
                this.complete = true;
                this.rotationActive = false;
            }
        } else if (nearEndBy3D || atEndByPosition) {
            this.currentPathPosition = lastIndex;
            this.complete = true;
            this.rotationActive = false;
        }
    }

    applyHumanizedPhysics() {
        this.currentYaw = this.wrapAngle(this.currentYaw);
        const yawError = this.getAngleDelta(this.currentYaw, this.rawTargetYaw);
        const pitchError = this.rawTargetPitch - this.currentPitch;
        const absYawError = Math.abs(yawError);
        const isStraight = this.currentPathCurvature < 0.2;
        const errorMultiplier = Math.min(1.5, Math.max(0.6, absYawError / 10));
        const dynamicKp = this.BASE_KP * errorMultiplier;
        const dynamicKd = isStraight ? this.KD * 1.3 : this.KD;

        if (absYawError < this.SETTLE_THRESHOLD && Math.abs(this.yawVelocity) < 0.02) {
            this.currentYaw = this.rawTargetYaw;
            this.yawVelocity = 0;
        } else {
            let desiredYawAccel = yawError * dynamicKp - this.yawVelocity * dynamicKd;
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
            let desiredPitchAccel = pitchError * dynamicKp - this.pitchVelocity * dynamicKd;
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
        return Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy + (p.z - p1.z) * dz) / dSq));
    }

    getClosestPointOnSegmentHorizontal(p, p1, p2) {
        const dx = p2.x - p1.x,
            dz = p2.z - p1.z;
        const dSq = dx * dx + dz * dz;
        if (dSq === 0) return 0;
        return Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.z - p1.z) * dz) / dSq));
    }

    getInterpolatedPoint(indexFloat) {
        const idx = Math.floor(indexFloat),
            frac = indexFloat - idx;
        const p1 = this.boxPositions[idx],
            p2 = this.boxPositions[Math.min(idx + 1, this.boxPositions.length - 1)];
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
            this.boxPositions = Spline.createLookPoints(splineData, 0.25, 4.5);
            if (!this.boxPositions || !this.boxPositions.length) return;
        }
        const player = Player.getPlayer();
        if (player && !this.isInitialized) {
            this.currentYaw = this.wrapAngle(player.getYaw());
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
