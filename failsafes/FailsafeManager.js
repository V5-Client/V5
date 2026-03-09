import ChatMentionFailsafe from './impl/ChatMentionFailsafe';
import PlayerGriefFailsafe from './impl/PlayerGriefFailsafe';
import RotationFailsafe from './impl/RotationFailsafe';
import SlotChangeFailsafe from './impl/SlotChangeFailsafe';
import TeleportFailsafe from './impl/TeleportFailsafe';
import VelocityFailsafe from './impl/VelocityFailsafe';

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
