const DiscordRPC = Java.type('com.chattriggers.v5.qol.DiscordRPC');
const { addCategoryItem, addToggle } = global.Categories;

class RPC {
    constructor() {
        this.enabled = false;

        register('step', () => {
            this.enabled ? DiscordRPC.stayOn() : DiscordRPC.turnOff();
        }).setDelay(1);

        addCategoryItem(
            'Other',
            'Discord RPC',
            "Show you're playing V5!",
            'This is a description for Discord RPC.'
        );
        addToggle(
            'Modules',
            'Discord RPC',
            'Enabled',
            (value) => {
                this.enabled = value;
            },
            'This is a description for Enabled.'
        );
    }
}

new RPC();
