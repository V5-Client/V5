import { Categories } from '../../gui/categories/CategorySystem';
import { getEnabledMacros, getLastDisableMeta, getModule, getModuleDuration, getModuleStartTime } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { Webhook } from '../../utils/Webhooks';

class DiscordIntegration extends ModuleBase {
    constructor() {
        super({
            name: 'Discord Integration',
            subcategory: 'Core',
            description: 'Discord Integration',
            theme: '#7289da',
            hideInModules: true,
        });

        this.sectionName = 'Discord Integration';
        this.lastSendTime = 0;
        this.lastActiveMacro = null;

        this.URL = String(Webhook.endpoint ?? '');
        this.ID = String(Webhook.mentionId ?? '').trim();

        this.MACRO_EMBEDS = true;
        this.FIVE_MINUTES = 5 * 60 * 1000;

        Categories.addSettingsTextInput(
            'Webhook URL',
            this.URL,
            (v) => this.handleWebhookUrlChange(v),
            'Enter your webhook URL here.',
            this.sectionName,
            'Discord'
        );
        Categories.addSettingsTextInput('User ID', this.ID, (v) => this.handleIDChange(v), 'Enter your user ID here.', this.sectionName, 'Discord');

        Categories.addSettingsToggle(
            'Send Embed on CT load',
            (v) => (Webhook.sendLoadEmbeds = !!v),
            'Sends an embed to your webhook when CT loads',
            true,
            this.sectionName,
            'Discord'
        );

        Categories.addSettingsToggle(
            'Macro Embeds',
            (v) => {
                this.MACRO_EMBEDS = !!v;
                if (!this.MACRO_EMBEDS) {
                    this.lastActiveMacro = null;
                    this.lastSendTime = 0;
                }
            },
            'Sends an embed every 5 minutes with a screenshot while active + a disable embed when turned off.',
            true,
            this.sectionName,
            'Discord'
        );

        Categories.addSettingsToggle(
            'Failsafe Embeds',
            (v) => (Webhook.sendFailsafeEmbeds = !!v),
            'Sends failsafe embeds and screenshots to your webhook',
            true,
            this.sectionName,
            'Discord'
        );

        this.when(
            () => this.MACRO_EMBEDS,
            'tick',
            () => this.onTick()
        );
    }

    onDisable() {
        this.lastActiveMacro = null;
        this.lastSendTime = 0;
    }

    onTick() {
        const currentMacro = getEnabledMacros().find((name) => {
            const mod = getModule(name);
            return mod && !mod.isParentManaged;
        });

        if (!currentMacro && this.lastActiveMacro) {
            this.trySendDisableEmbed(this.lastActiveMacro);
            this.lastActiveMacro = null;
            this.lastSendTime = 0;
            return;
        }

        if (!currentMacro) return (this.lastSendTime = 0);
        if (this.lastActiveMacro && this.lastActiveMacro !== currentMacro) {
            const stillEnabled = getEnabledMacros().includes(this.lastActiveMacro);
            if (!stillEnabled) this.trySendDisableEmbed(this.lastActiveMacro);
            this.lastSendTime = 0;
        }

        this.lastActiveMacro = currentMacro;

        const startTime = getModuleStartTime(currentMacro);
        if (!startTime) return;

        const now = Date.now();
        const elapsedMs = now - startTime;

        const currentInterval = Math.floor(elapsedMs / this.FIVE_MINUTES);
        const lastInterval = Math.floor(this.lastSendTime / this.FIVE_MINUTES);

        if (currentInterval > lastInterval && this.lastSendTime !== 0) {
            const duration = getModuleDuration(currentMacro);
            Webhook.takeScreenshot(`Update of ${currentMacro}`, duration ? `**Runtime:** ${duration}` : '');
        }

        this.lastSendTime = elapsedMs;
    }

    trySendDisableEmbed(macroName) {
        const meta = getLastDisableMeta(macroName);
        if (meta && meta.context === 'scheduler') return;
        Webhook.takeScreenshot(`Disabled ${macroName}`, getModuleDuration(macroName));
    }

    handleWebhookUrlChange(url) {
        const trimmed = (url ?? '').trim();
        if (trimmed === this.URL) return;

        if (!Webhook.updateEndpoint(trimmed)) return this.message('&cInvalid Discord webhook format.');

        this.URL = trimmed;
        this.message('&aDiscord webhook endpoint updated.');
    }

    handleIDChange(id) {
        const trimmed = String(id ?? '').trim();
        if (trimmed === String(this.ID ?? '').trim()) return;
        this.ID = trimmed;
        Webhook.updateMention(trimmed);
        this.message('&aDiscord webhook ID updated.');
    }
}

new DiscordIntegration();
