import { ModuleBase } from '../../utils/ModuleBase';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { clickSlot, closeInventory } from '../../utils/player/Inventory';

const FORGE_SLOTS = [10, 11, 12, 13, 14, 15, 16];
const GUI_TIMEOUT_TICKS = 120;
const ITEM_MODES = ['Tungsten Key', 'Umber Key', 'Tungber Keys', 'Bejeweled Handle'];
const clean = (value) => TabListUtils.stripFormatting(value).trim();

class AutoForge extends ModuleBase {
    constructor() {
        super({
            name: 'modules.auto_forge.name',
            subcategory: 'Other',
            description: 'modules.auto_forge.description',
            tooltip: 'modules.auto_forge.tooltip',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.itemMode = ITEM_MODES[0];
        this.minDelay = 250;
        this.maxDelay = 500;
        this.waitForAll = false;

        this.addMultiToggle(
            'labels.item',
            ITEM_MODES,
            true,
            (options) => (this.itemMode = options.find((option) => option.enabled)?.name || ITEM_MODES[0]),
            'Tungber Keys makes Tungsten Keys first, then switches to Umber Keys when materials run out.',
            ITEM_MODES[0]
        );
        this.addRangeSlider('labels.click_delay_ms', 50, 2000, { low: this.minDelay, high: this.maxDelay }, (value) => {
            this.minDelay = Math.round(value.low);
            this.maxDelay = Math.round(value.high);
        });
        this.addToggle('labels.wait_for_all_slots', (value) => (this.waitForAll = !!value), 'descriptions.wait_for_all_slots');

        this.reset();
        this.on('tick', () => this.action());
    }

    onEnable() {
        if (this.forgeTabLines()?.length !== FORGE_SLOTS.length) {
            this.message('messages.autoForge.invalidWidget');
            return this.toggle(false);
        }

        this.reset();
        this.message('messages.common.enabled');
        this.startOpening(this.freeSlot);
    }

    onDisable() {
        this.message('messages.common.disabled');
        this.reset();
    }

    reset() {
        this.action = this.waitForReady;
        this.openTarget = null;
        this.activeItem = this.itemMode === 'Tungber Keys' ? 'Tungsten Key' : this.itemMode;
        this.nextActionAt = 0;
        this.idleUntil = 0;
        this.waitTicks = 0;
    }

    waitForReady() {
        if (Date.now() < this.idleUntil) return;
        if (this.isMainForge(Player.getContainer())) return this.setState(this.freeSlot, true);

        const ready = this.countReadySlots();
        if (ready && (!this.waitForAll || ready === FORGE_SLOTS.length)) {
            this.message(`&a${ready} slot${ready === 1 ? '' : 's'} ready, claiming!`);
            this.startOpening(this.waitForAll ? this.claimAll : this.claim);
        }
    }

    startOpening(target) {
        this.openTarget = target;
        this.setState(this.openForge, true);
    }

    openForge() {
        if (!this.canAct()) return;
        Client.rightClick();
        this.setState(this.waitForGui);
    }

    waitForGui() {
        if (this.isMainForge(Player.getContainer())) this.setState(this.openTarget, true);
        else this.timeout();
    }

    claim(all = false) {
        const container = this.getOpenContainer();
        if (!container || !this.canAct()) return;

        const slot = all ? this.findNamedSlot(container, 'claim all') : this.findForgeSlot(container, /completed|click to claim/i);
        if (slot !== -1) return this.click(slot, all ? this.waitAfterClaim : null);
        if (all) this.timeout();
        else this.setState(this.freeSlot, true);
    }

    claimAll() {
        this.claim(true);
    }

    waitAfterClaim() {
        if (this.countReadySlots() === 0 || ++this.waitTicks > GUI_TIMEOUT_TICKS * 2) this.setState(this.freeSlot, true);
    }

    freeSlot() {
        const container = this.getOpenContainer(true);
        if (!container || !this.canAct()) return;
        if (!this.isMainForge(container)) return this.timeout();

        const slot = this.findForgeSlot(container, /click to select/i);
        if (slot === -1) return this.finish('&aWatching tablist.');
        this.click(slot, this.categoryTab);
    }

    categoryTab() {
        const container = this.getOpenContainer();
        if (!container || !this.canAct()) return;

        const forging = this.activeItem === 'Bejeweled Handle';
        const slot = forging
            ? this.findNamedSlot(container, 'forging')
            : this.findSlot(
                  container,
                  (item) => item?.type?.getRegistryName?.() === 'minecraft:nether_star' && clean(item.getName()).toLowerCase() === 'other'
              );
        if (slot !== -1) clickSlot(slot);
        if (slot !== -1 || !forging) this.setState(this.item, true);
        else this.timeout();
    }

    item() {
        const container = this.getOpenContainer(true);
        if (!container || !this.canAct()) return;
        if (this.isMainForge(container)) return this.timeout();

        const slot = this.findNamedSlot(container, this.activeItem.toLowerCase());
        if (slot !== -1) this.click(slot, this.confirm);
        else this.timeout();
    }

    confirm() {
        const container = this.getOpenContainer(true);
        if (!container || !this.canAct()) return;

        const slot = this.findNamedSlot(container, 'confirm', true);
        if (slot === -1) return this.timeout();

        if (!this.isConfirmAvailable(container.getStackInSlot(slot))) {
            closeInventory();
            if (this.itemMode === 'Tungber Keys' && this.activeItem === 'Tungsten Key') {
                this.activeItem = 'Umber Key';
                this.message('messages.autoForge.switchingToUmber');
                this.startOpening(this.freeSlot);
            } else {
                this.message('messages.autoForge.materialsMissing');
                this.toggle(false);
            }
            return;
        }

        this.click(slot, this.freeSlot);
    }

    getOpenContainer(wait = false) {
        const container = Player.getContainer();
        if (container) return container;
        if (wait && ++this.waitTicks <= GUI_TIMEOUT_TICKS) return null;
        this.message('messages.autoForge.guiClosed');
        this.toggle(false);
        return null;
    }

    setState(action, delayed = false) {
        this.action = action;
        this.waitTicks = 0;
        if (delayed) this.delay();
    }

    click(slot, state) {
        clickSlot(slot);
        if (state) this.setState(state, true);
        else this.delay();
    }

    delay() {
        this.nextActionAt = Date.now() + Utils.randomInt(this.minDelay, this.maxDelay);
    }

    canAct() {
        return Date.now() >= this.nextActionAt;
    }

    timeout() {
        if (++this.waitTicks > GUI_TIMEOUT_TICKS) this.finish();
    }

    finish(message) {
        if (message) this.message(message);
        closeInventory();
        this.setState(this.waitForReady);
        this.idleUntil = Date.now() + 2000;
    }

    forgeTabLines() {
        const lines = TabListUtils.getNames().map((line) => clean(line?.getName?.() ?? line));
        const header = lines.findIndex((line) => /^forges?:?$/i.test(line));
        if (header === -1) return null;

        const slots = [];
        for (let index = header + 1; index < lines.length; index++) {
            if (!lines[index]) continue;
            const number = lines[index].match(/^(\d+)\)/)?.[1];
            if (Number(number) !== slots.length + 1) break;
            slots.push(lines[index]);
            if (slots.length === FORGE_SLOTS.length) break;
        }
        return slots.length ? slots : null;
    }

    countReadySlots() {
        return (this.forgeTabLines() || []).filter((line) =>
            line
                .replace(/^\d+\)\s*/, '')
                .toLowerCase()
                .includes('ready')
        ).length;
    }

    isMainForge(container) {
        return !!container && clean(container.getName()).toLowerCase().includes('forge');
    }

    findForgeSlot(container, pattern) {
        return this.findSlot(container, (item) => (item?.getLore?.() || []).some((line) => pattern.test(clean(line))), FORGE_SLOTS);
    }

    findNamedSlot(container, search, exact = false) {
        return this.findSlot(container, (item) => {
            const name = clean(item?.getName?.()).toLowerCase();
            return exact ? name === search : name.includes(search);
        });
    }

    findSlot(container, matches, slots = null) {
        const length = slots ? slots.length : Math.max(0, container.getSize() - 36);
        for (let index = 0; index < length; index++) {
            const slot = slots ? slots[index] : index;
            if (matches(container.getStackInSlot(slot))) return slot;
        }
        return -1;
    }

    isConfirmAvailable(item) {
        const id = item?.type?.getRegistryName?.()?.toLowerCase() || '';
        const name = clean(item?.getName?.()).toLowerCase();
        return !id.includes('red_terracotta') && !id.includes('red_stained_glass') && !/cancel|not enough|insufficient/.test(name);
    }
}

new AutoForge();
