import { Keybind } from '../../utils/player/Keybinding';
import { Guis } from '../../utils/player/Inventory';
import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';
import { ArmorStandEntity } from '../../utils/Constants';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Skills',
            description: 'Fishing Macro for stridersurfer',
            tooltip: 'Fishing Macro for stridersurfer',
        });

        this.tickDelay = 0;
        this.step = 0;

        this.flaySlot = 0;
        this.axeSlot = 0;
        this.rodSlot = 0;
        this.totemSlot = 0;

        this.autoTotem = false;

        this.petSwapKill = false;
        this.petSlotKill = 10;

        this.petSwapRecast = false;
        this.petSlotRecast = 10;

        this.pendingPetSlot = null;

        this.on('tick', () => {
            this.tick();
        });

        this.addSlider('Flay Slot', 0, 8, 1, (v) => (this.flaySlot = v));
        this.addSlider('Axe Slot', 0, 8, 1, (v) => (this.axeSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
        this.addToggle('Auto totem of corruption', (v) => (this.autoTotem = v));
        this.addSlider('Totem Slot', 0, 8, 0, (v) => (this.totemSlot = v));
        this.addToggle('Pet swap after kill', (v) => (this.petSwapKill = v));
        this.addToggle('Pet swap after recast', (v) => (this.petSwapRecast = v));
        this.addSlider('Pet slot (kill)', 10, 43, 10, (v) => (this.petSlotKill = v));
        this.addSlider('Pet slot (recast)', 10, 43, 10, (v) => (this.petSlotRecast = v));
    }
    tick() {
        if (this.tickDelay > 0) {
            this.tickDelay--;
            return;
        }

        switch (this.step) {
            case 0: {
                const armorStands = World.getAllEntitiesOfType(ArmorStandEntity);
                const target = armorStands.find((element) => element.getName() === '!!!');
                if (!target) return;

                Keybind.rightClick();

                const striderCount = armorStands.reduce((acc, entity) => (entity.getName().includes('Stridersurfer') ? acc + 1 : acc), 0);
                if (striderCount > 27) {
                    Keybind.setKey('shift', true);
                    this.step = 1; // kill
                } else {
                    this.step = 20; // recast
                }
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 1: {
                if (this.autoTotem) {
                    const totemExists = World.getAllEntitiesOfType(ArmorStandEntity).find((element) => element.getName() === 'Totem of Corruption');
                    if (totemExists) return;

                    Guis.setItemSlot(this.totemSlot);
                    Rotations.rotateToAngles(95, 54);
                    Rotations.onEndRotation(() => {
                        Keybind.rightClick();
                        Client.scheduleTask(2, () => {
                            Rotations.rotateToAngles(23, 8);
                        });
                    });
                    this.tickDelay = 19 + this.randomTickDelay();
                } else {
                    this.tickDelay = this.randomTickDelay();
                }
                this.step = 2;
                break;
            }
            case 2:
                Guis.setItemSlot(this.flaySlot);
                this.tickDelay = this.randomTickDelay();
                if (this.petSwapKill) {
                    this.pendingPetSlot = this.petSlotKill;
                    this.step = 30;
                } else {
                    this.step = 4;
                }
                break;
            case 3:
                // i cba changing all of them to fix this gap
                break;
            case 4:
                Keybind.rightClick();
                this.step = 5;
                this.tickDelay = 0;
                break;
            case 5:
                Guis.setItemSlot(this.axeSlot);
                this.step = 6;
                this.tickDelay = 5 + this.randomTickDelay();
                break;
            case 6:
                Guis.setItemSlot(this.flaySlot);
                this.step = 7;
                this.tickDelay = this.randomTickDelay();
                break;
            case 7:
                Keybind.rightClick();
                this.step = 8;
                this.tickDelay = 0;
                break;
            case 8:
                Guis.setItemSlot(this.axeSlot);
                Keybind.setKey('shift', false);
                this.step = 9;
                this.tickDelay = 4 + this.randomTickDelay();
                break;
            case 9:
                Guis.setItemSlot(this.rodSlot);
                this.step = 20;
                this.tickDelay = 1 + this.randomTickDelay();
                break;
            case 20:
                Keybind.rightClick();
                if (this.petSwapRecast) {
                    this.pendingPetSlot = this.petSlotRecast;
                    this.step = 30;
                    this.tickDelay = 1 + this.randomTickDelay();
                } else {
                    this.resetSequence();
                }
                break;
            case 30:
                ChatLib.command('pets');
                this.step = 31;
                this.tickDelay = 5 + this.randomTickDelay();
                break;
            case 31:
                Guis.clickSlot(this.pendingPetSlot);
                if (this.pendingPetSlot === this.petSlotKill) this.step = 4;
                else this.resetSequence();
                break;
        }
    }

    resetSequence() {
        this.step = 0;
        this.tickDelay = this.randomTickDelay();
        this.pendingTotem = false;
        this.pendingPetSlot = null;
    }

    randomTickDelay() {
        return 1 + Math.round(Math.random() * 3);
    }

    onEnable() {
        global.macrostate.setMacroRunning(true, 'FISHING');
        this.resetSequence();
        Keybind.setKey('shift', false);
    }

    onDisable() {
        global.macrostate.setMacroRunning(false, 'FISHING');
        Keybind.setKey('shift', false);
    }
}

new FishingMacro();
