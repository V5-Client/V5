import { MathUtils } from '../utils/Math';
import { Utils } from '../utils/Utils';
import { Keybind } from '../utils/player/Keybinding';
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
        this.actionInterval = this.duration / Utils.randomInt(10, 14);
        this.currentYaw = Player.getYaw() + Utils.randomFloat(-30, 30);
        this.currentPitch = Utils.clamp(Player.getPitch() + Utils.randomFloat(-20, 20), -80, 80);
        this.currentKeys = [];
        this.startedAt = Date.now();
        this.isRunning = true;

        Keybind.unpressKeys();
        Rotations.stopRotation();

        AlertUtils.setCancelHandler(() => this.stop());
        this.listener = register('tick', () => this._tick());
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        Keybind.unpressKeys();
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
            Keybind.unpressKeys();
            return;
        }

        if (elapsed >= this.nextActionAt) {
            this.currentYaw = MathUtils.wrapTo180(this.currentYaw + Utils.randomFloat(-90, 90));
            this.currentPitch = Utils.clamp(this.currentPitch + Utils.randomFloat(-25, 25), -80, 80);
            this.currentKeys = [];
            if (Math.random() > 0.35) {
                const possibleKeys = ['w', 'a', 's', 'd'];
                this.currentKeys.push(possibleKeys[Math.floor(Math.random() * possibleKeys.length)]);
                if (Math.random() > 0.8) this.currentKeys.push('space');
            }
            this.nextActionAt = elapsed + this.actionInterval;
        }

        Rotations.rotateToAngles(this.currentYaw, this.currentPitch, 1.2);
        Keybind.unpressKeys();
        this.currentKeys.forEach((key) => Keybind.setKey(key, true));
    }
}

export const ResponseBot = new ResponseBotClass();
