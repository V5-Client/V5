import { Chat } from '../../utils/Chat';
import { ArmorStandEntity } from '../../utils/Constants';
import { MacroState } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';

class FishingHelper extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Helper',
            subcategory: 'Skills',
            description: 'Auto reel + recast + pet swap',
            tooltip: 'Auto stuff',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.tickDelay = 0;
        this.step = 0;

        this.petSwapRecast = false;
        this.petSlotRecast = 10;

        this.pendingPetSlot = null;

        this.on('tick', () => {
            this.tick();
        });

        this.addToggle('Pet swap after recast', (v) => (this.petSwapRecast = v));
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

                this.step = 20; // recast
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 20:
                Keybind.rightClick();
                if (this.petSwapRecast) {
                    this.pendingPetSlot = this.petSlotRecast;
                    this.step = 30;
                    this.tickDelay = 1 + this.randomTickDelay();
                } else {
                    this.resetSequence();
                    this.step = 0;
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
                else {
                    this.resetSequence();
                    this.step = 0;
                }
                break;
        }
    }

    resetSequence() {
        this.step = 20;
        this.tickDelay = this.randomTickDelay();
    }

    randomTickDelay() {
        return 1 + Math.round(Math.random() * 3);
    }

    onEnable() {
        MacroState.setMacroRunning(true, 'FISHING');
        Chat.message('Fishing Helper Enabled');

        this.resetSequence();
        Keybind.setKey('shift', false);
    }

    onDisable() {
        MacroState.setMacroRunning(false, 'FISHING');
        Chat.message('Fishing Helper disabled');
        Keybind.setKey('shift', false);
    }
}

new FishingHelper();
