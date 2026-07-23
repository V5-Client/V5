import { Guis } from '../../../utils/player/Inventory';
import { Utils } from '../../../utils/Utils';
import { farmingDelays } from '../FarmingDelays';

const TARGETS = [
    'Atmospheric Filter',
    'Squeaky Toy',
    'Beady Eyes',
    'Clipped Wings',
    'Overclocker',
    'Mantid Claw',
    'Flowering Bouquet',
    'Bookworm',
    'Chirping Stereo',
    'Firefly',
    'Capsule',
    'Vinyl',
    'Wriggling Larva',
    'Quickdraw',
    'Rarefinder',
    'Chum',
    'Rune',
];
const MIN_FREE_SLOTS = 14;
const TIMEOUT_MS = 10_000;

class AutoSell {
    shouldRun() {
        const items = Player.getInventory().getItems();
        return items.filter((i) => !i).length < MIN_FREE_SLOTS;
    }

    start() {
        this.startedAt = Date.now();
        this.nextActionAt = 0;
        this.state = 'trades';
    }

    stop() {
        if (this.state) this.finish();
    }

    finish() {
        this.state = null;
        Guis.closeInv();
        return true;
    }

    tick() {
        if (!this.state) return true;
        if (Date.now() - this.startedAt >= TIMEOUT_MS) return this.finish();
        if (Date.now() < this.nextActionAt) return;

        switch (this.state) {
            case 'trades': {
                if (Guis.guiName() !== 'Trades') {
                    ChatLib.command('trades');
                    this.nextActionAt = Date.now() + 1000;
                    return;
                }

                const items = Player.getContainer()?.getItems();
                if (!items || items.length <= 54) return;
                for (let i = 54; i < items.length; i++) {
                    const item = items[i];
                    if (item && TARGETS.some((name) => ChatLib.removeFormatting(String(item.getName())).includes(name))) {
                        Guis.clickSlot(i, false, 'LEFT');
                        this.nextActionAt = Date.now() + Utils.randomInt(farmingDelays.visitorAutoSellDelayMin, farmingDelays.visitorAutoSellDelayMax) * 50;
                        return;
                    }
                }

                if (this.shouldRun()) {
                    this.state = 'bazaar';
                    Guis.closeInv();
                    this.nextActionAt = Date.now() + 1000;
                    return;
                }

                return this.finish();
            }
            case 'bazaar':
                if (
                    !String(Guis.guiName() || '')
                        .toLowerCase()
                        .includes('bazaar')
                ) {
                    ChatLib.command('bz');
                    this.nextActionAt = Date.now() + 1000;
                    return;
                }

                if (!Guis.clickItem('Sell Inventory Now')) return;
                this.state = 'selling whole inventory';
                this.nextActionAt = Date.now() + Utils.randomInt(farmingDelays.bazaarActionDelayMin, farmingDelays.bazaarActionDelayMax);
                return;
            case 'selling whole inventory':
                if (!Guis.clickItem('Selling whole inventory')) return;

                this.state = 'closing inventory';
                this.nextActionAt = Date.now() + 10 * 50;
                return;
            case 'closing inventory':
                return this.finish();
        }
    }
}

export const autoSell = new AutoSell();
