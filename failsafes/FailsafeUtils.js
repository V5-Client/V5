import { V5ConfigFile } from '../utils/Constants';
import { finiteNumber } from '../utils/NumberUtils';

const DEFAULT_FAILSAFE_SETTINGS = {
    isEnabled: true,
    FailsafeReactionTime: 600,
    playerProximityDistance: 3,
    pingOnCheck: 'Ping',
    playSoundOnCheck: true,
    desktopNotificationOnCheck: true,
    grabWindowOnCheck: false,
    failsafeVolume: 100,
    customFailsafeSound: '',
};

class FailsafeUtils {
    constructor() {
        this.failsafeIntensity = 0;

        this._cache = {
            expiresAt: 0,
            lastModified: -1,
            config: {},
            normalized: null,
        };
        this._utils = null;
    }

    _getConfig() {
        const now = Date.now();
        const lastModified = V5ConfigFile.exists() ? V5ConfigFile.lastModified() : -1;
        const cacheValid = now < this._cache.expiresAt && this._cache.lastModified === lastModified;
        if (cacheValid) {
            return this._cache.config;
        }

        if (!this._utils) this._utils = require('../utils/Utils').Utils;
        const config = this._utils.getConfigFile('config.json');

        this._cache.expiresAt = now + 250;
        this._cache.lastModified = lastModified;
        this._cache.config = config;
        this._cache.normalized = null;

        return config;
    }

    _normalizeFailsafeConfig(failsafesConfig) {
        if (this._cache.normalized) return this._cache.normalized;

        const enabledMap = {};
        const enabledList = failsafesConfig['Enabled Failsafes'];
        if (Array.isArray(enabledList)) {
            for (const entry of enabledList) {
                if (!entry || !entry.name) continue;
                enabledMap[entry.name] = !!entry.enabled;
            }
        }

        const pingConfig = failsafesConfig['Discord ping on Check'];
        let pingOnCheckValue = DEFAULT_FAILSAFE_SETTINGS.pingOnCheck;

        if (Array.isArray(pingConfig)) {
            for (const option of pingConfig) {
                if (option?.enabled) {
                    pingOnCheckValue = option.name ?? DEFAULT_FAILSAFE_SETTINGS.pingOnCheck;
                    break;
                }
            }
        } else if (typeof pingConfig === 'boolean') {
            pingOnCheckValue = pingConfig ? 'Ping' : 'None';
        } else {
            pingOnCheckValue = pingConfig ?? DEFAULT_FAILSAFE_SETTINGS.pingOnCheck;
        }

        const actionsConfig = failsafesConfig['Failsafe Actions'];
        let desktopNotificationOnCheck = failsafesConfig['Desktop Notification on Check'] ?? DEFAULT_FAILSAFE_SETTINGS.desktopNotificationOnCheck;
        let grabWindowOnCheck = DEFAULT_FAILSAFE_SETTINGS.grabWindowOnCheck;
        if (Array.isArray(actionsConfig)) {
            const enabledActions = actionsConfig.filter((option) => option?.enabled).map((option) => option?.name);
            desktopNotificationOnCheck = enabledActions.includes('Desktop Alerts');
            grabWindowOnCheck = enabledActions.includes('Grab Game Window');
        }

        const normalized = {
            enabledMap,
            rawEnabledList: enabledList,
            reactionInput: failsafesConfig['Failsafe Detection Delay (ms)'] ?? DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime,
            playerProximityDistance: failsafesConfig['Player Proximity Distance'] ?? DEFAULT_FAILSAFE_SETTINGS.playerProximityDistance,
            playSoundOnCheck: failsafesConfig['Play sound on check'] ?? DEFAULT_FAILSAFE_SETTINGS.playSoundOnCheck,
            desktopNotificationOnCheck,
            grabWindowOnCheck,
            failsafeVolume: failsafesConfig['Failsafe Sound Volume'] ?? DEFAULT_FAILSAFE_SETTINGS.failsafeVolume,
            customFailsafeSound: failsafesConfig['Custom Failsafe Sound'] ?? DEFAULT_FAILSAFE_SETTINGS.customFailsafeSound,
            pingOnCheck: pingOnCheckValue,
        };

        this._cache.normalized = normalized;
        return normalized;
    }

    getFailsafeSettings(name) {
        const config = this._getConfig();

        if (!config || !config['Failsafes']) {
            return DEFAULT_FAILSAFE_SETTINGS;
        }

        const normalized = this._normalizeFailsafeConfig(config['Failsafes']);
        const reactionInput = normalized.reactionInput;
        let reactionTime = DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;

        if (typeof reactionInput === 'object' && reactionInput.low !== undefined) {
            const { low, high } = reactionInput;
            const min = Math.min(low, high);
            const max = Math.max(low, high);
            reactionTime = Math.floor(Math.random() * (max - min + 1) + min);
        } else {
            reactionTime = finiteNumber(reactionInput, reactionTime);
        }

        const hasEnabledList = Array.isArray(normalized.rawEnabledList);
        const isEnabled = hasEnabledList
            ? (normalized.enabledMap[name] ?? false)
            : (config['Failsafes'][`${name} Failsafe`] ?? DEFAULT_FAILSAFE_SETTINGS.isEnabled);

        return {
            isEnabled,
            FailsafeReactionTime: reactionTime,
            playerProximityDistance: normalized.playerProximityDistance,
            pingOnCheck: normalized.pingOnCheck,
            playSoundOnCheck: normalized.playSoundOnCheck,
            desktopNotificationOnCheck: normalized.desktopNotificationOnCheck,
            grabWindowOnCheck: normalized.grabWindowOnCheck,
            failsafeVolume: normalized.failsafeVolume,
            customFailsafeSound: normalized.customFailsafeSound,
        };
    }

    sendFailsafeEmbed(type, severity, description, color) {
        const { Webhook } = require('../utils/Webhooks');

        const pingOnCheckValue = this.getFailsafeSettings(type).pingOnCheck;

        if (pingOnCheckValue === 'Ping' || pingOnCheckValue === 'Embed Only') {
            Webhook.sendFailsafeEmbed(
                [
                    {
                        title: `**[${severity.toUpperCase()}]** ${type} Failsafe Triggered!`,
                        description: `${description}`,
                        color,
                        footer: { text: `V5 Failsafes` },
                        timestamp: new Date().toISOString(),
                    },
                ],
                pingOnCheckValue === 'Ping'
            );
        } else if (pingOnCheckValue === 'Ping & Screenshot' || pingOnCheckValue === 'Screenshot Only') {
            Client.scheduleTask(5, () =>
                Webhook.sendFailsafeScreenshot(
                    `**[${severity.toUpperCase()}]** ${type} Failsafe Triggered!`,
                    description,
                    color,
                    `V5 Failsafes`,
                    pingOnCheckValue === 'Ping & Screenshot'
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
