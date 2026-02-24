import { manager } from '../utils/SkyblockEvents';
export class Failsafe {
    registered = false;
    disabled = false;
    _disabledUntil = 0;
    _disabledTimer = null;

    constructor() {
        this._registerListeners();
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {
        this.disabled = false;
        this._disabledUntil = 0;
        if (this._disabledTimer) {
            clearTimeout(this._disabledTimer);
            this._disabledTimer = null;
        }
    }

    _setDisabled(durationMs) {
        const now = Date.now();
        const end = now + durationMs;

        if (end <= this._disabledUntil && this.disabled) return;

        this._disabledUntil = end;
        this.disabled = true;

        if (this._disabledTimer) clearTimeout(this._disabledTimer);

        this._disabledTimer = setTimeout(() => {
            if (Date.now() >= this._disabledUntil) {
                this.disabled = false;
                this._disabledTimer = null;
            }
        }, durationMs);
    }

    _registerListeners() {
        if (this.registered) return;
        this.registered = true;
        register('worldLoad', () => {
            this._setDisabled(1000);
        });
        manager.subscribe('serverchange', () => {
            this._setDisabled(1000);
        });
        manager.subscribe('death', () => {
            this._setDisabled(1000);
        });
        manager.subscribe('warp', () => {
            this._setDisabled(1000);
        });
    }

    _getReactionDelay(settings) {
        const raw = Number(settings?.FailsafeReactionTime);
        if (!isFinite(raw)) return 600;
        return Math.max(0, Math.floor(raw - 50));
    }
}
