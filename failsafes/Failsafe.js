import { Chat } from '../utils/Chat';
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
    isFalse(checkType) {
        //Chat.messageDebug('isOnFire? ' + Player.toMC().isOnFire());//this message never sends for some reason, sends fine without the player.tomc.isonfire? user issue ig!
        if (checkType == 'velocity' && Player.toMC().isOnFire()) return true; // still doesnt work, maybe hypixel issue or i was lied to on method name, either way ill fix later :cool1:
        return this.ignore;
    }
}
