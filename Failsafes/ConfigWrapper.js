import { Chat } from '../utils/Chat.js';
import { File } from '../utils/Constants.js';

function getFailsafeSettings(name) {
    const modulesDir = new File("./config/ChatTriggers/modules");
    const V5ConfigFile = new File(`${modulesDir}/V5Config/config.json`);
    if (!V5ConfigFile.exists()) { // TODO: make this not be fucking retarded and find another way
        Chat.message("V5Config not found, this shouldnt happen!");
        return; // (importing module causes it to double render therefore i have to do this for now?)
    }

    const config = JSON.parse(FileLib.read(V5ConfigFile.getAbsolutePath()));
    const FailsafeReactionTime = config["Failsafes"]["Failsafe Detection Delay (ms)"]
    const isEnabled = config["Failsafes"][`${name} Failsafe`]
    return {isEnabled: isEnabled, FailsafeReactionTime: FailsafeReactionTime};
}

export default getFailsafeSettings;