import ChatMentionFailsafe from './impl/ChatMentionFailsafe.js';
import PlayerGriefFailsafe from './impl/PlayerGriefFailsafe.js';
import RotationFailsafe from './impl/RotationFailsafe.js';
import SlotChangeFailsafe from './impl/SlotChangeFailsafe.js';
import TeleportFailsafe from './impl/TeleportFailsafe.js';
import VelocityFailsafe from './impl/VelocityFailsafe.js';

// idk what the point of the manager is, but i'll leave it here for now
class FailsafeManager {
    constructor() {
        this.failsafes = [ChatMentionFailsafe, PlayerGriefFailsafe, RotationFailsafe, SlotChangeFailsafe, TeleportFailsafe, VelocityFailsafe];
    }

    getFailsafes() {
        return this.failsafes;
    }
}

export default new FailsafeManager();
