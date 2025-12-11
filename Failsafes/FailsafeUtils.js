import { File } from '../utils/Constants.js';

let failsafeIntensity = 0;

function getFailsafeSettings(name) {
    const modulesDir = new File("./config/ChatTriggers/modules");
    const V5ConfigFile = new File(`${modulesDir}/V5Config/config.json`);
    if (!V5ConfigFile.exists()) { // TODO: make this not be fucking retarded and find another way
        console.log("V5Config not found, this shouldnt happen!");
        return; // (importing module causes it to double render therefore i have to do this for now?)
    }

    const config = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));
    const FailsafeReactionTime = config["Failsafes"]["Failsafe Detection Delay (ms)"]
    const isEnabled = config["Failsafes"][`${name} Failsafe`]
    return {isEnabled: isEnabled, FailsafeReactionTime: FailsafeReactionTime};
}

function incrementFailsafeIntensity(amt) {
    failsafeIntensity += amt;
    setTimeout(() => failsafeIntensity -= (amt / 10), 1000);
}

function getIntensity() {
    return failsafeIntensity;
}

export { getFailsafeSettings, incrementFailsafeIntensity, getIntensity };