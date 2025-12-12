import { V5ConfigFile } from '../utils/Constants.js';

class FailsafeUtils {
    constructor() {
        this.failsafeIntensity = 0;
    }

    getFailsafeSettings(name) {
        if (!V5ConfigFile.exists()) {
            console.log('V5Config not found, this shouldnt happen!'); // having this import from failsafemodule causes it to double load so kinda have to do this i think
            return;
        }
        const config = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));
        const FailsafeReactionTime = config['Failsafes']['Failsafe Detection Delay (ms)'];
        const isEnabled = config['Failsafes'][`${name} Failsafe`];
        const playerProximityDistance = config['Failsafes']['Player Proximity Distance'];
        const pingOnCheck = config['Failsafes']['Ping on check'];
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
