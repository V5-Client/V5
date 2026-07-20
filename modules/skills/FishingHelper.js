import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

class FishingHelper extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Helper',
            subcategory: 'Skills',
            description: 'Auto reel + recast + pet swap',
            tooltip: 'Auto stuff',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.tickDelay = 0;
        this.step = 0;

        this.petSwapRecast = false;
        this.petSlotRecast = 10;
        this.slugfishMode = false;
        this.slugfishWaitTime = 0;
        this.bobberActiveAt = 0;

        this.pendingPetSlot = null;

        this.on('tick', () => {
            this.tick();
        });

        this.addToggle('Pet swap after recast', (v) => (this.petSwapRecast = v));
        this.addSlider('Pet slot (recast)', 10, 43, 10, (v) => (this.petSlotRecast = v));
        let slugfishWaitTime;
        this.addToggle('Slugfish Mode', (v) => {
            this.slugfishMode = v;
            slugfishWaitTime.visible = v;
        });
        slugfishWaitTime = this.addSlider('Slugfish wait time', 0, 30, 0, (v) => (this.slugfishWaitTime = v));
        slugfishWaitTime.visible = false;
    }
    tick() {
        if (this.tickDelay > 0) {
            this.tickDelay--;
            return;
        }

        switch (this.step) {
            case 0: {
                if (this.slugfishMode && Date.now() - this.bobberActiveAt < this.slugfishWaitTime * 1000) return;

                const armorStands = World.getAllEntitiesOfType(ArmorStandEntity);
                const target = armorStands.find((element) => element.getName() === '!!!');
                if (!target) return;

                Client.rightClick();

                this.step = 20; // recast
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 20:
                Client.rightClick();
                this.bobberActiveAt = Date.now();
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
                this.resetSequence();
                this.step = 0;
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
        this.message('&aEnabled');

        this.resetSequence();
        Client.setKey('shift', false);
    }

    onDisable() {
        this.message('&cDisabled');
        Client.setKey('shift', false);
    }
}

new FishingHelper();
