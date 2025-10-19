const DiscordRPC = Java.type('com.chattriggers.v5.qol.DiscordRPC');
import { ModuleBase } from '../../Utility/ModuleBase';

class RPC extends ModuleBase {
    constructor() {
        super({
            name: 'Discord RPC',
            subcategory: 'Other',
            description: "Show you're playing V5!",
            tooltip: "Shows you're playing V5 in Discord RPC.",
        });

        this.on('step', () => {
            DiscordRPC.stayOn();
        }).setDelay(1);
    }

    onDisable() {
        DiscordRPC.turnOff();
    }
}

new RPC();
