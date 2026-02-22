import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import { GameMessageS2C } from '../../utils/Packets';

class ChatMentionFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Chat Mention');
        this.registerChatListeners();
        this.FailsafeReactionTime = 600;
        this.isFailsafeEnabled = true;
        this.blacklistedWords = ['macro', 'report', 'wdr', 'cheating', 'cheater', 'exploiting', 'automating', 'cheat', `${Player.getName()}`];
    }

    registerChatListeners() {
        register('packetReceived', (packet, event) => {
            if (!MacroState.isMacroRunning() || this.isFalse('chat') || packet.overlay()) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Chat Mention');
            if (!this.settings.isEnabled) return;
            this.FailsafeReactionTime = this.settings.FailsafeReactionTime || 600;

            const content = packet.content().getString();
            if (!content.includes(':')) return;

            const result = this.isBad(content);
            if (!result.isBlocked) return;

            this.onTrigger(result.blockedWord);
        }).setFilteredClass(GameMessageS2C);
    }

    isBad(msg) {
        let found = null;
        const lower = msg.toLowerCase();
        const isBlocked = this.blacklistedWords.some((word) => {
            if (lower.includes(word.toLowerCase())) {
                found = word;
                return true;
            }
            return false;
        });

        return { isBlocked: isBlocked, blockedWord: found };
    }

    onTrigger(word) {
        const isHigh = ['wdr', 'report', 'cheating', 'cheater'].includes(word.toLowerCase());

        const pressure = isHigh ? 30 : 10;
        const severity = isHigh ? 'high' : 'medium';

        Chat.messageFailsafe(`&c&lDetected blacklisted word - "${word}"!`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        FailsafeUtils.sendFailsafeEmbed('Chat Mention', severity, `Someone mentioned: "${word}"`, severity === 'high' ? 16744448 : 16776960);
    }
}

export default new ChatMentionFailsafe();
