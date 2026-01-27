import { Chat } from '../../Chat';
import PathConfig from '../PathConfig';

class PathRecovery {
    constructor() {
        this.MOVING_THRESHOLD = 0.12;
        this.PROGRESS_THRESHOLD = 3.0;

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

        let distMoved = 1.0;
        if (this.lastPos) {
            const dx = pX - this.lastPos.x;
            const dz = pZ - this.lastPos.z;
            distMoved = Math.sqrt(dx * dx + dz * dz);
        }

        if (distMoved > this.MOVING_THRESHOLD) {
            this.resetTracking();
            this.lastPos = { x: pX, z: pZ };
            return null;
        }

        if (this.stuckTicks === 0) {
            this.stuckPos = { x: pX, z: pZ };
        }

        this.stuckTicks++;
        this.lastPos = { x: pX, z: pZ };
        if (!player.isOnGround()) return null; // move to the 'if (!player) return null;' if this breaks it. but i'm pretty sure here makes it better!

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

        return Math.sqrt(dx * dx + dz * dz) > this.PROGRESS_THRESHOLD;
    }

    resetTracking() {
        this.stuckTicks = 0;
        this.currentLevel = 0;
    }

    stop() {
        this.resetTracking();
        this.lastPos = null;
        this.stuckPos = null;
    }
}

export const Recovery = new PathRecovery();
