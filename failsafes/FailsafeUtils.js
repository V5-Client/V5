import { V5ConfigFile } from '../utils/Constants.js';

const DEFAULT_FAILSAFE_SETTINGS = {
    isEnabled: true,
    FailsafeReactionTime: 600,
    playerProximityDistance: 3,
    pingOnCheck: true,
    playSoundOnCheck: true,
};

class FailsafeUtils {
    failsafeIntensity = 0;

    constructor() {
        this._cache = {
            expiresAt: 0,
            lastModified: -1,
            config: {},
        };
    }

    _getConfig() {
        const now = Date.now();
        const lastModified = V5ConfigFile.exists() ? V5ConfigFile.lastModified() : -1;

        if (now < this._cache.expiresAt && this._cache.lastModified === lastModified) {
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

        if (typeof reactionInput === 'object' && reactionInput.low !== undefined && reactionInput.high !== undefined) {
            const low = Math.min(reactionInput.low, reactionInput.high);
            const high = Math.max(reactionInput.low, reactionInput.high);
            reactionTime = Math.floor(Math.random() * (high - low + 1) + low);
        } else if (typeof reactionInput === 'number' && isFinite(reactionInput)) {
            reactionTime = reactionInput;
        }

        const enabledList = failsafesConfig['Enabled Failsafes'];
        const isEnabled = Array.isArray(enabledList)
            ? enabledList.some((entry) => entry.name === name && entry.enabled)
            : (failsafesConfig[`${name} Failsafe`] ?? DEFAULT_FAILSAFE_SETTINGS.isEnabled);

        return {
            isEnabled: isEnabled,
            FailsafeReactionTime: reactionTime,
            playerProximityDistance: failsafesConfig['Player Proximity Distance'] ?? DEFAULT_FAILSAFE_SETTINGS.playerProximityDistance,
            pingOnCheck: failsafesConfig['Ping on check'] ?? DEFAULT_FAILSAFE_SETTINGS.pingOnCheck,
            playSoundOnCheck: failsafesConfig['Play sound on check'] ?? DEFAULT_FAILSAFE_SETTINGS.playSoundOnCheck,
        };
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
