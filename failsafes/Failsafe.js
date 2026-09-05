import { registerSkyblockEvent } from '../utils/SkyblockEvents';
import { isFailsafeMacroRunning } from '../utils/MacroState';
import { finiteNumber } from '../utils/Math';
export class Failsafe {
    registered = false;
    disabled = false;
    _disabledUntil = 0;
    _disabledGeneration = 0;

    constructor() {
        this._registerListeners();
    }

    isActive() {
        return isFailsafeMacroRunning();
    }
    onTrigger() {}
    reset() {
        this.disabled = false;
        this._disabledUntil = 0;
        this._disabledGeneration++;
    }

    _setDisabled(durationMs) {
        const now = Date.now();
        const end = now + durationMs;

        if (end <= this._disabledUntil && this.disabled) return;

        this._disabledUntil = end;
        this.disabled = true;

        const generation = ++this._disabledGeneration;
        setTimeout(() => {
            if (generation !== this._disabledGeneration) return;
            if (Date.now() >= this._disabledUntil) {
                this.disabled = false;
            }
        }, durationMs);
    }

    _registerListeners() {
        if (this.registered) return;
        this.registered = true;
        register('worldLoad', () => {
            this._setDisabled(1000);
        });
        ['serverchange', 'death', 'warp'].forEach((event) => registerSkyblockEvent(event, () => this._setDisabled(1000)));
    }

    _getReactionDelay(settings) {
        return Math.max(0, Math.floor(finiteNumber(settings?.FailsafeReactionTime, 650) - 50));
    }
}
