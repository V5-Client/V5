import { ModuleBase } from '../../../utils/ModuleBase';
import { Guis } from '../../../utils/player/Inventory';
import { TabListUtils } from '../../../utils/TabListUtils';

const MAX_REWARP_DELAY_MS = 2000;

class RewarpSettings extends ModuleBase {
    constructor() {
        super({
            name: 'Rewarp Settings',
            subcategory: 'Farming',
            description: 'Shared rewarp settings for all farming macros.',
            showEnabledToggle: false,
        });

        this.looping = false;
        this.command = 'warp garden';
        this.delayMin = 500;
        this.delayMax = 750;
        this.triggerRadius = 2;
        this.rewarpButtons = [];
        this.runVisitorMacro = false;
        this.minimumVisitors = 1;
        this.maxVisitorPrice = 500_000;
        this.declinePurchaseFailures = false;
        this.autoPhilipBonus = false;
        this.pestKiller = false;
        this.pestThreshold = 5;

        this.addMultiToggle(
            'Rewarp Style',
            ['Start/End', 'Looping'],
            true,
            (options) => {
                this.looping = options[1].enabled;
                this.rewarpButtons.forEach((button) => (button.visible = !this.looping));
            },
            'Start/End warps at the saved endpoint. Looping sets home before running barn tasks.',
            'Start/End'
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
                this.runVisitorMacro = !!value;
                [minimumVisitors, maxVisitorPrice, declinePurchaseFailures].forEach((setting) => (setting.visible = !!value));
            },
            'Runs at the barn before rewarping when enough visitors are waiting.'
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
        const maxVisitorPrice = this.addSlider(
            'Max Visitor Price',
            0,
            5_000_000,
            this.maxVisitorPrice,
            (value) => (this.maxVisitorPrice = Number(value)),
            'Cancels a Bazaar purchase when its total price is above this amount.'
        );
        maxVisitorPrice.visible = false;
        const declinePurchaseFailures = this.addToggle(
            'Decline Failed Purchases',
            (value) => (this.declinePurchaseFailures = !!value),
            'Declines visitors when a Bazaar purchase fails.'
        );
        declinePurchaseFailures.visible = false;
        this.addToggle(
            'Auto Philip Bonus',
            (value) => (this.autoPhilipBonus = !!value),
            'Empties a vacuum bag with Philip when Buzzing Bonus is inactive and it holds 40 or more pests.'
        );
        this.addToggle(
            'Pest Killer',
            (value) => {
                this.pestKiller = !!value;
                pestThreshold.visible = !!value;
            },
            'Pauses farming to clear pests when the configured threshold is reached.'
        );
        const pestThreshold = this.addSlider(
            'Pest Threshold',
            1,
            8,
            this.pestThreshold,
            (value) => (this.pestThreshold = Math.round(value)),
            'Starts Pest Killer at this many alive pests.'
        );
        pestThreshold.visible = false;
    }

    addRewarpButtons(...buttons) {
        buttons.forEach((button) => (button.visible = !this.looping));
        this.rewarpButtons.push(...buttons);
    }

    shouldRunVisitorMacro() {
        return this.runVisitorMacro && TabListUtils.readVisitors().length >= this.minimumVisitors;
    }

    shouldRunPhilipBonus() {
        if (!this.autoPhilipBonus || TabListUtils.findIndex(TabListUtils.getNames(), 'Bonus: INACTIVE') === -1) return false;
        const vacuum = Player.getInventory()
            ?.getItems?.()
            .find((item) => String(Guis.stripFormatting(item?.getName?.() || '')).includes('Vacuum'));
        const vacuumLine = String(Guis.stripFormatting(vacuum?.getLore?.().find((line) => String(line).includes('Vacuum Bag:')) || ''));
        return (Number.parseInt(Guis.stripFormatting(vacuumLine).replace(/[^\d]/g, ''), 10) || 0) >= 40;
    }
}

export const rewarpSettings = new RewarpSettings();
