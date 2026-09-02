import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { ScheduleTask } from '../../utils/ScheduleTask';

const LOADOUT_SLOTS = [14, 15, 16, 23, 24, 25, 32, 33, 34, 41, 42, 43];

class LoadoutHandler extends ModuleBase {
    constructor() {
        super({
            name: 'Loadout Settings',
            subcategory: 'Farming',
            description: 'Loadouts used while farming.',
            showEnabledToggle: false,
        });

        this.farmingSlot = 1;
        this.pestSpawningSlot = 1;
        this.pestKillingSlot = 1;
        this.visitorSlot = 1;
        this.postSwapDelay = 4;
        this.pestSpawnSwapCooldown = 140;
        this.currentSlot = null;
        this.targetSlot = null;
        this.switching = false;

        this.addSlider('Farming Loadout Slot', 1, 12, this.farmingSlot, (value) => (this.farmingSlot = Math.round(value)));
        this.addSlider('Pest Spawning Loadout Slot', 1, 12, this.pestSpawningSlot, (value) => (this.pestSpawningSlot = Math.round(value)));
        this.addSlider('Pest Killing Loadout Slot', 1, 12, this.pestKillingSlot, (value) => (this.pestKillingSlot = Math.round(value)));
        this.addSlider('Visitor Loadout Slot', 1, 12, this.visitorSlot, (value) => (this.visitorSlot = Math.round(value)));
        this.addSlider(
            'Pest Spawn Swap Cooldown',
            0,
            300,
            this.pestSpawnSwapCooldown,
            (value) => (this.pestSpawnSwapCooldown = Math.round(value)),
            'Switches to the pest spawning loadout at or below this cooldown in seconds.'
        );
        this.addSlider('Post Swap Delay', 1, 20, this.postSwapDelay, (value) => (this.postSwapDelay = Math.round(value)));

        register('tick', () => this.tick());
    }

    select(slot) {
        if ([this.farmingSlot, this.pestSpawningSlot, this.pestKillingSlot, this.visitorSlot].every((loadoutSlot) => loadoutSlot === 1)) return true;
        if (this.switching) return false;
        if (slot === this.currentSlot && this.targetSlot === null) return true;
        if (this.targetSlot !== slot) {
            this.targetSlot = slot;
            if (!Guis.guiName()?.includes('(1/3) Loadouts')) ChatLib.command('loadouts');
        }
        return false;
    }

    tick() {
        if (this.targetSlot === null || !Guis.guiName()?.includes('(1/3) Loadouts')) return;
        if (!Guis.clickSlot(LOADOUT_SLOTS[this.targetSlot - 1])) return;
        this.currentSlot = this.targetSlot;
        this.targetSlot = null;
        this.switching = true;
        ScheduleTask(5, () => {
            if (Guis.guiName()?.includes('(1/3) Loadouts')) Guis.closeInv();
            ScheduleTask(this.postSwapDelay, () => (this.switching = false));
        });
    }
}

export const loadoutHandler = new LoadoutHandler();
