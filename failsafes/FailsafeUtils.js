import { V5ConfigFile } from '../utils/Constants';
import { MacroState } from '../utils/MacroState';

const DEFAULT_FAILSAFE_SETTINGS = {
    isEnabled: true,
    FailsafeReactionTime: 600,
    playerProximityDistance: 3,
    pingOnCheck: 'Ping',
    playSoundOnCheck: true,
};

class FailsafeUtils {
    constructor() {
        this.failsafeIntensity = 0;

        this._cache = {
            expiresAt: 0,
            lastModified: -1,
            config: {},
        };
    }

    _getConfig() {
        const now = Date.now();
        const lastModified = V5ConfigFile.exists() ? V5ConfigFile.lastModified() : -1;

        if ((now < this._cache.expiresAt && this._cache.lastModified === lastModified) || MacroState.isMacroRunning()) {
            return this._cache.config;
        }

        const utils = require('../utils/Utils').Utils;
        const config = utils.getConfigFile('config.json');

        this._cache.expiresAt = now + 250;
        this._cache.lastModified = lastModified;
        this._cache.config = config;

        return config;
    }

    getFailsafeSettings(name) {
        const config = this._getConfig();

        if (!config || !config['Failsafes']) {
            return DEFAULT_FAILSAFE_SETTINGS;
        }

        const failsafesConfig = config['Failsafes'];

        const reactionInput = failsafesConfig['Failsafe Detection Delay (ms)'] ?? DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;
        let reactionTime = DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;

        if (typeof reactionInput === 'object' && reactionInput.low !== undefined) {
            const { low, high } = reactionInput;
            const min = Math.min(low, high);
            const max = Math.max(low, high);
            reactionTime = Math.floor(Math.random() * (max - min + 1) + min);
        } else {
            reactionTime = Number.isFinite(reactionInput) ? reactionInput : reactionTime;
        }

        const enabledList = failsafesConfig['Enabled Failsafes'];
        const isEnabled = Array.isArray(enabledList)
            ? enabledList.some((entry) => entry.name === name && entry.enabled)
            : (failsafesConfig[`${name} Failsafe`] ?? DEFAULT_FAILSAFE_SETTINGS.isEnabled);

        const pingConfig = failsafesConfig['Discord ping on Check'];
        const pingOnCheckValue = Array.isArray(pingConfig)
            ? pingConfig.find((option) => option.enabled)?.name
            : (pingConfig ?? DEFAULT_FAILSAFE_SETTINGS.pingOnCheck);

        return {
            isEnabled: isEnabled,
            FailsafeReactionTime: reactionTime,
            playerProximityDistance: failsafesConfig['Player Proximity Distance'] ?? DEFAULT_FAILSAFE_SETTINGS.playerProximityDistance,
            pingOnCheck: pingOnCheckValue,
            playSoundOnCheck: failsafesConfig['Play sound on check'] ?? DEFAULT_FAILSAFE_SETTINGS.playSoundOnCheck,
        };
    }

    sendFailsafeEmbed(type, severity, description, color) {
        const { Webhook } = require('../utils/Webhooks');

        const pingOnCheckValue = this.getFailsafeSettings(type).pingOnCheck;

        if (pingOnCheckValue === 'Ping' || pingOnCheckValue === 'Embed Only') {
            Webhook.sendEmbed(
                [
                    {
                        title: `**[${severity.toUpperCase()}]** ${type} Failsafe Triggered!`,
                        description: `${description}`,
                        color: color,
                        footer: { text: `V5 Failsafes` },
                        timestamp: new Date().toISOString(),
                    },
                ],
                pingOnCheckValue === 'Ping' ? true : false
            );
        } else if (pingOnCheckValue === 'Ping & Screenshot' || pingOnCheckValue === 'Screenshot Only') {
            Client.scheduleTask(5, () =>
                Webhook.sendScreenshot(
                    `**[${severity.toUpperCase()}]** ${type} Failsafe Triggered!`,
                    description,
                    color,
                    `V5 Failsafes`,
                    pingOnCheckValue === 'Ping & Screenshot' ? true : false
                )
            );
        }
    }

    incrementFailsafeIntensity(amt) {
        this.failsafeIntensity += amt;
        setTimeout(() => (this.failsafeIntensity -= amt / 10), 1000);
    }

    getIntensity() {
        return this.failsafeIntensity;
    }
}

export default new FailsafeUtils();
