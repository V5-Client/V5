import { V5ConfigFile } from '../utils/Constants.js';

class FailsafeUtils {
    failsafeIntensity = 0;

    getFailsafeSettings(name) {
        if (!V5ConfigFile.exists()) {
            console.log('V5Config not found, this shouldnt happen!'); // having this import from failsafemodule causes it to double load so kinda have to do this i think
            return {
                isEnabled: true,
                FailsafeReactionTime: 600,
                playerProximityDistance: 3,
                pingOnCheck: true,
                playSoundOnCheck: true,
            };
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

        if (!config['Failsafes'])
            return {
                isEnabled: true,
                FailsafeReactionTime: 600,
                playerProximityDistance: 3,
                pingOnCheck: true,
                playSoundOnCheck: true,
            };

        const FailsafeReactionTimeInput = config['Failsafes']['Failsafe Detection Delay (ms)'] ?? 600;
        let FailsafeReactionTime = FailsafeReactionTimeInput;

        if (typeof FailsafeReactionTimeInput === 'object' && FailsafeReactionTimeInput.low !== undefined && FailsafeReactionTimeInput.high !== undefined) {
            FailsafeReactionTime = Math.floor(
                Math.random() * (FailsafeReactionTimeInput.high - FailsafeReactionTimeInput.low + 1) + FailsafeReactionTimeInput.low
            );
        }

        const enabledList = config['Failsafes']['Enabled Failsafes'];
        const isEnabled = Array.isArray(enabledList)
            ? enabledList.some((entry) => entry.name === name && entry.enabled)
            : (config['Failsafes'][`${name} Failsafe`] ?? true);
        const playerProximityDistance = config['Failsafes']['Player Proximity Distance'] ?? 3;
        const pingOnCheck = config['Failsafes']['Ping on check'] ?? true;
        const playSoundOnCheck = config['Failsafes']['Play sound on check'] ?? true;

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
