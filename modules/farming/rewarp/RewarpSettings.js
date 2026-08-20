import { ModuleBase } from '../../../utils/ModuleBase';
import { stripItemFormatting } from '../../../utils/player/Inventory';
import { findTabListIndex, getTabListNames, readVisitors } from '../../../utils/TabListUtils';

class RewarpSettings extends ModuleBase {
    constructor() {
        super({
            name: 'modules.rewarp_settings.name',
            subcategory: 'Farming',
            description: 'modules.rewarp_settings.description',
            showEnabledToggle: false,
        });

        this.looping = false;
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
            'labels.rewarp_style',
            ['options.start_end', 'options.looping'],
            true,
            (options) => {
                this.looping = options[1].enabled;
                this.rewarpButtons.forEach((button) => (button.visible = !this.looping));
            },
            'Start/End warps at the saved endpoint. Looping sets home before running barn tasks.',
            'Start/End'
        );
        const triggerRadius = this.addSlider('labels.rewarp_trigger_radius', 0.5, 5, this.triggerRadius, (value) => (this.triggerRadius = value));
        this.addRewarpButtons(triggerRadius);
        this.addToggle(
            'labels.run_visitor_macro',
            (value) => {
                this.runVisitorMacro = !!value;
                [minimumVisitors, maxVisitorPrice, declinePurchaseFailures].forEach((setting) => (setting.visible = !!value));
            },
            'descriptions.run_visitor_macro'
        );
        const minimumVisitors = this.addSlider(
            'labels.minimum_visitors',
            1,
            5,
            this.minimumVisitors,
            (value) => (this.minimumVisitors = Math.round(value)),
            'descriptions.minimum_visitors'
        );
        minimumVisitors.visible = false;
        const maxVisitorPrice = this.addSlider(
            'labels.max_visitor_price_k',
            0,
            5_000,
            this.maxVisitorPrice / 1_000,
            (value) => (this.maxVisitorPrice = Number(value) * 1_000),
            'descriptions.max_visitor_price_k'
        );
        maxVisitorPrice.visible = false;
        const declinePurchaseFailures = this.addToggle(
            'labels.decline_failed_purchases',
            (value) => (this.declinePurchaseFailures = !!value),
            'descriptions.decline_failed_purchases'
        );
        declinePurchaseFailures.visible = false;
        this.addToggle('labels.auto_philip_bonus', (value) => (this.autoPhilipBonus = !!value), 'descriptions.auto_philip_bonus');
        this.addToggle(
            'labels.pest_killer',
            (value) => {
                this.pestKiller = !!value;
                pestThreshold.visible = !!value;
            },
            'descriptions.pest_killer'
        );
        const pestThreshold = this.addSlider(
            'labels.pest_threshold',
            1,
            8,
            this.pestThreshold,
            (value) => (this.pestThreshold = Math.round(value)),
            'descriptions.pest_threshold'
        );
        pestThreshold.visible = false;
    }

    addRewarpButtons(...buttons) {
        buttons.forEach((button) => (button.visible = !this.looping));
        this.rewarpButtons.push(...buttons);
    }

    shouldRunVisitorMacro() {
        return this.runVisitorMacro && readVisitors().length >= this.minimumVisitors;
    }

    shouldRunPhilipBonus() {
        if (!this.autoPhilipBonus || findTabListIndex(getTabListNames(), 'Bonus: INACTIVE') === -1) return false;
        const vacuum = Player.getInventory()
            ?.getItems?.()
            .find((item) => String(stripItemFormatting(item?.getName?.() || '')).includes('Vacuum'));
        const vacuumLine = String(vacuum?.getLore?.().find((line) => String(line).includes('Vacuum Bag:')) || '');
        return (Number.parseInt(stripItemFormatting(vacuumLine).replace(/[^\d]/g, ''), 10) || 0) >= 40;
    }
}

export const rewarpSettings = new RewarpSettings();
