import { Categories } from '../../gui/categories/CategorySystem';
import { getEnabledMacros, getLastDisableMeta, getModule, getModuleDuration, getModuleStartTime } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { getWebhookData, sendScreenshot, setFailsafeEmbedsEnabled, setLoadEmbedsEnabled, setWebhook, setWebhookUserId } from '../../utils/Webhooks';

class DiscordIntegration extends ModuleBase {
    constructor() {
        super({
            name: 'modules.discord_integration.name',
            subcategory: 'Core',
            description: 'modules.discord_integration.description',
            theme: '#7289da',
            hideInModules: true,
        });

        this.sectionName = 'Discord Integration';
        this.lastSendTime = 0;
        this.lastActiveMacro = null;

        const settings = getWebhookData() || {};
        this.URL = String(settings.url ?? '');
        this.ID = String(settings.userId ?? '').trim();

        this.MACRO_EMBEDS = true;
        this.FAILSAFE_EMBEDS = true;
        this.FIVE_MINUTES = 5 * 60 * 1000;

        Categories.addSettingsTextInput(
            'labels.webhook_url',
            this.URL,
            (v) => this.handleWebhookUrlChange(v),
            'Enter your webhook URL here.',
            this.sectionName,
            'Discord'
        );
        Categories.addSettingsTextInput('labels.user_id', this.ID, (v) => this.handleIDChange(v), 'Enter your user ID here.', this.sectionName, 'Discord');

        Categories.addSettingsToggle(
            'labels.send_embed_on_load',
            (v) => setLoadEmbedsEnabled(!!v),
            'descriptions.send_embed_on_load',
            true,
            this.sectionName,
            'Discord'
        );

        Categories.addSettingsToggle(
            'labels.macro_embeds',
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
            'labels.failsafe_embeds',
            (v) => {
                this.FAILSAFE_EMBEDS = !!v;
                setFailsafeEmbedsEnabled(this.FAILSAFE_EMBEDS);
            },
            'descriptions.failsafe_embeds',
            true,
            this.sectionName,
            'Discord'
        );

        this.when(
            () => this.MACRO_EMBEDS,
            'tick',
            () => {
                this.onTick();
            }
        );
    }

    onDisable() {
        this.lastActiveMacro = null;
        this.lastSendTime = 0;
    }

    onTick() {
        const currentMacro = this.getActiveMacro();

        if ((!currentMacro || !this.MACRO_EMBEDS) && this.lastActiveMacro) {
            if (this.MACRO_EMBEDS) this.trySendDisableEmbed(this.lastActiveMacro);
            this.lastActiveMacro = null;
            this.lastSendTime = 0;
            return;
        }

        if (!currentMacro || !this.MACRO_EMBEDS) return (this.lastSendTime = 0);
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
            this.sendIntervalEmbed(currentMacro);
        }

        this.lastSendTime = elapsedMs;
    }

    trySendDisableEmbed(macroName) {
        const meta = getLastDisableMeta(macroName);
        if (meta && meta.context === 'scheduler') return;
        this.sendDisableEmbed(macroName);
    }

    sendDisableEmbed(macroName) {
        sendScreenshot(`Disabled ${macroName}`, getModuleDuration(macroName));
    }

    sendIntervalEmbed(macroName) {
        if (!macroName) return;
        const duration = getModuleDuration(macroName);
        sendScreenshot(`Update of ${macroName}`, duration ? `**Runtime:** ${duration}` : '');
    }

    getActiveMacro() {
        return getEnabledMacros().find((name) => {
            const mod = getModule(name);
            return mod && !mod.isParentManaged;
        });
    }

    handleWebhookUrlChange(url) {
        const trimmed = (url ?? '').trim();
        if (trimmed === this.URL) return;

        const canonical = trimmed.split(/[?#]/)[0];
        const valid = canonical === '' || /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[^\s/]+\/?$/.test(canonical);
        if (!valid) return this.message('messages.discord.invalidWebhook');

        this.URL = trimmed;
        setWebhook(trimmed);
        this.message('messages.discord.endpointUpdated');
    }

    handleIDChange(id) {
        const trimmed = String(id ?? '').trim();
        if (trimmed === String(this.ID ?? '').trim()) return;
        this.ID = trimmed;
        setWebhookUserId(trimmed);
        this.message('messages.discord.idUpdated');
    }
}

new DiscordIntegration();
