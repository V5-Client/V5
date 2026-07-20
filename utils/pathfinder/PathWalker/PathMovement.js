import { finiteNumber } from '../../NumberUtils';
import { PathExecutor } from '../PathExecutor';

class PathMovement {
    constructor() {
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;
        this.isActive = false;

        PathExecutor.onTick(() => {
            if (this.forceJumpTicks > 0) {
                Client.setKey('space', true);
                this.forceJumpTicks--;
                if (this.forceJumpTicks === 0) {
                    Client.setKey('space', false);
                }
            }

            if (this.backupTicks > 0) {
                Client.setKey('w', false);
                Client.setKey('s', true);
                Client.setKey('sprint', false);
                this.backupTicks--;

                if (this.backupTicks === 0) {
                    Client.setKey('s', false);

                    if (this.backupCallback) {
                        const cb = this.backupCallback;
                        this.backupCallback = null;
                        cb();
                    }
                }
            }
        });
    }

    beginMovement() {
        const player = Player.getPlayer();
        if (!player) return;

        this.isActive = true;

        if (this.backupTicks <= 0) {
            if (!player.isSprinting()) Client.setKey('sprint', true);
            Client.setKey('w', true);
        }
    }

    forceJump(ticks = 4) {
        this.forceJumpTicks = Math.max(0, Math.floor(finiteNumber(ticks)));
    }

    backup(ticks, onComplete) {
        this.backupTicks = Math.max(0, ticks | 0);
        this.backupCallback = onComplete || null;
        if (this.backupTicks === 0 && this.backupCallback) {
            const cb = this.backupCallback;
            this.backupCallback = null;
            cb();
        }
    }

    isRecovering() {
        return this.forceJumpTicks > 0 || this.backupTicks > 0;
    }

    stopMovement() {
        this.isActive = false;
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;

        Client.stopMovement();
        Client.setKey('w', false);
        Client.setKey('s', false);
        Client.setKey('a', false);
        Client.setKey('d', false);
        Client.setKey('space', false);
        Client.setKey('shift', false);
        Client.setKey('sprint', false);
    }
}

export const Movement = new PathMovement();
