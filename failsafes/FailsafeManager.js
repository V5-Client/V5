import './impl/ChatMentionFailsafe';
import './impl/BlockFailsafe';
import './impl/PlayerGriefFailsafe';
import './impl/RotationFailsafe';
import './impl/SlotChangeFailsafe';
import './impl/SmartFailsafe';
import './impl/TeleportFailsafe';
import './impl/VelocityFailsafe';
import { Chat } from '../utils/Chat';
import { MacroState } from '../utils/MacroState';
import { AlertUtils } from './AlertUtils';
import FailsafeUtils, { getSeverity } from './FailsafeUtils';
import { ResponseBot } from './ResponseBot';

class FailsafeManager {
    constructor() {
        this.lastReportAt = {};
    }

    report(payload) {
        const { type, severity, description, pressure, chat } = payload;
        const dedupeKey = `${type}:${severity}`;
        const now = Date.now();

        if (now - (this.lastReportAt[dedupeKey] || 0) < 750) return;
        this.lastReportAt[dedupeKey] = now;

        if (pressure) FailsafeUtils.incrementFailsafeIntensity(pressure);
        const lines = Array.isArray(chat) ? chat : [chat];
        lines.forEach((line, idx) => Chat.messageFailsafe(line, idx === lines.length - 1));
        const severityRank = getSeverity(severity).rank;
        if (severityRank >= getSeverity('medium').rank) FailsafeUtils.sendFailsafeEmbed(type, severity, description);

        const settings = FailsafeUtils.getGlobalSettings();
        if (severityRank < getSeverity(settings.minAlertSeverity).rank) return;

        if (type === 'Player Grief') {
            AlertUtils.playQuietNotification();
            return;
        }

        AlertUtils.triggerReaction(severity);

        if (!ResponseBot.isRunning) {
            const pausedMacros = settings.pauseMacroOnFailsafe ? MacroState.getEnabledMacros().map((name) => MacroState.getModule(name)) : [];
            pausedMacros.forEach((module) => module.requestToggleFromUser());
            ResponseBot.run(() => {
                AlertUtils.disableReaction();
                pausedMacros.filter((module) => !module.enabled).forEach((module) => module.requestToggleFromUser());
            });
        }
    }
}

export default new FailsafeManager();
