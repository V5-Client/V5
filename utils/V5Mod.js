import { Chat } from './Chat';
import { Utils } from './Utils';

const Fabric = net.fabricmc.loader.api.FabricLoader;

class V5Mod {
    static check() {
        if (!Fabric.getInstance().isModLoaded('v5')) {
            Chat.message('&cV5 Mod is not installed!');
            // close minecraft, reload minecraft and install the mod
            // unload ct for now
            if (typeof UnloadCT !== 'undefined') UnloadCT(true);
        } else {
            this.handleWelcome();
        }
    }

    static handleWelcome() {
        const META_FILE = 'v5_metadata.json';
        const config = Utils.getConfigFile(META_FILE);

        if (!config || !config.welcomeShown) {
            try {
                const WelcomeScreen = Java.type('com.v5.screen.WelcomeScreen');

                WelcomeScreen.open();
                Utils.writeConfigFile(META_FILE, { welcomeShown: true });
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }
    }
}

V5Mod.check();
