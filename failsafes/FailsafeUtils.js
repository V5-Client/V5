import { getSetting } from '../gui/GuiSave';
import { finiteNumber } from '../utils/NumberUtils';
import { PRESETS } from './SensitivityPresets';

const SEVERITIES = {
    low: { rank: 1, color: 0x00ff00, alertColor: 0xff00ff00, line: 'LOW SUSPICIOUS ACTIVITY DETECTED!' },
    medium: { rank: 2, color: 0xffff00, alertColor: 0xffffff00, line: 'SUSPICIOUS ACTIVITY DETECTED!' },
    high: { rank: 3, color: 0xff8000, alertColor: 0xffff5500, line: 'YOU MAY HAVE BEEN MACRO CHECKED!' },
    'very high': { rank: 4, color: 0xff0000, alertColor: 0xffff0000, line: 'YOU ARE BEING MACRO CHECKED!' },
};

export const getSeverity = (severity) => SEVERITIES[String(severity || 'high').toLowerCase()] || SEVERITIES.high;

const DEFAULT_FAILSAFE_SETTINGS = {
    isEnabled: true,
    FailsafeReactionTime: 600,
    playerProximityDistance: 3,
    pingOnCheck: 'Ping',
    sensitivityPreset: 'Normal',
    pauseMacroOnFailsafe: true,
    minAlertSeverity: 'high',
    chatMentionHighWords: 'wdr, report, cheat, hack, exploit, macro',
    chatMentionMediumWords: '',
    playerGriefWhitelist: '',
};

class FailsafeUtils {
    constructor() {
        this.failsafeIntensity = 0;

        register('step', () => {
            this.failsafeIntensity = Math.max(0, this.failsafeIntensity * 0.92);
            if (this.failsafeIntensity < 0.1) this.failsafeIntensity = 0;
        }).setDelay(1);
    }

    _getSetting(name, fallback) {
        return getSetting('Failsafes', name) ?? fallback;
    }

    _getSelectedSetting(name, fallback) {
        const options = this._getSetting(name, []);
        return (Array.isArray(options) && options.find((option) => option?.enabled)?.name) || fallback;
    }

    getFailsafeSettings(name) {
        const enabled = this._getSetting('Enabled Failsafes', null);
        const reactionInput = this._getSetting('Failsafe Detection Delay (ms)', DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime);
        let reactionTime = DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;

        if (typeof reactionInput === 'object' && reactionInput.low !== undefined) {
            const { low, high } = reactionInput;
            const min = Math.min(low, high);
            const max = Math.max(low, high);
            reactionTime = Math.floor(Math.random() * (max - min + 1) + min);
        } else {
            reactionTime = finiteNumber(reactionInput, reactionTime);
        }

        return {
            isEnabled: Array.isArray(enabled) ? enabled.some((option) => option?.name === name && option.enabled) : DEFAULT_FAILSAFE_SETTINGS.isEnabled,
            FailsafeReactionTime: reactionTime,
            playerProximityDistance: this._getSetting('Player Proximity Distance', DEFAULT_FAILSAFE_SETTINGS.playerProximityDistance),
            chatMentionHighWords: this._getSetting('Chat Mention - High Severity Words', DEFAULT_FAILSAFE_SETTINGS.chatMentionHighWords),
            chatMentionMediumWords: this._getSetting('Chat Mention - Medium Severity Words', DEFAULT_FAILSAFE_SETTINGS.chatMentionMediumWords),
            playerGriefWhitelist: this._getSetting('Player Grief - Whitelist', DEFAULT_FAILSAFE_SETTINGS.playerGriefWhitelist),
        };
    }

    getGlobalSettings() {
        return {
            sensitivityPreset: this._getSelectedSetting('Failsafe Sensitivity', DEFAULT_FAILSAFE_SETTINGS.sensitivityPreset),
            pauseMacroOnFailsafe: this._getSetting('Pause macro on failsafe', DEFAULT_FAILSAFE_SETTINGS.pauseMacroOnFailsafe),
            minAlertSeverity: this._getSelectedSetting('Min severity to fire alert overlay', DEFAULT_FAILSAFE_SETTINGS.minAlertSeverity),
        };
    }

    getSensitivityPreset() {
        return PRESETS[this.getGlobalSettings().sensitivityPreset] || PRESETS.Normal;
    }

    sendFailsafeEmbed(type, severity, description) {
        const { Webhook } = require('../utils/Webhooks');
        const mode = this._getSelectedSetting('Discord ping on Check', DEFAULT_FAILSAFE_SETTINGS.pingOnCheck);
        if (mode === 'None') return;

        const ping = mode.startsWith('Ping');
        const title = `**[${severity.toUpperCase()}]** ${type} Failsafe Triggered!`;
        const color = getSeverity(severity).color;
        if (mode.includes('Screenshot')) {
            Client.scheduleTask(5, () => Webhook.sendFailsafeScreenshot(title, description, color, 'V5 Failsafes', ping));
            return;
        }

        Webhook.sendFailsafeEmbed([{ title, description, color, footer: { text: 'V5 Failsafes' }, timestamp: new Date().toISOString() }], ping);
    }

    incrementFailsafeIntensity(amt) {
        const amount = Number(amt);
        if (!Number.isFinite(amount)) return;
        this.failsafeIntensity = Math.max(0, Math.min(1000, this.failsafeIntensity + amount));
    }

    getIntensity() {
        return Math.max(0, Math.min(1000, Math.round(this.failsafeIntensity)));
    }
}

export default new FailsafeUtils();
