import { ModuleBase } from '../../../utils/ModuleBase';
import { Slider } from '../../../gui/components/Slider';
import { ToggleButton } from '../../../gui/components/Toggle';
import { MultiToggle } from '../../../gui/components/Dropdown';
import { stripItemFormatting } from '../../../utils/player/Inventory';
import { findTabListIndex, getTabListNames, readVisitors } from '../../../utils/TabListUtils';

class RewarpSettings extends ModuleBase {
    constructor() {
        super({
            name: 'Rewarp Settings',
            subcategory: 'Farming',
            description: 'Shared rewarp settings for all farming macros.',
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
        this.philipContactMethod = '/call (recommended)';
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
        const triggerRadius = this.addSlider('Rewarp Trigger Radius', 0.5, 5, this.triggerRadius, (value) => (this.triggerRadius = value));
        this.addRewarpButtons(triggerRadius);
        const visitorPopup = this.addPopup('Visitor Macro Settings', null, 'Configure the Visitor Macro run before rewarping.');
        visitorPopup.addComponent(
            new ToggleButton('Run Visitor Macro', 0, 0, undefined, undefined, (value) => (this.runVisitorMacro = !!value), this.runVisitorMacro),
            'Runs at the barn before rewarping when enough visitors are waiting.'
        );
        visitorPopup.addComponent(
            new Slider('Minimum Visitors', 1, 5, 0, 0, undefined, undefined, this.minimumVisitors, (value) => {
                this.minimumVisitors = Math.round(value);
            }),
            'Runs Visitor Macro when at least this many visitors are waiting.'
        );
        visitorPopup.addComponent(
            new Slider('Max Visitor Price (k)', 0, 5_000, 0, 0, undefined, undefined, this.maxVisitorPrice / 1_000, (value) => {
                this.maxVisitorPrice = Number(value) * 1_000;
            }),
            'Cancels a Bazaar purchase when its total price is above this amount in thousands.'
        );
        visitorPopup.addComponent(
            new ToggleButton(
                'Decline Failed Purchases',
                0,
                0,
                undefined,
                undefined,
                (value) => (this.declinePurchaseFailures = !!value),
                this.declinePurchaseFailures
            ),
            'Declines visitors when a Bazaar purchase fails.'
        );

        const philipPopup = this.addPopup('Auto Philip Bonus Settings', null, 'Configure automatic Buzzing Bonus renewal.');
        philipPopup.addComponent(
            new ToggleButton('Auto Philip Bonus', 0, 0, undefined, undefined, (value) => (this.autoPhilipBonus = !!value), this.autoPhilipBonus),
            'Empties a vacuum bag with Philip when Buzzing Bonus is inactive and it holds 40 or more pests.'
        );
        philipPopup.addComponent(
            new MultiToggle(
                'Contact Method',
                0,
                0,
                ['Pathfind', 'Abiphone', '/call (recommended)'],
                true,
                (options) => (this.philipContactMethod = options.find((option) => option.enabled)?.name || '/call (recommended)'),
                this.philipContactMethod
            ),
            'How to contact Philip. Abiphone requires one in the hotbar.'
        );

        const pestPopup = this.addPopup('Pest Killer Settings', null, 'Configure when Pest Killer runs.');
        pestPopup.addComponent(
            new ToggleButton('Pest Killer', 0, 0, undefined, undefined, (value) => (this.pestKiller = !!value), this.pestKiller),
            'Pauses farming to clear pests when the configured threshold is reached.'
        );
        pestPopup.addComponent(
            new Slider('Pest Threshold', 1, 8, 0, 0, undefined, undefined, this.pestThreshold, (value) => {
                this.pestThreshold = Math.round(value);
            }),
            'Starts Pest Killer at this many alive pests.'
        );
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
