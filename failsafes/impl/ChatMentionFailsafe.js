import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { Webhook } from '../../utils/Webhooks';
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
        const highSeverityWords = ['wdr', 'report', 'cheating', 'cheater'];
        let pressure;
        let severity;
        if (highSeverityWords.includes(word.toLowerCase())) {
            pressure = 30;
            severity = 'high';
        } else {
            pressure = 10;
            severity = 'medium';
        }

        Chat.messageFailsafe(`Detected blacklisted word! (${word}) (${severity} severity)`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        Webhook.sendEmbed(
            [
                {
                    title: `**Chat Mention Failsafe Triggered! [${severity}]**`,
                    description: `Someone mentioned: "${word}"`,
                    color: severity === 'high' ? 16744448 : 16776960,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? false
        );
    }
}

export default new ChatMentionFailsafe();
