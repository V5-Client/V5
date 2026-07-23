import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

class AuctionHelper extends ModuleBase {
    constructor() {
        super({
            name: 'Auction Helper',
            subcategory: 'Other',
            description: 'Automatically sets BIN auctions to two days and confirms them.',
            showEnabledToggle: false,
        });

        this.auto2Day = false;
        this.quickCreate = false;
        this.selectingDuration = false;

        this.addToggle('Auto 2 Day', (value) => {
            this.auto2Day = !!value;
            if (!this.auto2Day) this.selectingDuration = false;
        });
        this.addToggle('Quick Create', (value) => (this.quickCreate = !!value));

        register('tick', () => this.onTick());
    }

    onTick() {
        const guiName = Guis.guiName();

        if (this.auto2Day) {
            if (guiName === 'Create BIN Auction' && Guis.clickItem('Duration: 6 Hours', false, 'LEFT', true, true)) {
                this.selectingDuration = true;
            } else if (this.selectingDuration && Guis.clickItem('2 Days', false, 'LEFT', true, true)) {
                this.selectingDuration = false;
            }
        }

        if (!this.quickCreate) return;
        if (guiName === 'Confirm BIN Auction') Guis.clickItem('Confirm BIN Auction', false, 'LEFT', true, true);
        else if (guiName === 'BIN Auction View') Guis.clickItem('Go Back', false, 'LEFT', true, true);
    }
}

new AuctionHelper();
