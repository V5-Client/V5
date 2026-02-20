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
        if (!V5ConfigFile.exists()) {
            return {};
        }

        const now = Date.now();
        const lastModified = V5ConfigFile.lastModified();
        if (now < this._cache.expiresAt && this._cache.lastModified === lastModified) {
            return this._cache.config;
        }

        const rawConfig = FileLib.read(V5ConfigFile.getAbsolutePath());
        let config = {};

        try {
            if (rawConfig && rawConfig.trim().length > 0) {
                config = JSON.parse(rawConfig);
            }
        } catch (err) {
            console.log('Failed to parse V5Config JSON, using defaults: ' + err);
        }

        this._cache.expiresAt = now + 250;
        this._cache.lastModified = lastModified;
        this._cache.config = config;
        return config;
    }

    getFailsafeSettings(name) {
        if (!V5ConfigFile.exists()) {
            console.log('V5Config not found, this shouldnt happen!'); // having this import from failsafemodule causes it to double load so kinda have to do this i think
            return DEFAULT_FAILSAFE_SETTINGS;
        }

        const config = this._getConfig();

        if (!config['Failsafes']) return DEFAULT_FAILSAFE_SETTINGS;

        const failsafesConfig = config['Failsafes'];

        const FailsafeReactionTimeInput = failsafesConfig['Failsafe Detection Delay (ms)'] ?? DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;
        let FailsafeReactionTime = DEFAULT_FAILSAFE_SETTINGS.FailsafeReactionTime;

        if (typeof FailsafeReactionTimeInput === 'object' && FailsafeReactionTimeInput.low !== undefined && FailsafeReactionTimeInput.high !== undefined) {
            const low = Math.min(FailsafeReactionTimeInput.low, FailsafeReactionTimeInput.high);
            const high = Math.max(FailsafeReactionTimeInput.low, FailsafeReactionTimeInput.high);
            FailsafeReactionTime = Math.floor(Math.random() * (high - low + 1) + low);
        } else if (typeof FailsafeReactionTimeInput === 'number' && isFinite(FailsafeReactionTimeInput)) {
            FailsafeReactionTime = FailsafeReactionTimeInput;
        }

        const enabledList = failsafesConfig['Enabled Failsafes'];
        const isEnabled = Array.isArray(enabledList)
            ? enabledList.some((entry) => entry.name === name && entry.enabled)
            : (failsafesConfig[`${name} Failsafe`] ?? DEFAULT_FAILSAFE_SETTINGS.isEnabled);
        const playerProximityDistance = failsafesConfig['Player Proximity Distance'] ?? DEFAULT_FAILSAFE_SETTINGS.playerProximityDistance;
        const pingOnCheck = failsafesConfig['Ping on check'] ?? DEFAULT_FAILSAFE_SETTINGS.pingOnCheck;
        const playSoundOnCheck = failsafesConfig['Play sound on check'] ?? DEFAULT_FAILSAFE_SETTINGS.playSoundOnCheck;

        return {
            isEnabled: isEnabled,
            FailsafeReactionTime: FailsafeReactionTime,
            playerProximityDistance: playerProximityDistance,
            pingOnCheck: pingOnCheck,
            playSoundOnCheck: playSoundOnCheck,
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
