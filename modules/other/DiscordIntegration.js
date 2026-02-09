import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { Webhook } from '../../utils/Webhooks';
import { OverlayManager } from '../../gui/OverlayUtils';
import { TimeUtils } from '../../utils/TimeUtils';

class DiscordIntegration extends ModuleBase {
    constructor() {
        super({
            name: 'Discord Integration',
            subcategory: 'Core',
            description: 'Discord Integration',
            showEnabledToggle: true,
            hideInModules: true,
        });

        this.sectionName = 'Discord Integration';
        this.lastSendTime = 0;
        this.lastActiveMacro = null;

        const settings = Webhook.getData() || {};
        this.URL = String(settings.url ?? '');
        this.ID = String(settings.userId ?? '').trim();

        this.MACRO_EMBEDS = true;
        this.FIVE_MINUTES = 5 * 60 * 1000;

        this.addDirectTextInput('Webhook URL', this.URL, (v) => this.handleWebhookUrlChange(v), 'Enter your webhook URL here.', this.sectionName);
        this.addDirectTextInput('User ID', this.ID, (v) => this.handleIDChange(v), 'Enter your user ID here.', this.sectionName);

        this.addDirectToggle(
            'Send Embed on CT load',
            (v) => Webhook.sendLoadEmbeds(!!v),
            'Sends an embed to your webhook when CT loads',
            true,
            this.sectionName
        );

        this.addDirectToggle(
            'Macro Embeds',
            (v) => {
                this.MACRO_EMBEDS = !!v;
            },
            'Sends an embed every 5 minutes with a screenshot while active',
            true,
            this.sectionName
        );

        this.when(
            () => this.MACRO_EMBEDS,
            'tick',
            () => {
                this.onTick();
            }
        );
    }

    onTick() {
        const currentMacro = this.getActiveMacro();

        if ((!currentMacro || !this.MACRO_EMBEDS) && this.lastActiveMacro) {
            if (this.MACRO_EMBEDS) this.sendDisableEmbed(this.lastActiveMacro);
            this.lastActiveMacro = null;
            this.lastSendTime = 0;
            return;
        }

        if (!currentMacro || !this.MACRO_EMBEDS) return (this.lastSendTime = 0);
        if (this.lastActiveMacro && this.lastActiveMacro !== currentMacro) {
            const stillEnabled = MacroState.getEnabledMacros().includes(this.lastActiveMacro);
            if (!stillEnabled) this.sendDisableEmbed(this.lastActiveMacro);
            this.lastSendTime = 0;
        }

        this.lastActiveMacro = currentMacro;

        const startTime = OverlayManager.startTimes[currentMacro];
        if (!startTime) return;

        const now = Date.now();
        const elapsedMs = now - startTime;

        const currentInterval = Math.floor(elapsedMs / this.FIVE_MINUTES);
        const lastInterval = Math.floor(this.lastSendTime / this.FIVE_MINUTES);

        if (currentInterval > lastInterval && this.lastSendTime !== 0) {
            this.sendIntervalEmbed(currentMacro, startTime);
        }

        this.lastSendTime = elapsedMs;
    }

    getMacroDuration(macroName) {
        const saved = OverlayManager.savedSessions && OverlayManager.savedSessions[macroName];
        if (saved && typeof saved.elapsedMs === 'number') {
            return TimeUtils.formatDurationMs(saved.elapsedMs);
        }

        const startTime = OverlayManager.startTimes && OverlayManager.startTimes[macroName];
        if (startTime) return OverlayManager.formatUptime(startTime);

        return '';
    }

    sendDisableEmbed(macroName) {
        const duration = this.getMacroDuration(macroName);
        Webhook.sendScreenshot(`Disabled ${macroName}`, duration);
    }

    sendIntervalEmbed(macroName, startTime) {
        if (!macroName || !startTime) return;
        const duration = OverlayManager.formatUptime(startTime);
        Webhook.sendScreenshot(`Update of ${macroName}`, duration);
    }

    getActiveMacro() {
        return MacroState.getEnabledMacros().find((name) => {
            const mod = MacroState.getModule(name);
            return mod && !mod.isParentManaged;
        });
    }

    handleWebhookUrlChange(url) {
        const trimmed = (url ?? '').trim();
        if (trimmed === this.URL) return;

        const canonical = trimmed.split(/[?#]/)[0];
        const valid = canonical === '' || /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[^\s/]+\/?$/.test(canonical);
        if (!valid) return Chat.message('&cInvalid Discord webhook format.');

        this.URL = trimmed;
        Webhook.setWebhook(trimmed);
        Chat.message('&aDiscord webhook endpoint updated.');
    }

    handleIDChange(id) {
        const trimmed = String(id ?? '').trim();
        if (trimmed === String(this.ID ?? '').trim()) return;
        this.ID = trimmed;
        Webhook.setUserId(trimmed);
        Chat.message('&aDiscord webhook ID updated.');
    }
}

new DiscordIntegration();
