import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import { ClientboundSystemChatPacket } from '../../utils/Packets';

const COOLDOWN_MS = 3000;

class ChatMentionFailsafe extends Failsafe {
    constructor() {
        super();
        this.cooldowns = new Map();
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;
            if (packet.overlay()) return; // action bar

            this.settings = FailsafeUtils.getFailsafeSettings('Chat Mention');
            if (!this.settings.isEnabled) return;
            const content = packet.content().getString();
            const colonIndex = content.indexOf(':');
            if (colonIndex === -1) return;
            if (this._isOwnMessage(content, colonIndex)) return;

            const messageBody = content.slice(colonIndex + 1).trim();
            const highWords = this._getWords(this.settings.chatMentionHighWords);
            const mediumWords = this._getWords(this.settings.chatMentionMediumWords);
            const playerName = Player.getName?.();
            if (playerName) highWords.push(playerName);

            const highMatch = highWords.find((word) => this._wordMatches(messageBody, word));
            const blockedWord = highMatch || mediumWords.find((word) => this._wordMatches(messageBody, word));
            if (!blockedWord) return;

            const severity = highMatch ? 'high' : 'medium';
            const fullMessage = content.trim();
            const cooldownKey = `${severity}:${blockedWord}:${fullMessage}`;
            const now = Date.now();
            if (now - (this.cooldowns.get(cooldownKey) || 0) < COOLDOWN_MS) return;
            this.cooldowns.set(cooldownKey, now);

            this._reportFailsafe({
                type: 'Chat Mention',
                severity,
                pressure: highMatch ? 30 : 10,
                description: `Someone mentioned: "${blockedWord}"\nFull message: "${fullMessage}"`,
                chat: `&c&lDetected blacklisted word - "${blockedWord}"!`,
            });
        }).setFilteredClass(ClientboundSystemChatPacket);
    }

    _isOwnMessage(content, colonIndex) {
        const playerName = Player.getName?.();
        if (!playerName) return false;
        const sender = content.slice(0, colonIndex);
        const cleanSender = sender.removeFormatting ? sender.removeFormatting() : sender;
        return cleanSender.includes(playerName);
    }

    _getWords(raw) {
        return typeof raw === 'string'
            ? raw
                  .split(',')
                  .map((word) => word.trim())
                  .filter(Boolean)
            : [];
    }

    _wordMatches(message, word) {
        const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
    }
}

new ChatMentionFailsafe();
