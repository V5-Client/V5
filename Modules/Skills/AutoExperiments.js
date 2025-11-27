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

        this.ultrasequencerOrder = new Map();
        this.chronomatronOrder = [];
        this.lastClickTime = 0;
        this.ultraPatternCaptured = false;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.reopenStep = 0;
        this.buyXpTargetLevel = 0;
        this.buyXpPending = false;
        this.maxEnchanting = false;

        this.STATES = {
            WAITING: 0,
            DECIDING: 1,
            ULTRASEQUENCER: 2,
            CHRONOMATRON: 3,
            SUPERPAIRS: 4,
            EXPERIMENT_OVER: 5,
            REOPENING: 6,
            BUYING_XP: 7,
        };

        this.state = this.STATES.WAITING;

        //this.on('guiClosed', () => this.reset());

        this.on('tick', () => {
            if (this.state === this.STATES.REOPENING) {
                this.handleReopening();
                return;
            }

            const container = Player.getContainer();
            if (!container) return;

            const containerName = ChatLib.removeFormatting(container.getName());
            if (!containerName) return;

            const items = container.getItems();
            if (!items) return;

            this.detectState(containerName);

            switch (this.state) {
                case this.STATES.EXPERIMENT_OVER:
                    Chat.message('&aExperiment completed! Claiming...');
                    this.startReopenSequence();
                    break;
                case this.STATES.DECIDING:
                    if (!this.canClick()) return;

                    const chronomatronItem = items[21];
                    const ultrasequencerItem = items[23];

                    if (this.onCooldown(items[SLOTS.SUPERPAIRS])) {
                        Guis.closeInv();
                        Chat.message('Experiments complete');
                        return;
                    } else if (this.renewRequired(items)) {
                        this.renewExperiments(items);
                        return;
                    } else if (this.isSelection('Chronomatron', containerName)) {
                        this.selectHighestAvailableStake(items, [24, 23, 22, 21, 20]);
                        return;
                    } else if (this.isSelection('Ultrasequencer', containerName)) {
                        this.selectHighestAvailableStake(items, [23, 22, 21]);
                        return;
                    } else if (!this.isCompleted(chronomatronItem)) {
                        if (Guis.clickSlot(SLOTS.CHRONOMATRON, false, 'MIDDLE')) this.lastClickTime = Date.now();
                        return;
                    } else if (!this.isCompleted(ultrasequencerItem)) {
                        if (Guis.clickSlot(SLOTS.ULTRASEQUENCER, false, 'MIDDLE')) this.lastClickTime = Date.now();
                        return;
                    } else if (this.isSelection('Superpairs', containerName)) {
                        // auto superpairs todo
                    } else {
                        if (Guis.clickSlot(SLOTS.SUPERPAIRS, false, 'MIDDLE')) this.lastClickTime = Date.now();
                        Chat.message('Superpairs ready');
                        return;
                    }
                    break;
                case this.STATES.ULTRASEQUENCER: {
                    const maxDepth = this.getMaxXpEnabled ? 20 : this.maxEnchanting ? 9 - this.serumCountValue : 7 - this.serumCountValue;
                    const control = this.getControlState(items);
                    if (!control) return;

                    if (control.isGlow && !this.ultraPatternCaptured) {
                        if (!items[44]) return;
                        this.captureUltrasequencerOrder(items);
                        this.ultraPatternCaptured = true;
                        this.clicks = 0;

                        if (this.ultrasequencerOrder.size > maxDepth) {
                            Guis.closeInv();
                        }
                    }

                    if (control.isClock && this.ultraPatternCaptured && this.canClick() && this.ultrasequencerOrder.has(this.clicks)) {
                        const slot = this.ultrasequencerOrder.get(this.clicks);
                        if (!this.canClick()) return;
                        if (Guis.clickSlot(slot, false, 'MIDDLE')) {
                            this.lastClickTime = Date.now();
                            this.clicks++;
                        }
                    }

                    if (control.isGlow && control.wasClockLastFrame) {
                        this.ultraPatternCaptured = false;
                    }

                    this.lastSlot49Item = control.name;
                    break;
                }
                case this.STATES.CHRONOMATRON: {
                    const maxDepth = this.getMaxXpEnabled ? 20 : this.maxEnchanting ? 12 - this.serumCountValue : 9 - this.serumCountValue;
                    const control = this.getControlState(items);
                    if (!control) return;

                    const guiRound = this.getChronomatronRound(items);
                    const expectedLen = Math.min(maxDepth, guiRound || (this.chronomatronOrder.length || 0) + 1);

                    if (guiRound - 1 === maxDepth) {
                        Guis.closeInv();
                    }
                    if (control.isClock && this.chronomatronOrder.length < expectedLen) {
                        this.clicks = 0;
                        for (let i = 9; i <= 44; i++) {
                            const it = items[i];
                            if (it && it.toMC().hasGlint()) {
                                this.chronomatronOrder.push(i);
                                break;
                            }
                        }
                    } else if (control.isClock && this.chronomatronOrder.length > this.clicks && this.canClick()) {
                        const slot = this.chronomatronOrder[this.clicks];
                        if (!this.canClick()) return;
                        if (Guis.clickSlot(slot, false, 'LEFT')) {
                            this.lastClickTime = Date.now();
                            this.clicks++;
                        }
                    }

                    if (control.isGlow && this.clicks >= this.chronomatronOrder.length && this.chronomatronOrder.length > 0) {
                        this.clicks = 0;
                    }

                    this.lastSlot49Item = control.name;
                    break;
                }
                case this.STATES.BUYING_XP:
                    if (this.buyXpTargetLevel === 0) return;

                    const currentLevel = this.extractXpLevel(items[SLOTS.GRAND_BOTTLE]);

                    if (currentLevel >= this.buyXpTargetLevel) {
                        this.buyXpTargetLevel = 0;
                        this.buyXpPending = false;
                        this.startReopenSequence();
                        return;
                    }

                    const purchaseSlot = this.buyXpTargetLevel <= 100 ? SLOTS.GRAND_BOTTLE : SLOTS.TITANIC_BOTTLE;
                    if (!items[purchaseSlot]) return;
                    if (!this.canClick()) return;
                    if (Guis.clickSlot(purchaseSlot, false, 'MIDDLE')) {
                        this.lastClickTime = Date.now();
                    }
                    break;
            }
        });

        this.addSlider(
            'Action Delay (ms)',
            250,
            1000,
            500,
            (value) => {
                this.actionDelay = value;
            },
            'Delay in milliseconds between experiment clicks and table reopen steps.'
        );

        this.addSlider(
            'Serum Count',
            0,
            3,
            0,
            (value) => {
                this.serumCountValue = Math.floor(value);
            },
            'Consumed Metaphysical Serum count.'
        );

        this.addToggle(
            'Get Max XP',
            (value) => {
                this.getMaxXpEnabled = value;
            },
            'Solve Chronomatron to 15 and Ultrasequencer to 20 for max XP.'
        );
    }

    detectState(containerName) {
        switch (true) {
            case containerName === 'Experiment Over':
                if (this.state === this.STATES.EXPERIMENT_OVER) return;
                this.state = this.STATES.EXPERIMENT_OVER;
                this.lastClickTime = Date.now();
                break;
            case containerName.startsWith('Chronomatron ('):
                if (this.state === this.STATES.CHRONOMATRON) return;
                this.state = this.STATES.CHRONOMATRON;
                this.lastClickTime = Date.now();

                this.chronomatronOrder = [];
                this.clicks = 0;
                break;
            case containerName.startsWith('Ultrasequencer ('):
                if (this.state === this.STATES.ULTRASEQUENCER) return;
                this.state = this.STATES.ULTRASEQUENCER;
                this.lastClickTime = Date.now();

                this.ultraPatternCaptured = false;
                this.ultrasequencerOrder.clear();
                this.clicks = 0;
                this.lastSlot49Item = null;
                break;
            case containerName === 'Bottles of Enchanting':
                if (this.state === this.STATES.BUYING_XP) return;
                this.state = this.STATES.BUYING_XP;
                this.lastClickTime = Date.now();

                this.buyXpPending = false;
                break;
            case containerName === 'Experimentation Table' || containerName === 'Chronomatron ➜ Stakes' || containerName === 'Ultrasequencer ➜ Stakes':
                if (this.state === this.STATES.DECIDING) return;
                this.state = this.STATES.DECIDING;
                this.lastClickTime = Date.now();

                this.lastSlot49Item = null;
                break;
            default:
                if (this.state === this.STATES.WAITING) return;
                this.state = this.STATES.WAITING;
                break;
        }
    }

    startReopenSequence() {
        this.reopenStep = 0;
        this.lastClickTime = Date.now();
        this.state = this.STATES.REOPENING;
    }

    handleReopening() {
        if (!this.canClick()) return;

        switch (this.reopenStep) {
            case 0:
                Guis.closeInv();
                this.reopenStep = 1;
                this.lastClickTime = Date.now();
                break;
            case 1:
                this.reopenStep = 2;
                this.lastClickTime = Date.now();
                break;
            case 2:
                Chat.message('&aReopening Experimentation Table...');
                Keybind.rightClick();
                this.reset();
                break;
        }
    }

    getControlState(items) {
        const slot49 = items[SLOTS.CONTROL];
        if (!slot49) {
            return null;
        }

        const isGlow = this.isGlowstone(slot49);
        const isClock = this.isClock(slot49);
        const name = ChatLib.removeFormatting(slot49.getName());
        const wasClockLastFrame = this.lastSlot49Item && this.lastSlot49Item.startsWith('Timer:');
        return { item: slot49, isGlow, isClock, name, wasClockLastFrame };
    }

    captureUltrasequencerOrder(items) {
        this.ultrasequencerOrder.clear();
        for (let i = 9; i <= 44; i++) {
            if (items[i] && this.isDye(items[i])) {
                const stackSize = items[i].getStackSize();
                const orderNumber = stackSize - 1;
                this.ultrasequencerOrder.set(orderNumber, i);
            }
        }
    }

    selectHighestAvailableStake(items, slots) {
        for (const slot of slots) {
            const item = items[slot];
            const locked = item ? this.isLocked(item) : true;
            if (item && !locked) {
                if (slot === 24) this.maxEnchanting = true;
                if (Guis.clickSlot(slot, false, 'MIDDLE')) {
                    this.lastClickTime = Date.now();
                    return true;
                }
            }
        }
        return false;
    }

    renewRequired(items) {
        const renewItem = items[31];
        if (!renewItem) return false;
        const name = ChatLib.removeFormatting(renewItem.getName());
        if (name && name.includes('Renew Experiments')) return true;
        else return false;
    }

    renewExperiments(items) {
        const renewItem = items[31];
        if (!renewItem) return;
        const lore = this.getLoreLines(renewItem);

        for (line of lore) {
            if (line.toLowerCase().includes('click to purchase')) {
                if (Guis.clickSlot(SLOTS.RENEW, false, 'MIDDLE')) {
                    this.lastClickTime = Date.now();
                    return;
                }
                return;
            } else if (line.toLowerCase().includes('cannot afford this!')) {
                this.buyXpTargetLevel = this.extractRenewCost(renewItem);
                if (Guis.clickSlot(SLOTS.BOTTLE_MENU, false, 'MIDDLE')) {
                    this.lastClickTime = Date.now();
                    this.buyXpPending = true;
                    return true;
                }
            }
        }
        return;
    }

    canClick() {
        return Date.now() - this.lastClickTime >= this.actionDelay;
    }

    isSelection(name, containerName) {
        if (!containerName.includes(name)) return false;
        if (containerName.includes('Stakes')) return true;
        return !containerName.includes('(') && !containerName.includes('➜');
    }

    isChronomatronGame(containerName) {
        if (!containerName.includes('Chronomatron')) return false;
        if (containerName.startsWith('Chronomatron (')) return true;
        return containerName.includes('➜') && !containerName.includes('Stakes');
    }

    isUltrasequencerGame(containerName) {
        if (!containerName.includes('Ultrasequencer')) return false;
        if (containerName.startsWith('Ultrasequencer (')) return true;
        return containerName.includes('➜') && !containerName.includes('Stakes');
    }

    extractRenewCost(item) {
        const loreLines = this.getLoreLines(item);

        // "000 XP Levels"
        for (const line of loreLines) {
            const m = line.match(/(\d+)\s*XP\s*Levels?/i);
            if (m) return parseInt(m[1], 10);
        }
    }

    extractXpLevel(item) {
        const loreLines = this.getLoreLines(item);
        for (const line of loreLines) {
            const m = line.match(/Your\s+Exp\s+Level:\s*(\d+)/i);
            if (m) return parseInt(m[1], 10);
        }
        return null;
    }

    getChronomatronRound(items) {
        const name = ChatLib.removeFormatting(items[4]?.getName());
        const m = name.match(/Round:\s*(\d+)/i);
        return m ? parseInt(m[1], 10) : null;
    }

    getLoreLines(item) {
        if (!item) return [];
        const lore = item.getLore();
        if (lore) {
            return lore.map((line) => ChatLib.removeFormatting(line));
        }
        return null;
    }

    reset() {
        this.ultrasequencerOrder.clear();
        this.chronomatronOrder = [];
        this.ultraPatternCaptured = false;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.lastClickTime = Date.now();
        this.buyXpTargetLevel = 0;
        this.buyXpPending = false;
        this.state = this.STATES.WAITING;
    }

    isGlowstone(item) {
        if (!item || !item.getName) return false;
        const name = ChatLib.removeFormatting(item.getName());
        return name === 'Remember the pattern!';
    }

    isClock(item) {
        if (!item || !item.getName) return false;
        const name = ChatLib.removeFormatting(item.getName());
        return name.startsWith('Timer:');
    }

    isDye(item) {
        if (!item || !item.getName) return false;
        const name = ChatLib.removeFormatting(item.getName());
        return /^\d+$/.test(name);
    }

    isLocked(item) {
        if (!item || !item.getLore) return true;
        const lore = item.getLore();
        const loreText = lore.join(' ');
        return loreText.includes('Enchanting level too low!');
    }

    isCompleted(item) {
        if (!item || !item.getLore) return true;
        const lore = item.getLore();
        const loreText = lore.join(' ');
        if (loreText.includes('Experiment completed') || loreText.includes('Add-on locked!')) return true;
        return false;
    }

    onCooldown(item) {
        if (!item || !item.getLore) return true;
        const lore = item.getLore();
        const loreText = lore.join(' ');
        return loreText.includes('Experiments on cooldown!');
    }

    onEnable() {
        Chat.message('AutoExperiments &aEnabled');
    }

    onDisable() {
        Chat.message('AutoExperiments &cDisabled');
    }
}

export const ae = new AutoExperiments();
