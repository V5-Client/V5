import { Chat } from '../utils/Chat';
import { manager } from '../utils/SkyblockEvents';
export class Failsafe {
    registered = false;
    ignore = false;
    _ignoreUntil = 0;
    _ignoreTimer = null;

    constructor() {
        this._registerListeners();
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {
        this.ignore = false;
        this._ignoreUntil = 0;
        if (this._ignoreTimer) {
            clearTimeout(this._ignoreTimer);
            this._ignoreTimer = null;
        }
    }

    _setIgnore(durationMs) {
        const now = Date.now();
        const end = now + durationMs;

        if (end <= this._ignoreUntil && this.ignore) return;

        this._ignoreUntil = end;
        this.ignore = true;

        if (this._ignoreTimer) clearTimeout(this._ignoreTimer);

        this._ignoreTimer = setTimeout(() => {
            if (Date.now() >= this._ignoreUntil) {
                this.ignore = false;
                this._ignoreTimer = null;
            }
        }, durationMs);
    }

    _handleVelocityOnFireIgnore(checkType) {
        if (checkType !== 'velocity') return;

        const player = Player.getPlayer();
        if (!player) return;

        if (player.hurtTime > 0) {
            Chat.messageFailsafe('DEBUG - took damage ignoring velocty change', false);
            this._setIgnore(1000);
        }
    }

    _handleVelocityCheck(data) {
        if (this.ignore) return true;
        if (data.velocity === undefined) return false;

        const velocity = data.velocity;
        const blockBelow = data.blockBelow;
        const roundedVelocity = Math.round(velocity);
        // Chat.message('velocity check; velocity = ' + JSON.stringify(data));
        if (blockBelow && !blockBelow.includes('air') && (roundedVelocity === 1 || roundedVelocity === 0)) {
            Chat.messageDebug('ignoring fall velocity packet');
            this._setIgnore(1000);
        } else {
            Chat.messageDebug('not ignoring fall velocity packet, data = ' + JSON.stringify(data));
        }

        return this.ignore;
    }

    _isTeleportItemHeld() {
        const heldItem = Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase();
        return Boolean(heldItem?.includes('aspect of the') && !heldItem?.includes('dragons'));
    }

    _hasSmallRotationDiff(data) {
        const { yaw, pitch, currYaw, currPitch } = data;
        if (yaw === undefined || pitch === undefined) return false;

        const yawDiff = Math.abs(yaw - currYaw);
        const pitchDiff = Math.abs(pitch - currPitch);
        return yawDiff < 30 && pitchDiff < 30;
    }

    _isAlongLookVector(data) {
        const { fromX, fromY, fromZ, toX, toY, toZ, lookVector } = data;
        if (!lookVector || fromX === undefined) return false;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dz = toZ - fromZ;
        const dist = Math.hypot(dx, dy, dz);
        if (dist <= 0.1) return false;

        const dot = (dx * lookVector.x + dy * lookVector.y + dz * lookVector.z) / dist;
        return dot > 0.85;
    }

    _handleTeleportCheck(data) {
        const now = Date.now();

        const recentClick = data.lastRightClickTime && now - data.lastRightClickTime < 1000;
        const usedItem = recentClick && this._isTeleportItemHeld();

        const recentCommand = data.lastCommandTime && now - data.lastCommandTime < 1000;
        if (!usedItem && !recentCommand) return false;

        if (this._hasSmallRotationDiff(data) || this._isAlongLookVector(data)) {
            this._setIgnore(500);
            return true;
        }

        return false;
    }

    _registerListeners() {
        if (this.registered) return;
        this.registered = true;
        register('worldLoad', () => {
            this._setIgnore(1000);
        });
        manager.subscribe('serverchange', () => {
            this._setIgnore(1000);
        });
        manager.subscribe('death', () => {
            this._setIgnore(1000);
        });
        manager.subscribe('warp', () => {
            this._setIgnore(1000);
        });
    }

    _getReactionDelay(settings) {
        const raw = Number(settings?.FailsafeReactionTime);
        if (!isFinite(raw)) return 600;
        return Math.max(0, Math.floor(raw - 50));
    }

    isFalse(checkType, data = {}) {
        this._handleVelocityOnFireIgnore(checkType);

        if (checkType == 'velocity') {
            return this._handleVelocityCheck(data);
        }

        if (checkType == 'teleport' && this._handleTeleportCheck(data)) {
            return true;
        }

        return this.ignore;
    }
}
