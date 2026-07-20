import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

const MAX_REWARP_DELAY_MS = 2000;

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
        this.command = 'warp garden';
        this.delayMin = 500;
        this.delayMax = 750;
        this.triggerRadius = 2;
        this.looping = false;
        this.rewarpButtons = [];
        this.runVisitorMacro = false;
        this.minimumVisitors = 1;

        this.addToggle('Use Mousemat', (value) => (this.useMousemat = !!value), 'Use Squeaky Mousemat instead of V5 rotations to face the farming angle.');
        this.addToggle(
            'Sprayonator While Farming',
            (value) => (this.useSprayonator = !!value),
            'Uses a Sprayonator while farming. \nMust have material already selected and in inventory/sacks'
        );
        this.addToggle('Kill nearby pests while farming', (value) => (this.killNearbyPests = !!value), 'Pauses farming to kill nearby pests.');
        this.addToggle(
            'Looping Mode',
            (value) => {
                this.looping = !!value;
                this.rewarpButtons.forEach((button) => (button.visible = !this.looping));
            },
            'Sets home, runs visitors when the minimum is reached, then warps back to the saved start.'
        );
        this.addTextInput('Rewarp Command', this.command, (value) => {
            this.command = String(value || '')
                .replace(/^\//, '')
                .trim();
        });
        this.addRangeSlider('Rewarp Delay', 0, MAX_REWARP_DELAY_MS, { low: this.delayMin, high: this.delayMax }, (value) => {
            this.delayMin = Math.round(value.low);
            this.delayMax = Math.round(value.high);
        });
        const triggerRadius = this.addSlider('Rewarp Trigger Radius', 0.5, 5, this.triggerRadius, (value) => (this.triggerRadius = value));
        this.addRewarpButtons(triggerRadius);
        this.addToggle(
            'Run Visitor Macro',
            (value) => {
                this.runVisitorMacro = value;
                minimumVisitors.visible = value;
            },
            'Runs before rewarping when enough visitors are waiting.'
        );
        const minimumVisitors = this.addSlider(
            'Minimum Visitors',
            1,
            5,
            this.minimumVisitors,
            (value) => (this.minimumVisitors = Math.round(value)),
            'Runs Visitor Macro when at least this many visitors are waiting.'
        );
        minimumVisitors.visible = false;
    }

    addRewarpButtons(...buttons) {
        buttons.forEach((button) => (button.visible = !this.looping));
        this.rewarpButtons.push(...buttons);
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
