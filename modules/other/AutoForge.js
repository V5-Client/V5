import { ModuleBase } from '../../utils/ModuleBase';
import { fastDistance } from '../../utils/Math';
import { getTabListNames, stripTabFormatting } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { clickSlot, closeInventory } from '../../utils/player/Inventory';
import { Rotations } from '../../utils/player/Rotations';

const FORGE_SLOTS = [10, 11, 12, 13, 14, 15, 16];
const FORGE_NPCS = [
    [-23, 150, -50],
    [23, 150, -58],
    [-23, 150, -80],
    [23, 150, -88],
    [-4, 148, -109],
];
const FORGE_PROCESSES = {
    Refining: ['Refined Diamond', 'Refined Mithril', 'Refined Titanium', 'Refined Tungsten', 'Refined Umber'],
    Forging: [
        'Bejeweled Handle',
        'Drill Motor',
        'Fuel Canister',
        'Gemstone Mixture',
        'Glacite Amalgamation',
        'Golden Plate',
        'Mithril Plate',
        'Tungsten Plate',
        'Umber Plate',
        'Perfect Plate',
    ],
    Tools: [
        'Mithril Drill SX-R226',
        'Mithril Drill SX-R326',
        'Ruby Drill TX-15',
        'Gemstone Drill LT-522',
        'Topaz Drill KGR-12',
        'Jasper Drill X',
        'Topaz Rod',
        'Titanium Drill DR-X355',
        'Titanium Drill DR-X455',
        'Titanium Drill DR-X555',
        'Titanium Drill DR-X655',
        "Divan's Drill",
        'Reinforced Chisel',
        'Glacite-Plated Chisel',
        'Perfect Chisel',
    ],
    Gear: [
        'Mithril Necklace',
        'Mithril Cloak',
        'Mithril Belt',
        'Mithril Gauntlet',
        'Titanium Necklace',
        'Titanium Cloak',
        'Titanium Belt',
        'Titanium Gauntlet',
        'Titanium Talisman',
        'Titanium Ring',
        'Titanium Artifact',
        'Titanium Relic',
        "Divan's Powder Coating",
        'Helmet of Divan',
        'Chestplate of Divan',
        'Leggings of Divan',
        'Boots of Divan',
        'Amber Necklace',
        'Sapphire Cloak',
        'Jade Belt',
        'Amethyst Gauntlet',
        'Gemstone Chamber',
        'Dwarven Handwarmers',
        'Dwarven Metal Talisman',
        'Pendant of Divan',
        'Relic of Power',
    ],
    'Reforge Stones': [
        'Diamonite',
        'Pocket Iceberg',
        'Petrified Starfall',
        'Pure Mithril',
        'Dwarven Geode',
        'Titanium Tesseract',
        'Gleaming Crystal',
        'Scorched Topaz',
        'Amber Material',
        'Frigid Husk',
    ],
    'Drill Parts': [
        'Starfall Seasoning',
        'Goblin Omelette',
        'Blue Cheese Goblin Omelette',
        'Pesto Goblin Omelette',
        'Spicy Goblin Omelette',
        'Sunny Side Goblin Omelette',
        'Tungsten Regulator',
        'Mithril-Plated Drill Engine',
        'Titanium-Plated Drill Engine',
        'Ruby-Polished Drill Engine',
        'Sapphire-Polished Drill Engine',
        'Amber-Polished Drill Engine',
        'Mithril-Infused Fuel Tank',
        'Titanium-Infused Fuel Tank',
        'Gemstone Fuel Tank',
        'Perfectly-Cut Fuel Tank',
    ],
    'Perfect Gemstones': [
        'Perfect Amber Gemstone',
        'Perfect Amethyst Gemstone',
        'Perfect Jade Gemstone',
        'Perfect Jasper Gemstone',
        'Perfect Opal Gemstone',
        'Perfect Ruby Gemstone',
        'Perfect Sapphire Gemstone',
        'Perfect Topaz Gemstone',
        'Perfect Aquamarine Gemstone',
        'Perfect Citrine Gemstone',
        'Perfect Onyx Gemstone',
        'Perfect Peridot Gemstone',
    ],
    Pets: ['Bejeweled Collar', '[Lvl 1] Mole', '[Lvl 1] Ammonite', 'Penguin', 'T-Rex', 'Spinosaurus', 'Goblin', 'Ankylosaurus', 'Mammoth'],
    Other: [
        'Beacon II',
        'Beacon III',
        'Beacon IV',
        'Beacon V',
        'Travel Scroll to the Dwarven Forge',
        'Travel Scroll to the Dwarven Base Camp',
        'Secret Railroad Pass',
        'Mithril Lantern',
        'Titanium Lantern',
        'Glacite Lantern',
        "Will-o'-wisp",
        'Power Crystal',
        'Tungsten Key',
        'Umber Key',
        'Skeleton Key',
        'Portable Campfire',
    ],
};
const GUI_TIMEOUT_TICKS = 120;
const clean = (value) => stripTabFormatting(value).trim();
const normalize = (value) =>
    clean(value)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
const FORGE_ITEMS = Object.keys(FORGE_PROCESSES).reduce((items, process) => {
    FORGE_PROCESSES[process].forEach((name) => (items[normalize(name)] = { name, process }));
    return items;
}, {});

class AutoForge extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Forge',
            subcategory: 'Other',
            description: 'Forges and claims items.',
            tooltip: 'Have forge in tablist.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.itemName = 'Tungsten Key';
        this.minDelay = 250;
        this.maxDelay = 500;
        this.waitForAll = false;

        this.addTextInput('Forge Item', this.itemName, (value) => (this.itemName = String(value).trim()), 'The exact item name to forge.');
        this.addRangeSlider('Click Delay (ms)', 50, 2000, { low: this.minDelay, high: this.maxDelay }, (value) => {
            this.minDelay = Math.round(value.low);
            this.maxDelay = Math.round(value.high);
        });
        this.addToggle('Wait For All Slots', (value) => (this.waitForAll = !!value), 'Wait until all seven Forge slots are ready before claiming.');

        this.reset();
        this.on('tick', () => this.action());
    }

    onEnable() {
        const item = this.findConfiguredItem();
        if (!item) {
            this.message(`&cUnknown Forge item: ${this.itemName || '(blank)'}`);
            this.message('&eValid items:');
            Object.entries(FORGE_PROCESSES).forEach(([process, items]) => ChatLib.chat(`&6${process}: &f${items.join(', ')}`));
            return this.toggle(false);
        }

        if (this.forgeTabLines()?.length !== FORGE_SLOTS.length) {
            this.message('&cForge widget must show all 7 slots. Enable/move it to the top!');
            return this.toggle(false);
        }

        this.reset();
        this.activeItem = item.name;
        this.activeProcess = item.process;
        this.message('&aEnabled');
        this.startOpening(this.freeSlot);
    }

    onDisable() {
        this.message('&cDisabled');
        if (this.pathingToForge) Pathfinder.resetPath();
        if (this.rotationPending) Rotations.stop();
        this.reset();
    }

    reset() {
        this.action = this.waitForReady;
        this.openTarget = null;
        this.forgeNpc = null;
        this.pathingToForge = false;
        this.rotationPending = false;
        this.rotationToken = (this.rotationToken || 0) + 1;
        this.activeItem = null;
        this.activeProcess = null;
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
        this.forgeNpc = this.closestForgeNpc();
        this.setState(fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...this.forgeNpc) <= 4 ? this.rotateToForge : this.pathToForge, true);
    }

    pathToForge() {
        if (this.pathingToForge || Pathfinder.isPathing()) return;

        this.pathingToForge = true;
        Pathfinder.findPath(FORGE_NPCS, (success) => {
            this.pathingToForge = false;
            if (!this.enabled) return;
            if (!success) {
                this.message('&cCould not path to a Forge NPC.');
                return this.toggle(false);
            }

            this.forgeNpc = this.closestForgeNpc();
            this.setState(this.rotateToForge, true);
        });
    }

    rotateToForge() {
        if (Rotations.active || !this.canAct()) return;

        const token = ++this.rotationToken;
        this.rotationPending = true;
        if (!Rotations.lookAtVector([this.forgeNpc[0] + 0.5, this.forgeNpc[1] + 1.8, this.forgeNpc[2] + 0.5])) {
            this.rotationPending = false;
            return;
        }
        Rotations.onComplete(() => {
            if (!this.enabled || !this.rotationPending || token !== this.rotationToken) return;
            this.rotationPending = false;
            this.setState(this.openForge);
        });
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

        const slot = this.findNamedSlot(container, this.activeProcess, true);
        if (slot !== -1) this.click(slot, this.item);
        else this.timeout();
    }

    item() {
        const container = this.getOpenContainer(true);
        if (!container || !this.canAct()) return;
        if (this.isMainForge(container)) return this.timeout();

        const slot = this.findNamedSlot(container, this.activeItem);
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
            this.message('&cNot enough materials!');
            this.toggle(false);
            return;
        }

        this.click(slot, this.freeSlot);
    }

    getOpenContainer(wait = false) {
        const container = Player.getContainer();
        if (container) return container;
        if (wait && ++this.waitTicks <= GUI_TIMEOUT_TICKS) return null;
        this.message('&cUh oh... GUI closed manually? Stopping.');
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
        const lines = getTabListNames().map((line) => clean(line?.getName?.() ?? line));
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

    findConfiguredItem() {
        return FORGE_ITEMS[normalize(this.itemName)] || null;
    }

    closestForgeNpc() {
        return FORGE_NPCS.reduce((closest, npc) =>
            fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...npc) < fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest)
                ? npc
                : closest
        );
    }

    isMainForge(container) {
        return !!container && normalize(container.getName()).includes('forge');
    }

    findForgeSlot(container, pattern) {
        return this.findSlot(container, (item) => (item?.getLore?.() || []).some((line) => pattern.test(clean(line))), FORGE_SLOTS);
    }

    findNamedSlot(container, search, exact = false) {
        const target = normalize(search);
        return this.findSlot(container, (item) => {
            const name = normalize(item?.getName?.());
            return exact ? name === target : name.includes(target);
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
        const name = normalize(item?.getName?.());
        return !id.includes('red_terracotta') && !id.includes('red_stained_glass') && !/cancel|not enough|insufficient/.test(name);
    }
}

new AutoForge();
