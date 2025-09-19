import { Keybind } from '../../Utility/Keybinding';
import { Chat } from '../../Utility/Chat';
import { Guis } from '../../Utility/Inventory';
import { getSetting } from '../../GUI/GuiSave';
const { addCategoryItem, addToggle, addSlider } = global.Categories;

class FishingMacro {
    constructor() {
        this.ModuleName = 'Fishing Macro';
        this.Enabled = false;
        this.boomSlot = 1;
        this.rodSlot = 0;
        this.time = Date.now();

        let tickHandler = register('tick', () => {
            if (!this.Enabled) return tickHandler.unregister();

            if (Date.now() - this.time < 800) return;
            let stand = World.getAllEntitiesOfType(
                net.minecraft.entity.decoration.ArmorStandEntity
            );
            stand.forEach((element, index) => {
                if (element.getName() === '!!!') {
                    Keybind.rightClick();
                    this.time = Date.now();
                    Chat.message('Jerking off rod');
                    Client.scheduleTask(2, () => {
                        Guis.setItemSlot(this.boomSlot);
                    });
                    Client.scheduleTask(4, () => {
                        Keybind.rightClick();
                    });
                    Client.scheduleTask(10, () => {
                        Keybind.rightClick();
                    });
                    Client.scheduleTask(16, () => {
                        Keybind.rightClick();
                    });
                    Client.scheduleTask(18, () => {
                        Guis.setItemSlot(this.rodSlot);
                    });
                    Client.scheduleTask(20, () => {
                        Keybind.rightClick();
                    });
                }
            });
        }).unregister();

        this.toggle = (value) => {
            this.Enabled = value;
            if (this.Enabled) {
                tickHandler.register();
            } else {
                tickHandler.unregister();
            }
        };

        addCategoryItem(
            'Skills',
            'Fishing Macro',
            'Fishing Macro',
            'Fishing Macro'
        );
        addCategoryItem('Beans', 'Bean Macro', 'Bean Macro', 'Bean Macro');

        addToggle('Modules', 'Fishing Macro', 'Enabled', (value) => {
            this.toggle(value);
        });

        addSlider('Modules', 'Fishing Macro', 'Boom Slot', 0, 8, 1, (value) => {
            this.boomSlot = value;
        });

        addSlider('Modules', 'Fishing Macro', 'Rod Slot', 0, 8, 0, (value) => {
            this.rodSlot = value;
        });

        Client.scheduleTask(1, () => {
            this.toggle(getSetting('Fishing Macro', 'Enabled'));
        });
    }
}
new FishingMacro();
