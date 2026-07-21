import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

class FarmingSettings extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Settings',
            subcategory: 'Farming',
            description: 'Shared settings for all farming macros.',
            showEnabledToggle: false,
        });

        this.useMousemat = false;
        this.useSprayonator = false;
        this.killNearbyPests = false;
        this.originalSlot = -1;

        this.addToggle('Use Mousemat', (value) => (this.useMousemat = !!value), 'Use Squeaky Mousemat instead of V5 rotations to face the farming angle.');
        this.addToggle(
            'Sprayonator While Farming',
            (value) => (this.useSprayonator = !!value),
            'Uses a Sprayonator while farming. \nMust have material already selected and in inventory/sacks'
        );
        this.addToggle('Kill nearby pests while farming', (value) => (this.killNearbyPests = !!value), 'Pauses farming to kill nearby pests.');
    }

    restoreSlot() {
        if (this.originalSlot !== -1) Guis.setItemSlot(this.originalSlot);
        this.originalSlot = -1;
    }

    selectVacuum() {
        const slot = Guis.findItemInHotbar('Vacuum');
        if (slot < 0) {
            if (!this.hasReportedMissingVacuum) this.message('&cNo Vacuum found in hotbar.');
            this.hasReportedMissingVacuum = true;
            return false;
        }
        this.hasReportedMissingVacuum = false;
        if (Player.getHeldItemIndex() === slot) return true;
        Guis.setItemSlot(slot);
        return false;
    }
}

export const farmingSettings = new FarmingSettings();
