import ChatMentionFailsafe from './impl/ChatMentionFailsafe.js';
import PlayerGriefFailsafe from './impl/PlayerGriefFailsafe.js';
import RotationFailsafe from './impl/RotationFailsafe.js';
import SlotChangeFailsafe from './impl/SlotChangeFailsafe.js';
import TeleportFailsafe from './impl/TeleportFailsafe.js';
import VelocityFailsafe from './impl/VelocityFailsafe.js';

// just keep it here to import all the failsafes to loader :)
class FailsafeManager {
    constructor() {
        this.failsafes = [ChatMentionFailsafe, PlayerGriefFailsafe, RotationFailsafe, SlotChangeFailsafe, TeleportFailsafe, VelocityFailsafe];
    }

    getFailsafes() {
        return this.failsafes;
    }
}

export default new FailsafeManager();
