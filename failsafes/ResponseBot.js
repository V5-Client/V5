import { wrapTo180 } from '../utils/Math';
import { randomFloat, randomInt } from '../utils/Utils';
import { Rotations } from '../utils/player/Rotations';
import { AlertUtils } from './AlertUtils';

class ResponseBotClass {
    constructor() {
        this.isRunning = false;
    }

    run(onComplete) {
        this.duration = 12000;
        this.onComplete = typeof onComplete === 'function' ? onComplete : null;
        this.nextActionAt = 0;
        this.actionInterval = this.duration / randomInt(10, 14);
        this.currentYaw = Player.getYaw() + randomFloat(-30, 30);
        this.currentPitch = Math.max(-80, Math.min(80, Player.getPitch() + randomFloat(-20, 20)));
        this.currentKeys = [];
        this.startedAt = Date.now();
        this.isRunning = true;

        this._unpressKeys();
        Rotations.stopRotation();

        AlertUtils.setCancelHandler(() => this.stop());
        this.listener = register('tick', () => this._tick());
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this._unpressKeys();
        Rotations.stopRotation();

        if (this.listener) {
            this.listener.unregister();
            this.listener = null;
        }

        AlertUtils.setCancelHandler(null);

        const callback = this.onComplete;
        this.onComplete = null;
        if (callback) callback();
    }

    _tick() {
        const elapsed = Date.now() - this.startedAt;
        if (elapsed >= this.duration) {
            this.stop();
            return;
        }

        if (Client.isInGui() && !Client.isInChat()) {
            this._unpressKeys();
            return;
        }

        if (elapsed >= this.nextActionAt) {
            this.currentYaw = wrapTo180(this.currentYaw + randomFloat(-90, 90));
            this.currentPitch = Math.max(-80, Math.min(80, this.currentPitch + randomFloat(-25, 25)));
            this.currentKeys = [];
            if (Math.random() > 0.35) {
                const possibleKeys = ['w', 'a', 's', 'd'];
                this.currentKeys.push(possibleKeys[Math.floor(Math.random() * possibleKeys.length)]);
                if (Math.random() > 0.8) this.currentKeys.push('space');
            }
            this.nextActionAt = elapsed + this.actionInterval;
        }

        Rotations.rotateToAngles(this.currentYaw, this.currentPitch, 1.2);
        this._unpressKeys();
        this.currentKeys.forEach((key) => Client.setKey(key, true));
    }

    _unpressKeys() {
        ['w', 'a', 's', 'd', 'space', 'shift', 'sprint'].forEach((key) => Client.setKey(key, false));
    }
}

export const ResponseBot = new ResponseBotClass();
