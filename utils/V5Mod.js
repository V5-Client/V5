import { Utils } from './Utils';

class V5Mod {
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

V5Mod.handleWelcome();
