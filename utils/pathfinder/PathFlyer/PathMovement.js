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
        return this.getDistanceSq(here, finalTarget) <= (this.STOPPING_DISTANCE_THRESHOLD * 1.25) ** 2;
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
            this.state = 'DECELERATING';
            this.decelTicks = 0;
            this.releaseMovementKeys();
            return;
        }

        let closestIndex = this.currentIndex;
        let closestDistSq = Infinity;
        const searchStart = Math.max(0, this.currentIndex - 15);
        const searchEnd = Math.min(this.path.length - 1, this.currentIndex + 40);
        for (let i = searchStart; i <= searchEnd; i++) {
            const pt = this.path[i];
            const dx = pt.x - pX;
            const dy = pt.y - pY;
            const dz = pt.z - pZ;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < closestDistSq) {
                closestDistSq = d;
                closestIndex = i;
            }
        }

        if (closestDistSq > 25) {
            let bestD = closestDistSq;
            let bestI = closestIndex;
            const broadStart = Math.max(0, this.currentIndex - 80);
            for (let i = broadStart; i < this.path.length; i++) {
                const pt = this.path[i];
                const dx = pt.x - pX;
                const dy = pt.y - pY;
                const dz = pt.z - pZ;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < bestD) {
                    bestD = d;
                    bestI = i;
                    if (bestD < 1.0) break;
                }
            }
            closestDistSq = bestD;
            closestIndex = bestI;
        }

        this.currentIndex = Math.min(closestIndex + 1, this.path.length - 1);

        const target = this.path[this.currentIndex];
        const diffY = pY - target.y;

        const predicted = predictStoppingPosition(12);
        const predictedDiffY = predicted.y - target.y;

        if (predictedDiffY < -0.25 && diffY < -0.15) {
            this.isLifting = true;
            this.isDescending = false;
        } else if (predictedDiffY > 0.1 || diffY > 0.15) {
            this.isLifting = false;
        }

        if (predictedDiffY > 0.75 && !this.isLifting) {
            this.isDescending = true;
        } else if (predictedDiffY < 0.25 || diffY < 0.3) {
            this.isDescending = false;
        }

        Keybind.setKeysForStraightLineCoords(target.x, target.y, target.z, false);
        Keybind.setKey('sprint', true);
        Keybind.setKey('space', this.isLifting);
        Keybind.setKey('shift', this.isDescending);
    }

    releaseMovementKeys() {
        ['w', 'a', 's', 'd', 'space', 'shift', 'sprint'].forEach((key) => Keybind.setKey(key, false));
    }

    finishMovement() {
        this.complete = true;
        this.isActive = false;
        this.isLifting = false;
        this.isDescending = false;
        this.state = 'NONE';
        this.decelTicks = 0;
        this.currentIndex = 0;
        this.path = [];
        this.releaseMovementKeys();
    }

    stopMovement() {
        this.isActive = false;
        this.isLifting = false;
        this.isDescending = false;
        this.complete = false;
        this.state = 'NONE';
        this.decelTicks = 0;
        this.currentIndex = 0;
        this.path = [];
        this.releaseMovementKeys();
    }
}

export const FlyMovement = new PathMovement();
