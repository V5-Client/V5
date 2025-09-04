import { getSetting } from '../../GUI/GuiSave';

const DiscordRPC = Java.type('com.chattriggers.v5.qol.DiscordRPC');

const { addCategoryItem, addToggle } = global.Categories;

addCategoryItem('Other', 'Discord RPC', "Show you're playing V5!");
addToggle('Modules', 'Discord RPC', 'Enabled');

class RPC {
    constructor() {
        register('step', () => {
            getSetting('Discord RPC', 'Enabled')
                ? DiscordRPC.stayOn()
                : DiscordRPC.turnOff();
        }).setDelay(1);
    }
}

new RPC();
