import { Keybind } from '../../utils/player/Keybinding';
import { Chat } from '../../utils/Chat';
import { Guis } from '../../utils/player/Inventory';
import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Skills',
            description: 'Fishing Macro for stridersurfer',
            tooltip: 'Fishing Macro for stridersurfer',
        });

        this.flaySlot = 3;
        this.axeSlot = 1;
        this.rodSlot = 0;
        this.autoTotem = false;
        this.totemSlot = 0;
        this.time = Date.now();

        this.on('tick', () => {
            if (Date.now() - this.time < 500) return;
            let stand = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity);
            const target = stand.find((element) => element.getName() === '!!!');
            if (!target) return;
            Keybind.rightClick();
            this.time = Date.now();

            let count = 0;
            World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity).forEach((entity) => {
                if (entity.getName().includes('Stridersurfer')) count++;
            });

            if (count > 28) {
                Keybind.setKey('shift', true);
                let delay = 2;
                if (this.autoTotem) {
                    let totem = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity);
                    if (!totem.find((element) => element.getName() === 'Totem of Corruption')) {
                        Client.scheduleTask(delay, () => {
                            Guis.setItemSlot(this.totemSlot);
                            Rotations.rotateToAngles(95, 54);
                            Rotations.onEndRotation(() => {
                                Keybind.rightClick();
                                Client.scheduleTask(1, () => {
                                    Rotations.rotateToAngles(23, 8);
                                });
                            });
                        });
                        delay += 20;
                    }
                }
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.flaySlot);
                });
                delay += 1;
                Client.scheduleTask(delay, () => {
                    Keybind.rightClick();
                });
                delay += 1;
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.axeSlot);
                });
                delay += 10;
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.flaySlot);
                    this.time = Date.now();
                });
                delay += 1;
                Client.scheduleTask(delay, () => {
                    Keybind.rightClick();
                });
                delay += 1;
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.axeSlot);
                    Keybind.setKey('shift', false);
                });
                delay += 4;
                Client.scheduleTask(delay, () => {
                    Guis.setItemSlot(this.rodSlot);
                });
                delay += 4;
                Client.scheduleTask(delay, () => {
                    Keybind.rightClick();
                });
            } else {
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

        this.addSlider('Flay Slot', 0, 8, 1, (v) => (this.flaySlot = v));
        this.addSlider('Axe Slot', 0, 8, 1, (v) => (this.axeSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
        this.addToggle('Auto totem of corruption', (v) => (this.autoTotem = v));
        this.addSlider('Totem Slot', 0, 8, 0, (v) => (this.totemSlot = v));
    }
    onEnable() {
        global.macrostate.setMacroRunning(true, 'FISHING');
    }

    onDisable() {
        global.macrostate.setMacroRunning(false, 'FISHING');
    }
}

new FishingMacro();
