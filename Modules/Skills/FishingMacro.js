import { Keybind } from '../../utils/player/Keybinding';
import { Chat } from '../../utils/Chat';
import { Guis } from '../../utils/player/Inventory';
import { ModuleBase } from '../../utils/ModuleBase';
import MacroState from '../../utils/MacroState';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Skills',
            description: 'Fishing Macro',
            tooltip: 'Fishing Macro',
        });

        this.boomSlot = 1;
        this.rodSlot = 0;
        this.time = Date.now();
        this.tickCounter = 0;
        this.striderCounter = 0;

        this.on('tick', () => {
            this.tickCounter++;
            if (this.tickCounter % 6 !== 0) return;

            if (Date.now() - this.time < 500) return;
            let stand = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity);
            const target = stand.find((element) => element.getName() === '!!!');
            if (!target) return;

            if (this.striderCounter > 20) {
                this.striderCounter = 0;
                Keybind.rightClick();
                this.time = Date.now();
                //Chat.message('Jerking off rod');
                Client.scheduleTask(4, () => {
                    Guis.setItemSlot(this.boomSlot);
                });
                let delay = 8;
                for (let i = 0; i < 23; i++) {
                    Client.scheduleTask(delay, () => {
                        Keybind.leftClick();
                    });
                    delay = delay + Math.floor(Math.random() * 5) + 6;
                }
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.rodSlot);
                });
                Client.scheduleTask(delay + 4, () => {
                    Keybind.rightClick();
                });
            } else {
                Keybind.rightClick();
                this.time = Date.now();
                //Chat.message('Jerking off rod');
                Client.scheduleTask(4, () => {
                    Keybind.rightClick();
                });
            }
        });

        this.on('chat', (event) => {
            let msg = event.message.getString();
            if (msg.includes('You caught a Stridersurfer')) {
                //Chat.message('jew');
                this.striderCounter++;
            }
        });

        this.addSlider('Boom Slot', 0, 8, 1, (v) => (this.boomSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
    }

    onEnable() {
        MacroState.setMacroRunning(true);
    }

    onDisable() {
        MacroState.setMacroRunning(false);
    }
}

new FishingMacro();
