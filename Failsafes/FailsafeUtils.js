import { File } from '../utils/Constants.js';

let failsafeIntensity = 0;

function getFailsafeSettings(name) {
    const modulesDir = new File("./config/ChatTriggers/modules");
    const V5ConfigFile = new File(`${modulesDir}/V5Config/config.json`);
    if (!V5ConfigFile.exists()) {
        console.log("V5Config not found, this shouldnt happen!");
        return;
    }

    const config = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));
    const FailsafeReactionTime = config["Failsafes"]["Failsafe Detection Delay (ms)"]
    const isEnabled = config["Failsafes"][`${name} Failsafe`]
    const playerProximityDistance = config["Failsafes"]["Player Proximity Distance"]
    return {isEnabled: isEnabled, FailsafeReactionTime: FailsafeReactionTime, playerProximityDistance: playerProximityDistance};
}

function incrementFailsafeIntensity(amt) {
    failsafeIntensity += amt;
    setTimeout(() => failsafeIntensity -= (amt / 10), 1000);
}

function getIntensity() {
    return failsafeIntensity;
}

export { getFailsafeSettings, incrementFailsafeIntensity, getIntensity };