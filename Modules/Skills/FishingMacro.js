import { Keybind } from '../../Utility/Keybinding';
import { Chat } from '../../Utility/Chat';
import { Guis } from '../../Utility/Inventory';
import { ModuleBase } from '../../Utility/ModuleBase';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Other',
            description: 'Fishing Macro',
            tooltip: 'Fishing Macro',
        });

        this.boomSlot = 1;
        this.rodSlot = 0;
        this.time = Date.now();
        this.tickCounter = 0;

        this.on('tick', () => {
            this.tickCounter++;
            if (this.tickCounter % 10 !== 0) return;

            if (Date.now() - this.time < 800) return;
            let stand = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity);
            const target = stand.find((element) => element.getName() === '!!!');
            if (!target) return;

            Keybind.rightClick();
            this.time = Date.now();
            Chat.message('Jerking off rod');
            Client.scheduleTask(2, () => {
                Guis.setItemSlot(this.boomSlot);
            });
            Client.scheduleTask(4, () => {
                Keybind.rightClick();
            });
            Client.scheduleTask(6, () => {
                Guis.setItemSlot(this.rodSlot);
            });
            Client.scheduleTask(8, () => {
                Keybind.rightClick();
            });
        });

        this.addSlider('Boom Slot', 0, 8, 1, (v) => (this.boomSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
    }
}

new FishingMacro();
