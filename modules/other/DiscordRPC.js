import { Categories } from '../../gui/categories/CategorySystem';
import { getActiveMacro, isMacroRunning } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { area } from '../../utils/Utils';

class RPC extends ModuleBase {
    constructor() {
        super({
            name: 'modules.discord_rpc.name',
            subcategory: 'Other',
            description: 'modules.discord_rpc.description',
            tooltip: 'modules.discord_rpc.tooltip',
            hideInModules: true,
        });

        this.lastState = 'IDLE';
        this.lastUpdate = 0;

        Categories.addSettingsToggle('labels.discord_rpc', (v) => this.toggle(!!v), 'descriptions.discord_rpc_setting', true, 'Discord RPC', 'Discord');
        this.toggle(true);

        this.on('step', () => {
            DiscordRPC.stayOn();

            if (Date.now() - this.lastUpdate < 1000) return;
            this.lastUpdate = Date.now();

            if (isMacroRunning()) {
                const macroName = getActiveMacro() || 'Unknown Macro';

                if (this.lastState !== 'RUNNING') {
                    DiscordRPC.resetTimestamp();
                    this.lastState = 'RUNNING';
                }

                const areaName = area() || 'Unknown Area';

                DiscordRPC.updatePresence(`Macroing: ${macroName}`, `Location: ${areaName}`);
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
