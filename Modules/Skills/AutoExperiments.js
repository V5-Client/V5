import { ModuleBase } from '../../Utility/ModuleBase';
import { Guis } from '../../Utility/Inventory';
import { Chat } from '../../Utility/Chat';
import { Keybind } from '../../Utility/Keybinding';

const SLOTS = {
    CHRONOMATRON: 29,
    ULTRASEQUENCER: 33,
    SUPERPAIRS: 22,
    RENEW: 31,
    CONTROL: 49,
    BOTTLE_MENU: 50,
    GRAND_BOTTLE: 12,
    TITANIC_BOTTLE: 14,
};

const STATES = {
    WAITING: 0,
    DECIDING: 1,
    ULTRASEQUENCER: 2,
    CHRONOMATRON: 3,
    SUPERPAIRS: 4,
    EXPERIMENT_OVER: 5,
    REOPENING: 6,
    BUYING_XP: 7,
};

class AutoExperiments extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Experiments',
            subcategory: 'Skills',
            description: 'Automatically do the Chronomatron and Ultrasequencer experiments.',
            tooltip: 'Automatically does the experiments',
        });

        this.actionDelay = 500;
        this.serumCountValue = 0;
        this.getMaxXpEnabled = false;
        this.maxEnchanting = false;

        this.ultrasequencerOrder = new Map();
        this.chronomatronOrder = [];
        this.ultraPatternCaptured = false;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.lastClickTime = 0;
        this.reopenStep = 0;
        this.buyXpTargetLevel = 0;
        this.boughtXP = false;
        this.state = STATES.WAITING;

        this.on('tick', () => this.onTick());

        this.addSlider(
            'Action Delay (ms)',
            75,
            1000,
            500,
            (v) => (this.actionDelay = v),
            'Delay in milliseconds between experiment clicks and table reopen steps.'
        );
        this.addSlider('Serum Count', 0, 3, 0, (v) => (this.serumCountValue = Math.floor(v)), 'Consumed Metaphysical Serum count.');
        this.addToggle('Get Max XP', (v) => (this.getMaxXpEnabled = v), 'Solve Chronomatron to 15 and Ultrasequencer to 20 for max XP.');
    }

    onTick() {
        if (this.state === STATES.REOPENING) return this.handleReopening();

        const container = Player.getContainer();
        if (!container) return;

        const containerName = ChatLib.removeFormatting(container.getName());
        if (!containerName) return;

        const items = container.getItems();
        if (!items) return;

        this.detectState(containerName);

        switch (this.state) {
            case STATES.EXPERIMENT_OVER:
                Chat.message('&aExperiment completed! Claiming...');
                this.startReopenSequence();
                break;
            case STATES.DECIDING:
                this.handleDeciding(items, containerName);
                break;
            case STATES.ULTRASEQUENCER:
                this.handleUltrasequencer(items);
                break;
            case STATES.CHRONOMATRON:
                this.handleChronomatron(items);
                break;
            case STATES.BUYING_XP:
                this.handleBuyingXp(items);
                break;
        }
    }

    detectState(name) {
        let newState = STATES.WAITING;

        if (name === 'Experiment Over') newState = STATES.EXPERIMENT_OVER;
        else if (name.startsWith('Chronomatron (')) newState = STATES.CHRONOMATRON;
        else if (name.startsWith('Ultrasequencer (')) newState = STATES.ULTRASEQUENCER;
        else if (name === 'Bottles of Enchanting') newState = STATES.BUYING_XP;
        else if (name === 'Experimentation Table' || name.endsWith('Stakes')) newState = STATES.DECIDING;

        if (newState === this.state) return;

        this.state = newState;
        this.lastClickTime = Date.now();

        if (newState === STATES.CHRONOMATRON) {
            this.chronomatronOrder = [];
            this.clicks = 0;
        } else if (newState === STATES.ULTRASEQUENCER) {
            this.ultraPatternCaptured = false;
            this.ultrasequencerOrder.clear();
            this.clicks = 0;
            this.lastSlot49Item = null;
        } else if (newState === STATES.DECIDING) {
            this.lastSlot49Item = null;
        }
    }

    handleDeciding(items, containerName) {
        if (!this.canClick()) return;

        if (this.renewRequired(items)) return this.renewExperiments(items);

        if (this.onCooldown(items[SLOTS.SUPERPAIRS])) {
            Guis.closeInv();
            this.reset();
            return Chat.message('Experiments complete');
        }

        if (this.isStakeSelection('Chronomatron', containerName)) return this.selectHighestStake(items, [24, 23, 22, 21, 20]);
        if (this.isStakeSelection('Ultrasequencer', containerName)) return this.selectHighestStake(items, [23, 22, 21]);

        if (!this.isCompleted(items[21])) return this.clickSlot(SLOTS.CHRONOMATRON);
        if (!this.isCompleted(items[23])) return this.clickSlot(SLOTS.ULTRASEQUENCER);

        if (this.isStakeSelection('Superpairs', containerName)) {
            // auto superpairs todo
            return;
        }

        this.clickSlot(SLOTS.SUPERPAIRS);
        Chat.message('Superpairs ready');
    }

    handleUltrasequencer(items) {
        const maxDepth = this.getMaxXpEnabled ? 20 : (this.maxEnchanting ? 9 : 7) - this.serumCountValue;
        const control = this.getControlState(items);
        if (!control) return;

        if (control.isGlow && !this.ultraPatternCaptured && items[44]) {
            this.captureUltrasequencerOrder(items);
            this.ultraPatternCaptured = true;
            this.clicks = 0;
            if (this.ultrasequencerOrder.size > maxDepth) Guis.closeInv();
        }

        if (control.isClock && this.ultraPatternCaptured && this.canClick() && this.ultrasequencerOrder.has(this.clicks)) {
            if (this.clickSlot(this.ultrasequencerOrder.get(this.clicks))) this.clicks++;
        }

        if (control.isGlow && control.wasClockLastFrame) this.ultraPatternCaptured = false;

        this.lastSlot49Item = control.name;
    }

    handleChronomatron(items) {
        const maxDepth = this.getMaxXpEnabled ? 20 : (this.maxEnchanting ? 12 : 9) - this.serumCountValue;
        const control = this.getControlState(items);
        if (!control) return;

        const guiRound = this.getChronomatronRound(items);
        const expectedLen = Math.min(maxDepth, guiRound || this.chronomatronOrder.length + 1);

        if (guiRound - 1 === maxDepth) Guis.closeInv();

        if (control.isClock && this.chronomatronOrder.length < expectedLen) {
            this.clicks = 0;
            for (let i = 9; i <= 44; i++) {
                if (items[i]?.toMC().hasGlint()) {
                    this.chronomatronOrder.push(i);
                    break;
                }
            }
        } else if (control.isClock && this.chronomatronOrder.length > this.clicks && this.canClick()) {
            if (this.clickSlot(this.chronomatronOrder[this.clicks], 'LEFT')) this.clicks++;
        }

        if (control.isGlow && this.clicks >= this.chronomatronOrder.length && this.chronomatronOrder.length > 0) {
            this.clicks = 0;
        }

        this.lastSlot49Item = control.name;
    }

    handleBuyingXp(items) {
        if (this.buyXpTargetLevel === 0) return;

        const currentLevel = this.extractXpLevel(items[SLOTS.GRAND_BOTTLE]);
        if (currentLevel >= this.buyXpTargetLevel) {
            this.buyXpTargetLevel = 0;
            if (this.boughtXP) {
                this.boughtXP = false;
                return this.startReopenSequence();
            }
            Guis.closeInv();
            return Chat.message('Not enough bits!');
        }

        const slot = this.buyXpTargetLevel <= 100 ? SLOTS.GRAND_BOTTLE : SLOTS.TITANIC_BOTTLE;
        if (items[slot] && this.canClick() && this.clickSlot(slot)) this.boughtXP = true;
    }

    startReopenSequence() {
        this.reopenStep = 0;
        this.lastClickTime = Date.now();
        this.state = STATES.REOPENING;
    }

    handleReopening() {
        if (!this.canClick()) return;

        if (this.reopenStep === 0) {
            Guis.closeInv();
            this.reopenStep = 1;
            this.lastClickTime = Date.now();
        } else if (this.reopenStep === 1) {
            this.reopenStep = 2;
            this.lastClickTime = Date.now();
        } else {
            Chat.message('&aReopening Experimentation Table...');
            Keybind.rightClick();
            this.reset();
        }
    }

    getControlState(items) {
        const item = items[SLOTS.CONTROL];
        if (!item) return null;

        const name = ChatLib.removeFormatting(item.getName());
        return {
            name,
            isGlow: name === 'Remember the pattern!',
            isClock: name.startsWith('Timer:'),
            wasClockLastFrame: this.lastSlot49Item?.startsWith('Timer:'),
        };
    }

    captureUltrasequencerOrder(items) {
        this.ultrasequencerOrder.clear();
        for (let i = 9; i <= 44; i++) {
            if (items[i] && this.isDye(items[i])) {
                this.ultrasequencerOrder.set(items[i].getStackSize() - 1, i);
            }
        }
    }

    selectHighestStake(items, slots) {
        for (const slot of slots) {
            if (items[slot] && !this.isLocked(items[slot])) {
                if (slot === 24) this.maxEnchanting = true;
                else this.maxEnchanting = false;
                return this.clickSlot(slot);
            }
        }
        return false;
    }

    renewRequired(items) {
        const name = ChatLib.removeFormatting(items[SLOTS.RENEW]?.getName());
        return name?.includes('Renew Experiments') ?? false;
    }

    renewExperiments(items) {
        for (const line of this.getLoreLines(items[SLOTS.RENEW])) {
            const lower = line.toLowerCase();
            if (lower.includes('click to purchase')) return this.clickSlot(SLOTS.RENEW);
            if (lower.includes('cannot afford this!')) {
                this.buyXpTargetLevel = this.extractRenewCost(items[SLOTS.RENEW]);
                return this.clickSlot(SLOTS.BOTTLE_MENU);
            }
        }
    }

    clickSlot(slot, clickType = 'MIDDLE') {
        if (Guis.clickSlot(slot, false, clickType)) {
            this.lastClickTime = Date.now();
            return true;
        }
        return false;
    }

    canClick() {
        return Date.now() - this.lastClickTime >= this.actionDelay;
    }

    isStakeSelection(game, containerName) {
        return containerName.includes(game) && containerName.includes('Stakes');
    }

    extractRenewCost(item) {
        const loreLines = this.getLoreLines(item);

        // "000 XP Levels"
        for (const line of loreLines) {
            const match = line.match(/(\d+)\s*XP\s*Levels?/i);
            if (match) return parseInt(match[1], 10);
        }
        return 0;
    }

    extractXpLevel(item) {
        for (const line of this.getLoreLines(item)) {
            const match = line.match(/Your\s+Exp\s+Level:\s*(\d+)/i);
            if (match) return parseInt(match[1], 10);
        }
        return 0;
    }

    getChronomatronRound(items) {
        const name = ChatLib.removeFormatting(items[4]?.getName());
        const match = name?.match(/Round:\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    getLoreLines(item) {
        return item?.getLore()?.map((line) => ChatLib.removeFormatting(line)) ?? [];
    }

    reset() {
        this.ultrasequencerOrder.clear();
        this.chronomatronOrder = [];
        this.ultraPatternCaptured = false;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.lastClickTime = Date.now();
        this.buyXpTargetLevel = 0;
        this.boughtXP = false;
        this.state = STATES.WAITING;
    }

    isDye(item) {
        const name = ChatLib.removeFormatting(item?.getName());
        return name && /^\d+$/.test(name);
    }

    isLocked(item) {
        return item?.getLore()?.join(' ').includes('Enchanting level too low!') ?? true;
    }

    isCompleted(item) {
        if (!item) return true;
        const lore = item.getLore()?.join(' ') ?? '';
        return lore.includes('Experiment completed') || lore.includes('Add-on locked!');
    }

    onCooldown(item) {
        return item?.getLore()?.join(' ').includes('Experiments on cooldown!') ?? true;
    }
}

new AutoExperiments();
