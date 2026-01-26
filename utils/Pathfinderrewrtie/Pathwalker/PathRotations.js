import { MathUtils } from '../../Math';
import { PathRotationsUtility } from './PathRotationsUtility';
import { Spline } from '../PathSpline';
import { BP, Vec3d } from '../../Constants';
import RenderUtils from '../../render/RendererUtils';
import { raytraceBlocks } from '../../dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from '../../dependencies/BloomCore/Vector3';

class PathRotations {
    constructor() {
        this.MIN_LOOKAHEAD = 1.1;
        this.MAX_LOOKAHEAD = 3.5;
        this.PROXIMITY_THRESHOLD = 4.0;

        this.BASE_KP = 0.08;
        this.KD = 0.45;
        this.MAX_VELOCITY = 8.0;
        this.ACCEL_LIMIT = 1.2;
        this.SETTLE_THRESHOLD = 0.1;
        this.PITCH_DEADZONE = 2.5;
        this.YAW_DEADZONE = 1.5;

        this.SMOOTH_FACTOR = 0.12;
        this.MAX_LOOK_DISTANCE = 0.8;
        this.LOOKAHEAD_STEP = 0.4;
        this.VISIBILITY_CACHE_MS = 50;

        this.MAX_DIRECTION_DIVERGENCE = 50.0;
        this.MAX_UPWARD_PITCH = -45.0;

        this.resetRotations();
        this.onStep();

        this.lookaheadOverride = null;
        this.lookaheadOverrideExpiry = 0;
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
    isPointVisible(playerEyes, targetPoint) {
        const dx = targetPoint.x - playerEyes.x;
        const dy = targetPoint.y - playerEyes.y;
        const dz = targetPoint.z - playerEyes.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

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
            const hitDist = Math.sqrt(Math.pow(hitX - playerEyes.x, 2) + Math.pow(hitY - playerEyes.y, 2) + Math.pow(hitZ - playerEyes.z, 2));

            return hitDist >= dist - 0.5;
        } catch (e) {
            return true;
        }
    }

    getAngleBetweenVectors(v1, v2) {
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
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

    findVisibleLookahead(playerEyes, idealLookahead) {
        const now = Date.now();

        if (this.cachedLookahead !== null && now - this.lastVisibilityCheck < this.VISIBILITY_CACHE_MS) {
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

        let lookahead = idealLookahead;

        while (lookahead >= this.MIN_LOOKAHEAD) {
            const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + lookahead);
            const point = this.getInterpolatedPoint(t);

            const dx = point.x - playerEyes.x;
            const dy = point.y - playerEyes.y;
            const dz = point.z - playerEyes.z;
            const horzDist = Math.sqrt(dx * dx + dz * dz);

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

            if (this.isPointVisible(playerEyes, point)) {
                this.cachedLookahead = lookahead;
                return { point, lookahead };
            }

            lookahead -= this.LOOKAHEAD_STEP;
        }

        this.cachedLookahead = this.MIN_LOOKAHEAD;
        const t = Math.min(this.boxPositions.length - 1, this.currentPathPosition + this.MIN_LOOKAHEAD);
        return { point: this.getInterpolatedPoint(t), lookahead: this.MIN_LOOKAHEAD };
    }

    getAdaptiveLookahead(playerEyes) {
        if (this.lookaheadOverride !== null) {
            if (this.lookaheadOverrideExpiry > 0) {
                this.lookaheadOverrideExpiry--;
                return this.lookaheadOverride;
            } else {
                this.lookaheadOverride = null;
            }
        }

        const targetIndex = Math.floor(this.currentPathPosition);
        if (targetIndex + 3 >= this.boxPositions.length) return this.smoothedLookahead;

        const pathPoint = this.getInterpolatedPoint(this.currentPathPosition);
        const deviationFromPath = Math.sqrt(Math.pow(playerEyes.x - pathPoint.x, 2) + Math.pow(playerEyes.z - pathPoint.z, 2));
        const deviationFactor = Math.min(1, Math.max(0, (deviationFromPath - 1.6) / 2.0));

        const startIndex = this.boxPositions[targetIndex];
        const endIndex = this.boxPositions[Math.min(targetIndex + 2, this.boxPositions.length - 1)];

        const currDx = endIndex.x - startIndex.x;
        const currDy = endIndex.y - startIndex.y;
        const currDz = endIndex.z - startIndex.z;

        const startDirection = { x: currDx, y: currDy, z: currDz };
        const startDirectionMagnitude = Math.sqrt(currDx * currDx + currDy * currDy + currDz * currDz);

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
            const futureDirectionMagnitude = Math.sqrt(futureDx * futureDx + futureDy * futureDy + futureDz * futureDz);

            if (startDirectionMagnitude > 0.8 && futureDirectionMagnitude > 0.8) {
                const dotProduct =
                    (startDirection.x * futureDirection.x + startDirection.y * futureDirection.y + startDirection.z * futureDirection.z) /
                    (startDirectionMagnitude * futureDirectionMagnitude);
                const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                maxAngle = Math.max(maxAngle, angle);
            }
        }

        const isFalling = Player.getMotionY() < -0.1;
        if (isFalling) maxAngle *= 0.5;

        const curveFactor = Math.min(1, Math.max(0, (maxAngle - 0.61) / 0.7));
        const adjustFactor = Math.max(deviationFactor, curveFactor);

        const targetLookaheadDistance = this.MAX_LOOKAHEAD - (this.MAX_LOOKAHEAD - this.MIN_LOOKAHEAD) * adjustFactor;

        let lerpFactor = 0.05;
        if (targetLookaheadDistance > this.smoothedLookahead) {
            lerpFactor = 0.1;
        }

        this.smoothedLookahead += (targetLookaheadDistance - this.smoothedLookahead) * lerpFactor;

        return this.smoothedLookahead;
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

        const adaptiveLookahead = this.getAdaptiveLookahead(playerEyes);
        //ChatLib.chat(adaptiveLookahead.toFixed(2));
        const result = this.findVisibleLookahead(playerEyes, adaptiveLookahead);
        let targetPoint = result.point;

        if (result.lookahead < this.smoothedLookahead) {
            this.smoothedLookahead = this.smoothedLookahead * 0.9 + result.lookahead * 0.1;
        }

        const rawDx = targetPoint.x - playerEyes.x;
        const rawDy = targetPoint.y - playerEyes.y;
        const rawDz = targetPoint.z - playerEyes.z;
        const rawHorz = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
        const rawPitch = -Math.atan2(rawDy, rawHorz) * (180 / Math.PI);

        if (rawPitch < -50 && rawHorz < 1.0) {
            const newDy = rawHorz * Math.tan(30 * (Math.PI / 180));
            targetPoint = new Vec3d(targetPoint.x, playerEyes.y + newDy, targetPoint.z);
        }

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
        const yawDelta = this.getAngleDelta(this.rawTargetYaw, targetYaw);

        if (Math.abs(yawDelta) > this.YAW_DEADZONE) {
            this.rawTargetYaw = this.wrapAngle(this.rawTargetYaw + yawDelta * this.SMOOTH_FACTOR);
        }

        const pitchDelta = angles.pitch - this.rawTargetPitch;
        if (Math.abs(pitchDelta) > this.PITCH_DEADZONE) {
            this.rawTargetPitch += pitchDelta * this.SMOOTH_FACTOR;
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
            this.boxPositions = Spline.createLookPoints(splineData, 0.25, 4.5);
            if (!this.boxPositions || !this.boxPositions.length) return;
        }
        const player = Player.getPlayer();
        if (!player) return;
        if (!this.isInitialized) {
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
