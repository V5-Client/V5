import { DiscordRPC } from '../../utils/Constants';
import { Categories } from '../../gui/categories/CategorySystem';
import { MacroState } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';

class RPC extends ModuleBase {
    constructor() {
        super({
            name: 'Discord RPC',
            subcategory: 'Other',
            description: "Show you're playing V5!",
            tooltip: "Shows you're playing V5 in Discord RPC.",
            hideInModules: true,
            showEnabledToggle: false,
        });

        this.lastState = 'IDLE';
        this.lastUpdate = 0;

        Categories.addSettingsToggle('Discord RPC', (v) => this.toggle(!!v), "Shows you're playing V5 in Discord RPC.", true, 'Discord RPC', 'Discord');
        this.toggle(true);

        this.on('step', () => {
            DiscordRPC.stayOn();

            if (Date.now() - this.lastUpdate < 1000) return;
            this.lastUpdate = Date.now();

            if (MacroState.isMacroRunning()) {
                const macroName = MacroState.getActiveMacro() || 'Unknown Macro';

                if (this.lastState !== 'RUNNING') {
                    DiscordRPC.resetTimestamp();
                    this.lastState = 'RUNNING';
                }

                const area = Utils.area() || 'Unknown Area';

                DiscordRPC.updatePresence(`Macroing: ${macroName}`, `Location: ${area}`);
            } else {
                if (this.lastState !== 'IDLE') {
                    DiscordRPC.revertToIdle();
                    this.lastState = 'IDLE';
                }
            }
        }).setDelay(1);

        register('gameUnload', () => {
            try {
                DiscordRPC.turnOff();
            } catch (e) {}
        });
    }

    onDisable() {
        DiscordRPC.turnOff();
    }
}

new RPC();
