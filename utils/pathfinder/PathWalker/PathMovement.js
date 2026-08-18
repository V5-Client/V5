import { finiteNumber } from '../../Math';
import { onPathTick } from '../PathExecutor';

let forceJumpTicks = 0;
let backupTicks = 0;
let backupCallback = null;

onPathTick(() => {
    if (forceJumpTicks > 0) {
        Client.setKey('space', true);
        if (--forceJumpTicks === 0) Client.setKey('space', false);
    }

    if (backupTicks > 0) {
        Client.setKey('w', false);
        Client.setKey('s', true);
        Client.setKey('sprint', false);
        if (--backupTicks === 0) {
            Client.setKey('s', false);
            const callback = backupCallback;
            backupCallback = null;
            callback?.();
        }
    }
});

export function beginMovement() {
    const player = Player.getPlayer();
    if (!player) return;
    if (backupTicks <= 0) {
        if (!player.isSprinting()) Client.setKey('sprint', true);
        Client.setKey('w', true);
    }
}

export const forceJump = (ticks = 4) => (forceJumpTicks = Math.max(0, Math.floor(finiteNumber(ticks))));

export function backup(ticks, onComplete) {
    backupTicks = Math.max(0, ticks | 0);
    backupCallback = onComplete || null;
    if (backupTicks === 0 && backupCallback) {
        const callback = backupCallback;
        backupCallback = null;
        callback();
    }
}

export const isRecovering = () => forceJumpTicks > 0 || backupTicks > 0;

export function stopMovement() {
    forceJumpTicks = 0;
    backupTicks = 0;
    backupCallback = null;
    Client.stopMovement();
    for (const key of ['w', 's', 'a', 'd', 'space', 'shift', 'sprint']) Client.setKey(key, false);
}
