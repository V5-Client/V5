import { Guis } from '../../Utility/Inventory';
import { Chat } from '../../Utility/Chat';
import { getSetting } from '../../GUI/GuiSave';
const { addCategoryItem, addToggle, addSlider } = global.Categories;

class AutoHarp {
    constructor() {
        this.ModuleName = 'Auto Harp';
        this.delay = 3;
        this.Enabled = false;

        class Note {
            constructor(slot) {
                this.slot = slot;
                this.clicked = false;
                this.delay = 0;
            }
        }

        const notes = [37, 38, 39, 40, 41, 42, 43].map(
            (slot) => new Note(slot)
        );

        let tickHandler = register('tick', () => {
            if (!this.Enabled) return tickHandler.unregister();

            const invName = Guis.guiName();
            if (!invName?.includes('Harp')) return;

            const container = Player.getContainer();
            if (!container) return;

            notes.forEach((note) => {
                if (note.delay > 0) note.delay--;

                const item = container
                    .getStackInSlot(note.slot)
                    ?.type?.getRegistryName();

                if (!item || item.includes('terracotta')) {
                    note.clicked = false;
                    note.delay = 0;
                }

                if (item?.includes('quartz')) {
                    if (note.clicked || note.delay !== 0) return;

                    const belowItem = container
                        .getStackInSlot(note.slot - 9)
                        ?.type?.getRegistryName();
                    if (belowItem?.includes('wool')) {
                        note.delay = this.delay;
                    } else {
                        note.clicked = true;
                    }

                    Guis.clickSlot(note.slot, false, 'MIDDLE');
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

        addCategoryItem('Other', 'Auto Harp', 'Auto Harp', 'Auto Harp');

        addToggle('Modules', 'Auto Harp', 'Enabled', (value) => {
            this.toggle(value);
        });

        addSlider('Modules', 'Auto Harp', 'Delay', 0, 10, 3, (value) => {
            this.delay = value;
        });

        Client.scheduleTask(1, () => {
            this.toggle(getSetting('Auto Harp', 'Enabled'));
        });
    }
}
new AutoHarp();
