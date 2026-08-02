import { Categories } from '../../gui/categories/CategorySystem';
import { getEnabledMacros, getLastDisableMeta, getModule, getModuleDuration, getModuleStartTime } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { getWebhookData, sendScreenshot, setFailsafeEmbedsEnabled, setLoadEmbedsEnabled, setWebhook, setWebhookUserId } from '../../utils/Webhooks';

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

        const settings = getWebhookData() || {};
        this.URL = String(settings.url ?? '');
        this.ID = String(settings.userId ?? '').trim();

        this.MACRO_EMBEDS = true;
        this.FAILSAFE_EMBEDS = true;
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
            (v) => setLoadEmbedsEnabled(!!v),
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
            (v) => {
                this.FAILSAFE_EMBEDS = !!v;
                setFailsafeEmbedsEnabled(this.FAILSAFE_EMBEDS);
            },
            'Sends failsafe embeds and screenshots to your webhook',
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
        if (!valid) return this.message('&cInvalid Discord webhook format.');

        this.URL = trimmed;
        setWebhook(trimmed);
        this.message('&aDiscord webhook endpoint updated.');
    }

    handleIDChange(id) {
        const trimmed = String(id ?? '').trim();
        if (trimmed === String(this.ID ?? '').trim()) return;
        this.ID = trimmed;
        setWebhookUserId(trimmed);
        this.message('&aDiscord webhook ID updated.');
    }
}

new DiscordIntegration();
