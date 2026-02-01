import { Keybind } from '../../player/Keybinding';
import { PathExecutor } from '../PathExecutor';

class PathMovement {
    constructor() {
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;
        this.isActive = false;

        PathExecutor.onTick(() => {
            if (this.forceJumpTicks > 0) {
                Keybind.setKey('space', true);
                this.forceJumpTicks--;
                if (this.forceJumpTicks === 0) {
                    Keybind.setKey('space', false);
                }
            }

            if (this.backupTicks > 0) {
                Keybind.setKey('w', false);
                Keybind.setKey('s', true);
                Keybind.setKey('sprint', false);
                this.backupTicks--;

                if (this.backupTicks === 0) {
                    Keybind.setKey('s', false);

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
            if (!player.isSprinting()) Keybind.setKey('sprint', true);
            Keybind.setKey('w', true);
        }
    }

    forceJump(ticks = 4) {
        this.forceJumpTicks = ticks;
    }

    backup(ticks, onComplete) {
        this.backupTicks = ticks;
        this.backupCallback = onComplete || null;
    }

    isRecovering() {
        return this.forceJumpTicks > 0 || this.backupTicks > 0;
    }

    stopMovement() {
        this.isActive = false;
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;

        Keybind.stopMovement();
        Keybind.setKey('w', false);
        Keybind.setKey('s', false);
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
        Keybind.setKey('space', false);
    }
}

export const Movement = new PathMovement();
