import { File } from '../utils/Constants.js';

/**
 * Configuration manager for failsafe settings.
 * Provides a clean interface to access failsafe configuration without directly parsing JSON.
 */
class FailsafeConfig {
    constructor() {
        this.configCache = null;
        this.cacheTime = 0;
        this.cacheDuration = 1000; // Cache config for 1 second to avoid excessive file reads
    }

    /**
     * Gets the parsed configuration object, using cache if available
     * @private
     */
    _getConfig() {
        const now = Date.now();
        if (this.configCache && (now - this.cacheTime) < this.cacheDuration) {
            return this.configCache;
        }

        const modulesDir = new File("./config/ChatTriggers/modules");
        const V5ConfigFile = new File(`${modulesDir}/V5Config/config.json`);
        
        if (!V5ConfigFile.exists()) {
            console.log("V5Config not found, this shouldn't happen!");
            return null;
        }

        this.configCache = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));
        this.cacheTime = now;
        return this.configCache;
    }

    /**
     * Gets failsafe settings for a specific failsafe
     * @param {string} name - The name of the failsafe (e.g., "Chat Mention", "Rotation")
     * @returns {Object} Settings object with isEnabled, FailsafeReactionTime, and playerProximityDistance
     */
    getFailsafeSettings(name) {
        const config = this._getConfig();
        if (!config) {
            return {
                isEnabled: false,
                FailsafeReactionTime: 600,
                playerProximityDistance: 10
            };
        }

        const failsafesConfig = config["Failsafes"] || {};
        return {
            isEnabled: failsafesConfig[`${name} Failsafe`] ?? false,
            FailsafeReactionTime: failsafesConfig["Failsafe Detection Delay (ms)"] ?? 600,
            playerProximityDistance: failsafesConfig["Player Proximity Distance"] ?? 10
        };
    }

    /**
     * Clears the configuration cache, forcing a reload on next access
     */
    clearCache() {
        this.configCache = null;
        this.cacheTime = 0;
    }
}

// Export singleton instance
export default new FailsafeConfig();
