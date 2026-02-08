import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { Webhook } from '../../utils/Webhooks';

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

        const settings = Webhook.getData() || {};
        this.URL = settings.url || '';
        this.ID = settings.id || '';

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
            'step',
            () => {
                this.onStep();
            }
        );
    }

    onStep() {
        const currentMacro = this.getActiveMacro();
        const isMacroActive = !!currentMacro && this.MACRO_EMBEDS;

        if (isMacroActive) {
            const now = Date.now();
            if (this.lastSendTime === 0) return (this.lastSendTime = now);

            if (now - this.lastSendTime >= this.FIVE_MINUTES) {
                this.sendIntervalEmbed();
                this.lastSendTime = now;
            }
        } else {
            this.lastSendTime = 0;
        }
    }

    sendIntervalEmbed() {
        const currentMacro = this.getActiveMacro();
        if (!currentMacro) return;

        const startTime = MacroState.getStartTime();
        const diff = Date.now() - startTime;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const duration = `${h}h ${m}m ${s}s`;

        Webhook.sendScreenshot(`Update of ${currentMacro}`, duration);
    }

    getActiveMacro() {
        return MacroState.getEnabledMacros().find((name) => {
            const mod = MacroState.getModule(name);
            return mod && !mod.isParentManaged;
        });
    }

    handleWebhookUrlChange(url) {
        const trimmed = url.trim();
        if (trimmed === this.URL || (trimmed !== '' && !trimmed.startsWith('https://discord.com/api/webhooks/')))
            return Chat.message('&cInvalid Discord webhook format.');

        this.URL = trimmed;
        Webhook.setWebhook(trimmed);
        Chat.message('&aDiscord webhook endpoint updated.');
    }

    handleIDChange(id) {
        const trimmed = id.trim();
        if (trimmed === this.ID) return;
        this.ID = trimmed;
        Webhook.setUserId(trimmed);
        Chat.message('&aDiscord webhook ID updated.');
    }
}

new DiscordIntegration();
