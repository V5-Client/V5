import { Chat } from '../utils/Chat';
import { manager } from '../utils/SkyblockEvents';
export class Failsafe {
    registered = false;
    ignore = false;

    constructor() {
        this._registerListeners();
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {
        this.ignore = false;
    }

    _setIgnore(durationMs) {
        this.ignore = true;
        setTimeout(() => {
            this.ignore = false;
        }, durationMs);
    }

    _handleVelocityOnFireIgnore(checkType) {
        if (checkType === 'velocity' && Player.toMC()?.isOnFire?.()) {
            // bandaid because isOnFire is only true while inside the inflicting block?? idk man
            this._setIgnore(9000);
        }
    }

    _handleVelocityCheck(data) {
        if (this.ignore) return true;
        if (data.velocity === undefined) return false;

        const velocity = data.velocity;
        const blockBelow = data.blockBelow;
        // Chat.message('velocity check; velocity = ' + JSON.stringify(data));
        if (blockBelow && !blockBelow.includes('air') && (velocity.toFixed(0) == 1 || velocity.toFixed(0) == 0)) {
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
        if (!this._isTeleportItemHeld()) return false;

        const recentClick = data.lastRightClickTime && Date.now() - data.lastRightClickTime < 1000;
        if (!recentClick) return false;

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
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        manager.subscribe('serverchange', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        manager.subscribe('death', () => {
            this.ignore = true;
            setTimeout(() => {
                this.ignore = false;
            }, 1000);
        });
        manager.subscribe('warp', () => {
            this.ignore = true;
            setTimeout(() => {
                this.ignore = false;
            }, 1000);
        });
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
