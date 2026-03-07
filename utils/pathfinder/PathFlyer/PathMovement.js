import { MathUtils } from '../../Math';
import { Keybind } from '../../player/Keybinding';
import { PathExecutor } from '../PathExecutor';
import { getCurrentMotion, predictStoppingPosition } from './PathPrediction';

class PathMovement {
    constructor() {
        this.path = [];
        this.currentIndex = 0;
        this.isActive = false;
        this.complete = false;
        this.state = 'NONE';
        this.decelTicks = 0;

        this.PREDICT_TICKS = 30;
        this.STOPPING_DISTANCE_THRESHOLD = 0.85;
        this.MOTION_STOP_THRESHOLD_XZ = 0.05;
        this.MOTION_STOP_THRESHOLD_Y = 0.02;
        this.MAX_DECEL_TICKS = 60;
        this.MOVE_TARGET_LOOKAHEAD = 6;
        this.LATERAL_DEADZONE = 0.55;
        this.VERTICAL_DEADZONE = 0.55;
        this.VERTICAL_DEADZONE_MOVING = 0.75;

        PathExecutor.onTick(() => {
            if (!this.isActive || !this.path || this.path.length === 0) return;

            const player = Player.getPlayer();
            if (!player) {
                this.stopMovement(false);
                return;
            }

            if (!player.getAbilities().flying) {
                player.getAbilities().flying = true;
                player.sendAbilitiesUpdate();
            }

            this.updateMovement(player);
        });
    }

    beginMovement(smoothPath) {
        if (!smoothPath || smoothPath.length === 0) return;
        this.releaseMovementKeys();
        this.path = smoothPath;
        this.currentIndex = 0;
        this.isActive = true;
        this.complete = false;
        this.state = 'MOVING';
        this.decelTicks = 0;
    }

    getYawToTarget(dx, dz) {
        return -(Math.atan2(dx, dz) * (180 / Math.PI));
    }

    getDistanceSq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }

    getDistanceSqXZ(a, b) {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return dx * dx + dz * dz;
    }

    setMovementKeysToward(target) {
        const pX = Player.getX();
        const pZ = Player.getZ();
        const dx = target.x - pX;
        const dz = target.z - pZ;
        const desiredYaw = this.getYawToTarget(dx, dz);
        this.setMovementKeysForYaw(desiredYaw, dx * dx + dz * dz);
    }

    setMovementKeysForYaw(desiredYaw, distSqXZ = 1) {
        ['w', 'a', 's', 'd'].forEach((k) => Keybind.setKey(k, false));

        const playerYaw = Player.getYaw();
        const yawDelta = MathUtils.wrapTo180(desiredYaw - playerYaw);
        const absYawDelta = Math.abs(yawDelta);

        if (distSqXZ < 0.15) {
            Keybind.setKey('w', true);
            return;
        }

        if (absYawDelta < 75) {
            Keybind.setKey('w', true);
        } else if (absYawDelta > 145) {
            Keybind.setKey('s', true);
        }

        if (distSqXZ > Math.pow(this.LATERAL_DEADZONE * 1.5, 2) && absYawDelta > 25 && absYawDelta < 155) {
            const sideKey = yawDelta > 0 ? 'd' : 'a';
            if (absYawDelta > 45) {
                Keybind.setKey(sideKey, true);
            }
        }
    }

    requestDeceleration() {
        if (!this.isActive || this.state === 'DECELERATING') return;
        this.state = 'DECELERATING';
        this.decelTicks = 0;
        this.releaseMovementKeys();
    }

    willArriveAtDestinationAfterStopping(targetPos) {
        const predicted = predictStoppingPosition(this.PREDICT_TICKS);
        return this.getDistanceSq(predicted, targetPos) <= Math.pow(this.STOPPING_DISTANCE_THRESHOLD, 2);
    }

    shouldFinishDeceleration(finalTarget) {
        const { x: vx, y: vy, z: vz } = getCurrentMotion();
        const slowEnough =
            Math.abs(vx) <= this.MOTION_STOP_THRESHOLD_XZ && Math.abs(vz) <= this.MOTION_STOP_THRESHOLD_XZ && Math.abs(vy) <= this.MOTION_STOP_THRESHOLD_Y;

        if (!slowEnough) return false;

        const here = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        return this.getDistanceSq(here, finalTarget) <= Math.pow(this.STOPPING_DISTANCE_THRESHOLD * 1.5, 2);
    }

    getMovementTarget(current, speedXZ) {
        if (!this.path || this.path.length === 0) return null;
        if (this.path.length === 1) {
            return {
                movementTarget: this.path[0],
                verticalTarget: this.path[0],
            };
        }

        let closestIndex = this.currentIndex;
        let closestDistSq = Infinity;
        const searchStart = Math.max(0, this.currentIndex - 10);
        const searchEnd = Math.min(this.path.length - 1, this.currentIndex + 30);

        for (let i = searchStart; i <= searchEnd; i++) {
            const pt = this.path[i];
            const d = this.getDistanceSqXZ(pt, current);
            if (d < closestDistSq) {
                closestDistSq = d;
                closestIndex = i;
            }
        }

        this.currentIndex = closestIndex;
        const dynamicLookahead = Math.floor(this.MOVE_TARGET_LOOKAHEAD + speedXZ * 8);
        const moveIndex = Math.min(this.path.length - 1, this.currentIndex + dynamicLookahead);
        const movementTarget = this.path[moveIndex];
        const verticalLookahead = Math.min(this.path.length - 1, this.currentIndex + Math.max(1, Math.floor(1 + speedXZ * 2)));
        const verticalTarget = this.path[verticalLookahead];

        return {
            movementTarget,
            verticalTarget,
        };
    }

    handleFlyBoost(next, current, player) {
        return !!player?.isOnGround() && next.y - current.y > 0.5;
    }

    updateMovement(player) {
        const pX = Player.getX();
        const pY = Player.getY();
        const pZ = Player.getZ();
        const current = { x: pX, y: pY, z: pZ };

        const finalTarget = this.path[this.path.length - 1];
        if (!finalTarget) {
            this.stopMovement(false);
            return;
        }

        if (this.state === 'DECELERATING') {
            this.decelTicks++;
            this.releaseMovementKeys();
            const finished = this.shouldFinishDeceleration(finalTarget);
            if (finished || this.decelTicks >= this.MAX_DECEL_TICKS) {
                this.stopMovement(finished);
            }
            return;
        }

        if (this.willArriveAtDestinationAfterStopping(finalTarget) || this.getDistanceSq(current, finalTarget) < 0.09) {
            this.requestDeceleration();
            return;
        }

        const motion = getCurrentMotion();
        const speedXZ = Math.hypot(motion.x, motion.z);
        const targetInfo = this.getMovementTarget(current, speedXZ);
        if (!targetInfo) {
            this.stopMovement(false);
            return;
        }

        const { movementTarget, verticalTarget } = targetInfo;
        const boostJump = this.handleFlyBoost(movementTarget, current, player);
        const yTarget = verticalTarget.y;
        const yError = yTarget - pY;
        const verticalDeadzone = speedXZ > 0.12 ? this.VERTICAL_DEADZONE_MOVING : this.VERTICAL_DEADZONE;
        const isLifting = yError > verticalDeadzone;
        const isDescending = yError < -verticalDeadzone;

        this.setMovementKeysToward(movementTarget);
        Keybind.setKey('space', isLifting);
        Keybind.setKey('shift', isDescending);

        if (boostJump) {
            Keybind.setKey('space', true);
        }

        Keybind.setKey('sprint', true);
    }

    releaseMovementKeys() {
        ['w', 'a', 's', 'd', 'space', 'shift', 'sprint'].forEach((key) => Keybind.setKey(key, false));
    }

    stopMovement(completed = false) {
        this.isActive = false;
        this.complete = !!completed;
        this.state = 'NONE';
        this.currentIndex = 0;
        this.decelTicks = 0;
        this.releaseMovementKeys();
        this.path = [];
    }
}

export const FlyMovement = new PathMovement();
