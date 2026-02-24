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
        this.mediumBlacklist = ['idk what words to put here they are all high or completely useless'].map((word) => word.toLowerCase());
        this.highBlacklist = ['wdr', 'report', 'macro', 'cheat', 'exploit', 'hack', 'bot', `${Player.getName()}`].map((word) => word.toLowerCase());
    }

    registerChatListeners() {
        register('packetReceived', (packet, event) => {
            if (!MacroState.isMacroRunning() || this.disabled) return;
            if (packet.overlay()) return; // action bar

            this.settings = FailsafeUtils.getFailsafeSettings('Chat Mention');
            if (!this.settings.isEnabled) return;
            this.FailsafeReactionTime = this.settings.FailsafeReactionTime || 600;

            const content = packet.content().getString();
            if (!content.includes(':')) return;

            const messageBody = content.split(':').slice(1).join(':').trim();

            const result = this.scanMessage(messageBody, content.trim());
            if (!result.isBlocked) return;

            this.onTrigger(result);
        }).setFilteredClass(GameMessageS2C);
    }

    scanMessage(msg, fullMessage = msg) {
        const lower = msg.toLowerCase();
        const highMatch = this.highBlacklist.find((word) => lower.includes(word));
        const mediumMatch = this.mediumBlacklist.find((word) => lower.includes(word));
        const isBlocked = !!highMatch || !!mediumMatch;
        const isHigh = !!highMatch;
        const blockedWord = highMatch || mediumMatch;

        return { isBlocked: isBlocked, blockedWord: blockedWord, isHigh: isHigh, fullMessage: fullMessage };
    }

    onTrigger(result) {
        const pressure = result.isHigh ? 30 : 10;
        const severity = result.isHigh ? 'high' : 'medium';
        const embedColour = result.isHigh ? 16744448 : 16776960;

        Chat.messageFailsafe(`&c&lDetected blacklisted word - "${result.blockedWord}"!`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        FailsafeUtils.sendFailsafeEmbed(
            'Chat Mention',
            severity,
            `Someone mentioned: "${result.blockedWord}"\nFull message: "${result.fullMessage}"`,
            embedColour
        );
    }
}

export default new ChatMentionFailsafe();
