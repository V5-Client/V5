import { MacroState } from '../utils/MacroState';
import { manager } from '../utils/SkyblockEvents';
import { finiteNumber } from '../utils/NumberUtils';

const DEFAULT_DISABLE_MS = 3000;
const PICKONIMBUS_DISABLE_MS = 5000;
let globalDisabledUntil = 0;

const disableAll = (durationMs) => {
    globalDisabledUntil = Math.max(globalDisabledUntil, Date.now() + durationMs);
};

register('worldLoad', () => disableAll(DEFAULT_DISABLE_MS));
['serverchange', 'death', 'warp'].forEach((event) => manager.subscribe(event, () => disableAll(1000)));
manager.subscribe('limbo', () => disableAll(DEFAULT_DISABLE_MS));
manager.subscribe('pickonimbusbroke', () => disableAll(PICKONIMBUS_DISABLE_MS));

export class Failsafe {
    _disabledUntil = 0;

    get disabled() {
        return Date.now() < this._getDisabledUntil();
    }

    isActive() {
        return MacroState.isFailsafeMacroRunning();
    }

    reset() {
        this._disabledUntil = 0;
    }

    _scheduleTrigger(fireFn, settings, validateFn = null) {
        const scheduledAt = Date.now();
        const delay = this._getReactionDelay(settings);

        setTimeout(() => {
            if (this.disabled || scheduledAt < this._getDisabledUntil()) return;
            if (!MacroState.isFailsafeMacroRunning()) return;
            if (validateFn && !validateFn()) return;
            fireFn();
        }, delay);
    }

    _reportFailsafe(payload) {
        const FailsafeManager = require('./FailsafeManager').default;
        FailsafeManager.report(payload);
    }

    _setDisabled(durationMs) {
        this._disabledUntil = Math.max(this._disabledUntil, Date.now() + durationMs);
    }

    _getDisabledUntil() {
        return Math.max(globalDisabledUntil, this._disabledUntil);
    }

    _getReactionDelay(settings) {
        return Math.max(0, Math.floor(finiteNumber(settings?.FailsafeReactionTime, 650) - 50));
    }
}
