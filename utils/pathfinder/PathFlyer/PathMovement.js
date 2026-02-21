import { Keybind } from '../../player/Keybinding';
import { PathExecutor } from '../PathExecutor';
import { getCurrentMotion, predictStoppingPosition } from './PathPrediction';

class PathMovement {
    constructor() {
        this.path = [];
        this.currentIndex = 0;
        this.isActive = false;
        this.isLifting = false;
        this.isDescending = false;
        this.complete = false;

        this.state = 'NONE';
        this.decelTicks = 0;

        this.PREDICT_TICKS = 30;
        this.STOPPING_DISTANCE_THRESHOLD = 0.85;
        this.MOTION_STOP_THRESHOLD_XZ = 0.05;
        this.MOTION_STOP_THRESHOLD_Y = 0.02;
        this.MAX_DECEL_TICKS = 60;

        this.MOVE_TARGET_LOOKAHEAD = 6;
        this.STRAFE_ON_DEG = 35;
        this.STRAFE_OFF_DEG = 15;
        this.LATERAL_DEADZONE = 0.65;

        this.strafeDir = 0;

        PathExecutor.onTick(() => {
            if (!this.isActive || !this.path || this.path.length === 0) return;
            const player = Player.getPlayer();
            if (!player) return;
            if (!player.getAbilities().flying) {
                player.getAbilities().flying = true;
                player.sendAbilitiesUpdate();
            }
            this.updateMovement();
        });
    }

    beginMovement(smoothPath) {
        if (!smoothPath || smoothPath.length === 0) return;
        this.path = smoothPath;
        this.currentIndex = 0;
        this.isActive = true;
        this.isLifting = false;
        this.isDescending = false;
        this.complete = false;

        this.state = 'MOVING';
        this.decelTicks = 0;
        this.strafeDir = 0;
    }

    wrapAngle(angle) {
        let wrapped = angle % 360;
        if (wrapped > 180) wrapped -= 360;
        if (wrapped < -180) wrapped += 360;
        return wrapped;
    }

    getYawToTarget(dx, dz) {
        return -(Math.atan2(dx, dz) * (180 / Math.PI));
    }

    updateStrafeDir(yawDeltaDeg, distSqXZ) {
        if (distSqXZ < this.LATERAL_DEADZONE * this.LATERAL_DEADZONE) {
            this.strafeDir = 0;
            return;
        }

        if (this.strafeDir === 0) {
            if (yawDeltaDeg > this.STRAFE_ON_DEG) this.strafeDir = 1;
            else if (yawDeltaDeg < -this.STRAFE_ON_DEG) this.strafeDir = -1;
            return;
        }

        if (this.strafeDir === 1) {
            if (yawDeltaDeg < this.STRAFE_OFF_DEG) this.strafeDir = 0;
            else if (yawDeltaDeg < -this.STRAFE_ON_DEG) this.strafeDir = -1;
        } else if (this.strafeDir === -1) {
            if (yawDeltaDeg > -this.STRAFE_OFF_DEG) this.strafeDir = 0;
            else if (yawDeltaDeg > this.STRAFE_ON_DEG) this.strafeDir = 1;
        }
    }

    setMovementKeysToward(target) {
        const pX = Player.getX();
        const pZ = Player.getZ();
        const dx = target.x - pX;
        const dz = target.z - pZ;
        const distSqXZ = dx * dx + dz * dz;

        ['w', 'a', 's', 'd'].forEach((k) => Keybind.setKey(k, false));

        if (distSqXZ < 0.15) {
            Keybind.setKey('w', true);
            return;
        }

        const desiredYaw = this.getYawToTarget(dx, dz);
        const playerYaw = Player.getYaw();
        const yawDelta = this.wrapAngle(desiredYaw - playerYaw);
        const absYawDelta = Math.abs(yawDelta);

        if (absYawDelta < 75) {
            Keybind.setKey('w', true);
        } else if (absYawDelta > 145) {
            Keybind.setKey('s', true);
        }

        if (distSqXZ > Math.pow(this.LATERAL_DEADZONE * 1.5, 2)) {
            if (absYawDelta > 25 && absYawDelta < 155) {
                const side = yawDelta > 0 ? 1 : -1;
                if (absYawDelta > 45) {
                    Keybind.setKey(side === 1 ? 'd' : 'a', true);
                }
            }
        }
    }

    requestDeceleration() {
        if (!this.isActive) return;
        if (this.state === 'DECELERATING') return;
        this.state = 'DECELERATING';
        this.decelTicks = 0;
        this.releaseMovementKeys();
    }

    getDistanceSq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }

    willArriveAtDestinationAfterStopping(targetPos) {
        const predicted = predictStoppingPosition(this.PREDICT_TICKS);
        return this.getDistanceSq(predicted, targetPos) <= this.STOPPING_DISTANCE_THRESHOLD * this.STOPPING_DISTANCE_THRESHOLD;
    }

    shouldFinishDeceleration(finalTarget) {
        const { x: vx, y: vy, z: vz } = getCurrentMotion();
        const slowEnough =
            Math.abs(vx) <= this.MOTION_STOP_THRESHOLD_XZ && Math.abs(vz) <= this.MOTION_STOP_THRESHOLD_XZ && Math.abs(vy) <= this.MOTION_STOP_THRESHOLD_Y;
        if (!slowEnough) return false;

        const here = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        return this.getDistanceSq(here, finalTarget) <= (this.STOPPING_DISTANCE_THRESHOLD * 1.5) ** 2;
    }

    updateMovement() {
        const pX = Player.getX();
        const pY = Player.getY();
        const pZ = Player.getZ();

        const finalTarget = this.path[this.path.length - 1];

        if (this.state === 'DECELERATING') {
            this.decelTicks++;
            this.releaseMovementKeys();
            if (this.shouldFinishDeceleration(finalTarget) || this.decelTicks >= this.MAX_DECEL_TICKS) {
                this.finishMovement();
            }
            return;
        }

        if (this.willArriveAtDestinationAfterStopping(finalTarget)) {
            this.requestDeceleration();
            return;
        }

        let closestIndex = this.currentIndex;
        let closestDistSq = Infinity;
        const searchStart = Math.max(0, this.currentIndex - 10);
        const searchEnd = Math.min(this.path.length - 1, this.currentIndex + 30);

        for (let i = searchStart; i <= searchEnd; i++) {
            const pt = this.path[i];
            const d = Math.pow(pt.x - pX, 2) + Math.pow(pt.y - pY, 2) + Math.pow(pt.z - pZ, 2);
            if (d < closestDistSq) {
                closestDistSq = d;
                closestIndex = i;
            }
        }

        this.currentIndex = closestIndex;

        const motion = getCurrentMotion();
        const speedXZ = Math.hypot(motion.x, motion.z);
        const dynamicLookahead = Math.floor(this.MOVE_TARGET_LOOKAHEAD + speedXZ * 8);

        const moveIndex = Math.min(this.path.length - 1, this.currentIndex + dynamicLookahead);
        const target = this.path[moveIndex];

        const diffY = target.y - pY;
        const predicted = predictStoppingPosition(10);
        const predictedDiffY = target.y - predicted.y;

        if (predictedDiffY > 0.8 || diffY > 0.6) {
            this.isLifting = true;
            this.isDescending = false;
        } else if (predictedDiffY < -0.8 || diffY < -0.6) {
            this.isDescending = true;
            this.isLifting = false;
        } else {
            this.isLifting = false;
            this.isDescending = false;
        }

        this.setMovementKeysToward(target);
        Keybind.setKey('sprint', true);
        Keybind.setKey('space', this.isLifting);
        Keybind.setKey('shift', this.isDescending);
    }

    releaseMovementKeys() {
        ['w', 'a', 's', 'd', 'space', 'shift', 'sprint'].forEach((key) => Keybind.setKey(key, false));
        this.strafeDir = 0;
    }

    finishMovement() {
        this.complete = true;
        this.isActive = false;
        this.state = 'NONE';
        this.releaseMovementKeys();
        this.path = [];
    }

    stopMovement() {
        this.isActive = false;
        this.complete = false;
        this.state = 'NONE';
        this.releaseMovementKeys();
        this.path = [];
    }
}

export const FlyMovement = new PathMovement();
