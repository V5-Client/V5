import { V5ConfigFile } from '../utils/Constants.js';

class FailsafeUtils {
    constructor() {
        this.failsafeIntensity = 0;
    }

    getFailsafeSettings(name) {
        if (!V5ConfigFile.exists()) {
            console.log('V5Config not found, this shouldnt happen!'); // having this import from failsafemodule causes it to double load so kinda have to do this i think
            return {
                isEnabled: true,
                FailsafeReactionTime: 600,
                playerProximityDistance: 3,
                pingOnCheck: true,
            };
        }
        const config = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));

        if (!config['Failsafes'])
            return {
                isEnabled: true,
                FailsafeReactionTime: 600,
                playerProximityDistance: 3,
                pingOnCheck: true,
            };

        const FailsafeReactionTime = config['Failsafes']['Failsafe Detection Delay (ms)'] ?? 600;
        const isEnabled = config['Failsafes'][`${name} Failsafe`] ?? true;
        const playerProximityDistance = config['Failsafes']['Player Proximity Distance'] ?? 3;
        const pingOnCheck = config['Failsafes']['Ping on check'] ?? true;

        return {
            isEnabled: isEnabled,
            FailsafeReactionTime: FailsafeReactionTime,
            playerProximityDistance: playerProximityDistance,
            pingOnCheck: pingOnCheck,
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
