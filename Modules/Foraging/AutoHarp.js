import { Guis } from '../../utils/player/Inventory';
import { ModuleBase } from '../../utils/ModuleBase';

class AutoHarp extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Harp',
            subcategory: 'Foraging',
            description: 'Auto Harp',
            tooltip: 'Auto Harp',
        });
        this.delay = 3;

        class Note {
            constructor(slot) {
                this.slot = slot;
                this.clicked = false;
                this.delay = 0;
            }
        }

        const notes = [37, 38, 39, 40, 41, 42, 43].map((slot) => new Note(slot));

        this.on('tick', () => {
            const invName = Guis.guiName();
            if (!invName?.includes('Harp')) return;

            const container = Player.getContainer();
            if (!container) return;

            notes.forEach((note) => {
                if (note.delay > 0) note.delay--;

                const item = container.getStackInSlot(note.slot)?.type?.getRegistryName();

                if (!item || item.includes('terracotta')) {
                    note.clicked = false;
                    note.delay = 0;
                }

                if (item?.includes('quartz')) {
                    if (note.clicked || note.delay !== 0) return;

                    const belowItem = container.getStackInSlot(note.slot - 9)?.type?.getRegistryName();
                    if (belowItem?.includes('wool')) {
                        note.delay = this.delay;
                    } else {
                        note.clicked = true;
                    }

                    Guis.clickSlot(note.slot, false, 'MIDDLE');
                }
            });
        });

        this.addSlider('Delay', 0, 10, 3, (v) => (this.delay = v));
    }
}
new AutoHarp();
