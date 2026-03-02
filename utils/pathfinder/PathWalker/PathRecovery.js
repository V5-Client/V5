import { Chat } from '../../Chat';
import PathConfig from '../PathConfig';

class PathRecovery {
    constructor() {
        this.MOVING_THRESHOLD = 0.12;
        this.PROGRESS_THRESHOLD = 3.0;
        this.MOVING_THRESHOLD_SQ = this.MOVING_THRESHOLD * this.MOVING_THRESHOLD;
        this.PROGRESS_THRESHOLD_SQ = this.PROGRESS_THRESHOLD * this.PROGRESS_THRESHOLD;

        this.STUCK_TICKS_JUMP = 10;
        this.STUCK_TICKS_CLOSE_LOOK = 22;
        this.STUCK_TICKS_BACKUP_RECALC = 44;

        this.lastPos = null;
        this.stuckPos = null;
        this.stuckTicks = 0;
        this.currentLevel = 0;
    }

    trackProgress() {
        const player = Player.getPlayer();
        if (!player) return null;

        const playerMP = Player.asPlayerMP();
        if (playerMP && (playerMP.isInLava() || playerMP.isInWater())) {
            this.resetTracking();
            return null;
        }

        const pX = Player.getX();
        const pZ = Player.getZ();

        let distMovedSq = 1.0;
        if (this.lastPos) {
            const dx = pX - this.lastPos.x;
            const dz = pZ - this.lastPos.z;
            distMovedSq = dx * dx + dz * dz;
        }

        if (distMovedSq > this.MOVING_THRESHOLD_SQ) {
            this.resetTracking();
            this.lastPos = { x: pX, z: pZ };
            return null;
        }

        if (this.stuckTicks === 0) {
            this.stuckPos = { x: pX, z: pZ };
        }

        if (!player.isOnGround()) {
            this.lastPos = { x: pX, z: pZ };
            return null;
        }

        this.stuckTicks++;
        this.lastPos = { x: pX, z: pZ };

        if (this.stuckTicks >= this.STUCK_TICKS_BACKUP_RECALC && this.currentLevel < 3) {
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder('§6Recovery 3/3: Backup and Recalculate');
            }
            this.currentLevel = 3;
            return 'BACKUP_RECALC';
        }

        if (this.stuckTicks >= this.STUCK_TICKS_CLOSE_LOOK && this.currentLevel < 2) {
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder('§eRecovery 2/3: Reducing lookahead');
            }
            this.currentLevel = 2;
            return 'CLOSE_LOOK';
        }

        if (this.stuckTicks >= this.STUCK_TICKS_JUMP && this.currentLevel < 1) {
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder('§eRecovery 1/3: Jump');
            }
            this.currentLevel = 1;
            return 'JUMP';
        }

        return null;
    }

    hasMadeProgress() {
        if (!this.stuckPos) return false;

        const pX = Player.getX();
        const pZ = Player.getZ();
        const dx = pX - this.stuckPos.x;
        const dz = pZ - this.stuckPos.z;

        return dx * dx + dz * dz > this.PROGRESS_THRESHOLD_SQ;
    }

    isStallRecoveryActive() {
        return this.stuckTicks > 0 || this.currentLevel > 0;
    }

    resetTracking() {
        this.stuckTicks = 0;
        this.currentLevel = 0;
        this.stuckPos = null;
    }

    stop() {
        this.resetTracking();
        this.lastPos = null;
        this.stuckPos = null;
    }
}

class PathNonChangeRecovery {
    constructor() {
        this.PATH_PROGRESS_DELTA = 0.45;
        this.NON_CHANGE_TICKS_RECALC = 35;

        this.bestPathPosition = null;
        this.nonChangeTicks = 0;
    }

    trackProgress(pathPosition) {
        const player = Player.getPlayer();
        if (!player) return false;

        const playerMP = Player.asPlayerMP();
        if (playerMP && (playerMP.isInLava() || playerMP.isInWater())) {
            this.resetTracking();
            return false;
        }

        if (typeof pathPosition !== 'number' || !Number.isFinite(pathPosition)) {
            this.resetTracking();
            return false;
        }

        if (this.bestPathPosition === null) {
            this.bestPathPosition = pathPosition;
            this.nonChangeTicks = 0;
            return false;
        }

        if (pathPosition > this.bestPathPosition + this.PATH_PROGRESS_DELTA) {
            this.bestPathPosition = pathPosition;
            this.nonChangeTicks = 0;
            return false;
        }

        this.nonChangeTicks++;

        if (this.nonChangeTicks >= this.NON_CHANGE_TICKS_RECALC) {
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder('§6Recovery (nonchange): Recalculating');
            }
            this.resetTracking();
            return true;
        }

        return false;
    }

    resetTracking() {
        this.bestPathPosition = null;
        this.nonChangeTicks = 0;
    }

    stop() {
        this.resetTracking();
    }
}

export const Recovery = new PathRecovery();
export const NonChangeRecovery = new PathNonChangeRecovery();
