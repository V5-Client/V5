import { Chat } from '../utils/Chat';
import { Vec3d } from '../utils/Constants';
import { manager } from '../utils/SkyblockEvents';
export class Failsafe {
    constructor() {
        this.registered = false;
        this.ignore = false;
        this._registerListeners();
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {}
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
        if (checkType == 'velocity' && Player.toMC().isOnFire()) {
            this.ignore = true;
            setTimeout(() => {
                this.ignore = false; // bandaid because isOnFire is only true while inside the inflicting block?? idk man
            }, 9000);
        }
        if (checkType == 'teleport') {
            const heldItem = Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase();
            const isAOTE = heldItem && (heldItem.includes('aspect of the end') || heldItem.includes('aspect of the void'));
            const { distance, yaw, pitch, currYaw, currPitch, lastRightClickTime, fromX, fromY, fromZ, toX, toY, toZ, lookVector } = data;

            if (isAOTE) {
                const recentClick = lastRightClickTime && Date.now() - lastRightClickTime < 1000;
                if (recentClick) {
                    if (yaw !== undefined && pitch !== undefined) {
                        const yawDiff = Math.abs(yaw - currYaw);
                        const pitchDiff = Math.abs(pitch - currPitch);
                        if (yawDiff < 30 && pitchDiff < 30) {
                            this.ignore = true;
                            setTimeout(() => (this.ignore = false), 500);
                            return true;
                        }
                    }

                    if (lookVector && fromX !== undefined) {
                        const dx = toX - fromX;
                        const dy = toY - fromY;
                        const dz = toZ - fromZ;
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (dist > 0.1) {
                            const dot = (dx * lookVector.x + dy * lookVector.y + dz * lookVector.z) / dist;
                            if (dot > 0.85) {
                                this.ignore = true;
                                setTimeout(() => (this.ignore = false), 500);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return this.ignore;
    }
}
