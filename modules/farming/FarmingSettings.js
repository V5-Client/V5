import { ModuleBase } from '../../utils/ModuleBase';
import { findItemInHotbar, setItemSlot, stripItemFormatting } from '../../utils/player/Inventory';

class FarmingSettings extends ModuleBase {
    constructor() {
        super({
            name: 'modules.farming_settings.name',
            subcategory: 'Farming',
            description: 'modules.farming_settings.description',
            showEnabledToggle: false,
        });

        this.useMousemat = false;
        this.useSprayonator = false;
        this.killNearbyPests = false;
        this.originalSlot = -1;

        this.addToggle('labels.use_mousemat', (value) => (this.useMousemat = !!value), 'descriptions.use_mousemat');
        this.addToggle(
            'labels.sprayonator_while_farming',
            (value) => (this.useSprayonator = !!value),
            'Uses a Sprayonator while farming. \nMust have material already selected and in inventory/sacks'
        );
        this.addToggle('labels.kill_nearby_pests_while_farming', (value) => (this.killNearbyPests = !!value), 'descriptions.kill_nearby_pests_while_farming');
    }

    restoreSlot() {
        if (this.originalSlot !== -1) setItemSlot(this.originalSlot);
        this.originalSlot = -1;
    }

    selectVacuum() {
        const slot = findItemInHotbar('Vacuum');
        if (slot < 0) {
            if (!this.hasReportedMissingVacuum) this.message('messages.farming.vacuumMissing');
            this.hasReportedMissingVacuum = true;
            return false;
        }
        this.hasReportedMissingVacuum = false;
        if (!stripItemFormatting(Player.getInventory()?.getStackInSlot(slot)?.getName?.() || '').includes('Hooverius')) {
            this.message('messages.farming.unsupportedVacuum');
        }
        if (Player.getHeldItemIndex() === slot) return true;
        setItemSlot(slot);
        return false;
    }
}

export const farmingSettings = new FarmingSettings();
