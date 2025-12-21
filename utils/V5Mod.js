import { Chat } from './Chat';

const Fabric = net.fabricmc.loader.api.FabricLoader;

class V5Mod {
    static check() {
        if (!Fabric.getInstance().isModLoaded('v5')) {
            Chat.message('&cV5 Mod is not installed!');
            // close minecraft, reload minecraft and install the mod
            // unload ct for now
            UnloadCT(true);
        } /*else {
            Chat.message('&aV5 Mod is installed!');
        }*/
    }
}

V5Mod.check();
