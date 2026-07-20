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

        this.addRangeSlider(
            'Visitor Double Click Delay (Ticks)',
            MIN_TICK_DELAY,
            MAX_TICK_DELAY,
            { low: this.visitorDoubleClickDelayMin, high: this.visitorDoubleClickDelayMax },
            (value) => {
                this.visitorDoubleClickDelayMin = Math.round(value.low);
                this.visitorDoubleClickDelayMax = Math.round(value.high);
            }
        );
        this.addRangeSlider('Next Visitor Delay (ms)', 0, MAX_ACTION_DELAY_MS, { low: this.visitorNextDelayMin, high: this.visitorNextDelayMax }, (value) => {
            this.visitorNextDelayMin = Math.round(value.low);
            this.visitorNextDelayMax = Math.round(value.high);
        });
        this.addRangeSlider(
            'Visitor Retry Delay (ms)',
            0,
            MAX_ACTION_DELAY_MS,
            { low: this.visitorRetryDelayMin, high: this.visitorRetryDelayMax },
            (value) => {
                this.visitorRetryDelayMin = Math.round(value.low);
                this.visitorRetryDelayMax = Math.round(value.high);
            }
        );
        this.addRangeSlider(
            'Pest Restore Delay (Ticks)',
            MIN_TICK_DELAY,
            MAX_TICK_DELAY,
            { low: this.pestRestoreDelayMin, high: this.pestRestoreDelayMax },
            (value) => {
                this.pestRestoreDelayMin = Math.round(value.low);
                this.pestRestoreDelayMax = Math.round(value.high);
            }
        );
        this.addRangeSlider(
            'Sprayonator Action Delay (Ticks)',
            MIN_TICK_DELAY,
            MAX_TICK_DELAY,
            { low: this.sprayonatorActionDelayMin, high: this.sprayonatorActionDelayMax },
            (value) => {
                this.sprayonatorActionDelayMin = Math.round(value.low);
                this.sprayonatorActionDelayMax = Math.round(value.high);
            }
        );
        this.addRangeSlider(
            'Mousemat Action Delay (Ticks)',
            MIN_TICK_DELAY,
            MAX_TICK_DELAY,
            { low: this.mousematActionDelayMin, high: this.mousematActionDelayMax },
            (value) => {
                this.mousematActionDelayMin = Math.round(value.low);
                this.mousematActionDelayMax = Math.round(value.high);
            }
        );
        this.addRangeSlider(
            'Bazaar Action Delay (ms)',
            0,
            MAX_ACTION_DELAY_MS,
            { low: this.bazaarActionDelayMin, high: this.bazaarActionDelayMax },
            (value) => {
                this.bazaarActionDelayMin = Math.round(value.low);
                this.bazaarActionDelayMax = Math.round(value.high);
            }
        );
    }
}

export const farmingDelays = new FarmingDelays();
