import { Chat } from '../utils/Chat.js';
import { Failsafe } from './Failsafe';

class FailsafeManager {
    constructor() {
        this.failsafes = [];
        this.autoRegister();
    }

    registerFailsafe(failsafe) {
        this.failsafes.push(failsafe);
    }

    autoRegister() {
        const File = Java.type("java.io.File");
        const fsDir = new File("./config/ChatTriggers/modules/V5/Failsafes");
        const files = fsDir.listFiles();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.isDirectory() && file.getName().endsWith("Failsafe.js") && file.getName() !== "Failsafe.js") {
                const name = file.getName();

                const path = "V5/Failsafes/" + name;

                try {
                    const a = require(path);
                    this.registerFailsafe(a);
                } catch (e) {
                    Chat.message("failed to load failsafe: " + name);
                    Chat.message(String(e));
                }
            }
        }
    }
}

export default new FailsafeManager();