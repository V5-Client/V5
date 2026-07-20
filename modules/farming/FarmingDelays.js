import { ModuleBase } from '../../utils/ModuleBase';

const MIN_TICK_DELAY = 1;
const MAX_TICK_DELAY = 10;
const MAX_ACTION_DELAY_MS = 1000;

class FarmingDelays extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Delays',
            subcategory: 'Farming',
            description: 'Randomized action delays for farming helpers.',
            showEnabledToggle: false,
        });

        this.visitorDoubleClickDelayMin = 3;
        this.visitorDoubleClickDelayMax = 7;
        this.visitorAutoSellDelayMin = 3;
        this.visitorAutoSellDelayMax = 6;
        this.visitorNextDelayMin = 250;
        this.visitorNextDelayMax = 750;
        this.visitorRetryDelayMin = 250;
        this.visitorRetryDelayMax = 750;
        this.pestRestoreDelayMin = 3;
        this.pestRestoreDelayMax = 5;
        this.sprayonatorActionDelayMin = 2;
        this.sprayonatorActionDelayMax = 4;
        this.mousematActionDelayMin = 2;
        this.mousematActionDelayMax = 4;
        this.bazaarActionDelayMin = 250;
        this.bazaarActionDelayMax = 750;

        this.addDelayRange('Visitor Double Click Delay (Ticks)', 'visitorDoubleClickDelay', MIN_TICK_DELAY, MAX_TICK_DELAY);
        this.addDelayRange('Visitor Autosell Click Delay (Ticks)', 'visitorAutoSellDelay', MIN_TICK_DELAY, MAX_TICK_DELAY);
        this.addDelayRange('Next Visitor Delay (ms)', 'visitorNextDelay', 0, MAX_ACTION_DELAY_MS);
        this.addDelayRange('Visitor Retry Delay (ms)', 'visitorRetryDelay', 0, MAX_ACTION_DELAY_MS);
        this.addDelayRange('Pest Restore Delay (Ticks)', 'pestRestoreDelay', MIN_TICK_DELAY, MAX_TICK_DELAY);
        this.addDelayRange('Sprayonator Action Delay (Ticks)', 'sprayonatorActionDelay', MIN_TICK_DELAY, MAX_TICK_DELAY);
        this.addDelayRange('Mousemat Action Delay (Ticks)', 'mousematActionDelay', MIN_TICK_DELAY, MAX_TICK_DELAY);
        this.addDelayRange('Bazaar Action Delay (ms)', 'bazaarActionDelay', 0, MAX_ACTION_DELAY_MS);
    }

    addDelayRange(name, key, min, max) {
        const minKey = `${key}Min`;
        const maxKey = `${key}Max`;
        this.addRangeSlider(name, min, max, { low: this[minKey], high: this[maxKey] }, (value) => {
            this[minKey] = Math.round(value.low);
            this[maxKey] = Math.round(value.high);
        });
    }
}

export const farmingDelays = new FarmingDelays();
