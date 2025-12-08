import { Chat } from '../utils/Chat.js';
import { Failsafe } from './Failsafe';
import { File } from '../utils/Constants'

class FailsafeManager {
    constructor() {
        this.failsafes = [];
        this.modulesDir = new File("./config/ChatTriggers/modules");
        this._autoRegister();
    }

    _registerFailsafe(failsafe) {
        this.failsafes.push(failsafe);
    }

    _autoRegister() {
        const moduleFolders = this.modulesDir.listFiles().filter(f => f.isDirectory());
        let moduleName = null;

        for (const folder of moduleFolders) {
            const failsafesDir = new File(folder, "Failsafes");
            if (failsafesDir.exists() && failsafesDir.isDirectory()) {
                moduleName = folder.getName();
                break;
            }
        }

        if (!moduleName) {
            Chat.message("somehow modulename not found, this shouldnt happen!");
            return;
        }

        const fsDir = new File(`./config/ChatTriggers/modules/${moduleName}/Failsafes/impl`);
        const files = fsDir.listFiles();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.isDirectory() && file.getName().endsWith("Failsafe.js") && file.getName() !== "Failsafe.js") {
                const name = file.getName();

                const path = `${moduleName}/Failsafes/impl/${name}`;

                try {
                    const a = require(path)
                    this._registerFailsafe(a);
                } catch (e) {
                    Chat.message("Failed to load failsafe: " + name);
                    Chat.message(String(e));
                }
            }
        }
    }

    getFailsafes() {
        if (!this.failsafes.length) {
            this._autoRegister();
        }
        return this.failsafes;
    }
}

export default new FailsafeManager();