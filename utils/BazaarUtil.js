import { Guis } from './player/Inventory';
import { Sign } from './Sign';
import { Utils } from './Utils';
import { farmingDelays } from '../modules/farming/FarmingDelays';

const TIMEOUT = 10_000;

class BazaarUtil {
    constructor() {
        this.state = 'idle';
        this.callback = null;
        this.deadline = 0;
        this.waitUntil = 0;
        this.confirmSlot = -1;
        register('tick', () => this.tick());
    }

    buy(itemName, count, maxPrice, callback) {
        const name = this.clean(itemName);
        const amount = String(count ?? '').trim();
        if (this.state !== 'idle' || !name || !amount) {
            if (typeof callback === 'function') callback(false);
            return false;
        }

        this.itemName = name;
        this.amount = amount;
        this.maxPrice = Number(maxPrice);
        this.callback = callback;
        ChatLib.command(`bz ${itemName}`);
        this.setState('bazaar');
        return true;
    }

    cancel() {
        if (this.state !== 'idle') this.finish(false);
    }

    tick() {
        if (this.state === 'idle' || Date.now() < this.waitUntil) return;
        if (Date.now() >= this.deadline) return this.finish(false);

        switch (this.state) {
            case 'bazaar': {
                if (!this.clean(Guis.guiName()).includes('bazaar')) return;
                const slot = this.findSlot(this.itemName, 10, 42);
                if (slot === -1) return;
                if (!Guis.clickSlot(slot)) return this.finish(false);
                this.setState('buy instantly');
                return;
            }
            case 'buy instantly':
                return this.clickNamed('Buy Instantly', 'custom amount');
            case 'custom amount':
                return this.clickNamed('Custom Amount', 'sign');
            case 'sign':
                if (!this.isSignOpen()) return;
                Sign.setLine(1, this.amount);
                Client.currentGui.close();
                this.setState('confirm amount');
                return;
            case 'confirm amount': {
                const slot = this.findSlot('Custom Amount');
                if (slot === -1) return;
                const price = this.getSlotPrice(slot);
                if (!Number.isFinite(price) || !Number.isFinite(this.maxPrice) || price > this.maxPrice) return this.finish(false);
                this.confirmSlot = slot;
                if (!Guis.clickSlot(slot)) return this.finish(false);
                this.setState('warning', 500);
                return;
            }
            case 'warning':
                if (this.isSlotNamed(this.confirmSlot, 'Warning')) {
                    this.setState('warning change');
                    return;
                }
                Guis.closeInv();
                return this.finish(true);
            case 'warning change':
                if (this.isSlotNamed(this.confirmSlot, 'Warning')) return;
                if (!Guis.clickSlot(this.confirmSlot)) return this.finish(false);
                return this.finish(true);
        }
    }

    clickNamed(name, nextState) {
        const slot = this.findSlot(name);
        if (slot === -1) return false;
        if (!Guis.clickSlot(slot)) return false;
        this.setState(nextState);
        return true;
    }

    findSlot(name, from = 0, to = Number.MAX_SAFE_INTEGER) {
        const container = Player.getContainer();
        if (!container) return -1;

        const last = Math.min(to, container.getItems().length - 1);
        for (let slot = from; slot <= last; slot++) {
            if (this.clean(container.getStackInSlot(slot)?.getName?.()) === this.clean(name)) return slot;
        }
        return -1;
    }

    isSlotNamed(slot, name) {
        return slot >= 0 && this.clean(Player.getContainer()?.getStackInSlot(slot)?.getName?.()) === this.clean(name);
    }

    getSlotPrice(slot) {
        const lore = Player.getContainer()?.getStackInSlot(slot)?.getLore?.() || [];
        const line = lore.map((value) => ChatLib.removeFormatting(String(value)).trim()).find((value) => value.toLowerCase().startsWith('price:'));
        if (!line) return NaN;
        return Number(line.replace(/[^\d,.]/g, '').replace(/,/g, ''));
    }

    isSignOpen() {
        return Client.currentGui?.getClassName?.().includes('Sign') || false;
    }

    clean(name) {
        return ChatLib.removeFormatting(String(name ?? ''))
            .trim()
            .toLowerCase();
    }

    setState(state, delay = Utils.randomInt(farmingDelays.bazaarActionDelayMin, farmingDelays.bazaarActionDelayMax)) {
        this.state = state;
        this.deadline = Date.now() + TIMEOUT;
        this.waitUntil = Date.now() + delay;
    }

    finish(success) {
        const callback = this.callback;
        this.state = 'idle';
        this.callback = null;
        this.confirmSlot = -1;
        if (Client.isInGui()) Guis.closeInv();
        if (typeof callback === 'function') callback(success);
    }
}

export const bazaarUtil = new BazaarUtil();
