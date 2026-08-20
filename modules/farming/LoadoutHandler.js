import { ModuleBase } from '../../utils/ModuleBase';
import { clickSlot, closeInventory, getGuiName } from '../../utils/player/Inventory';
import { ScheduleTask } from '../../utils/ScheduleTask';

const LOADOUT_SLOTS = [14, 15, 16, 23, 24, 25, 32, 33, 34, 41, 42, 43];

class LoadoutHandler extends ModuleBase {
    constructor() {
        super({
            name: 'modules.loadout_settings.name',
            subcategory: 'Farming',
            description: 'modules.loadout_settings.description',
            showEnabledToggle: false,
        });

        this.farmingSlot = 1;
        this.pestSpawningSlot = 1;
        this.pestKillingSlot = 1;
        this.visitorSlot = 1;
        this.pestSpawnSwapCooldown = 140;
        this.currentSlot = null;
        this.targetSlot = null;
        this.switching = false;

        this.addSlider('labels.farming_loadout_slot', 1, 12, this.farmingSlot, (value) => (this.farmingSlot = Math.round(value)));
        this.addSlider('labels.pest_spawning_loadout_slot', 1, 12, this.pestSpawningSlot, (value) => (this.pestSpawningSlot = Math.round(value)));
        this.addSlider('labels.pest_killing_loadout_slot', 1, 12, this.pestKillingSlot, (value) => (this.pestKillingSlot = Math.round(value)));
        this.addSlider('labels.visitor_loadout_slot', 1, 12, this.visitorSlot, (value) => (this.visitorSlot = Math.round(value)));
        this.addSlider(
            'labels.pest_spawn_swap_cooldown',
            0,
            300,
            this.pestSpawnSwapCooldown,
            (value) => (this.pestSpawnSwapCooldown = Math.round(value)),
            'descriptions.pest_spawn_swap_cooldown'
        );

        register('tick', () => this.tick());
    }

    select(slot) {
        if ([this.farmingSlot, this.pestSpawningSlot, this.pestKillingSlot, this.visitorSlot].every((loadoutSlot) => loadoutSlot === 1)) return true;
        if (this.switching) return false;
        if (slot === this.currentSlot && this.targetSlot === null) return true;
        if (this.targetSlot !== slot) {
            this.targetSlot = slot;
            if (!getGuiName()?.includes('(1/3) Loadouts')) ChatLib.command('loadouts');
        }
        return false;
    }

    tick() {
        if (this.targetSlot === null || !getGuiName()?.includes('(1/3) Loadouts')) return;
        if (!clickSlot(LOADOUT_SLOTS[this.targetSlot - 1])) return;
        this.currentSlot = this.targetSlot;
        this.targetSlot = null;
        this.switching = true;
        ScheduleTask(5, () => {
            if (getGuiName()?.includes('(1/3) Loadouts')) closeInventory();
            ScheduleTask(4, () => (this.switching = false));
        });
    }
}

export const loadoutHandler = new LoadoutHandler();
