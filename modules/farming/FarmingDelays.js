import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';

class FarmingDelays extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Delays',
            subcategory: 'Farming',
            description: 'Randomized action delays for farming helpers.',
            showEnabledToggle: false,
        });

        this.ranges = {
            visitorDoubleClick: { name: 'Visitor Double Click Delay', low: 150, high: 350 },
            visitorAutoSell: { name: 'Visitor Autosell Click Delay', low: 150, high: 300 },
            visitorNext: { name: 'Next Visitor Delay', low: 250, high: 750 },
            visitorRetry: { name: 'Visitor Retry Delay', low: 250, high: 750 },
            pestRestore: { name: 'Pest Restore Delay', low: 150, high: 250 },
            sprayonatorAction: { name: 'Sprayonator Action Delay', low: 100, high: 200 },
            mousematAction: { name: 'Mousemat Action Delay', low: 100, high: 200 },
            bazaarAction: { name: 'Bazaar Action Delay', low: 250, high: 750 },
            rewarp: { name: 'Rewarp Delay', low: 500, high: 750 },
        };

        Object.keys(this.ranges).forEach((key) => this.addDelayRange(key));
    }

    addDelayRange(key) {
        const range = this.ranges[key];
        this.addRangeSlider(`${range.name} (ms)`, 50, 1000, range, (value) => {
            range.low = Math.round(value.low);
            range.high = Math.round(value.high);
        });
    }

    random(key) {
        const range = this.ranges[key];
        return Utils.randomInt(range.low, range.high);
    }

    ticks(key) {
        return Math.ceil(this.random(key) / 50);
    }
}

export const farmingDelays = new FarmingDelays();
