import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

class AutoHarp extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Harp',
            subcategory: 'Foraging',
            description: 'Auto Harp',
            tooltip: 'Auto Harp',
        });

        this.DELAY = 3;

        class Note {
            constructor(slot) {
                this.slot = slot;
                this.clicked = false;
                this.DELAY = 0;
            }
        }

        const notes = [37, 38, 39, 40, 41, 42, 43].map((slot) => new Note(slot));

        this.on('tick', () => {
            const invName = Guis.guiName();
            if (!invName?.includes('Harp')) return;

            const container = Player.getContainer();
            if (!container) return;

            notes.forEach((note) => {
                if (note.DELAY > 0) note.DELAY--;

                const item = container.getStackInSlot(note.slot)?.type?.getRegistryName();

                if (!item || item.includes('terracotta')) {
                    note.clicked = false;
                    note.DELAY = 0;
                }

                if (item?.includes('quartz')) {
                    if (note.clicked || note.DELAY !== 0) return;

                    const belowItem = container.getStackInSlot(note.slot - 9)?.type?.getRegistryName();
                    if (belowItem?.includes('wool')) {
                        note.DELAY = this.DELAY;
                    } else {
                        note.clicked = true;
                    }

                    Guis.clickSlot(note.slot, false, 'MIDDLE');
                }
            });
        });

        this.addSlider('Delay', 0, 10, 3, (v) => (this.DELAY = v));
    }
}
new AutoHarp();
