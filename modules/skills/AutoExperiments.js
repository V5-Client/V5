import { ModuleBase } from '../../utils/ModuleBase';
import { clickSlot, closeInventory } from '../../utils/player/Inventory';

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
    SUPERPAIRS_REWARDS: 8,
};

class AutoExperiments extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Experiments',
            subcategory: 'Skills',
            description: 'Automatically do Chronomatron, Ultrasequencer, and Superpairs experiments.',
            tooltip: 'Automatically does the experiments',
        });

        this.actionDelay = 500;
        this.serumCountValue = 0;
        this.getMaxXpEnabled = false;
        this.automaticSuperpairs = true;
        this.ignoreEnchantingXp = false;
        this.maxEnchanting = false;

        this.ultrasequencerOrder = new Map();
        this.chronomatronOrder = [];
        this.ultraPatternCaptured = false;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.lastClickTime = 0;
        this.reopeningStarted = false;
        this.buyXpTargetLevel = 0;
        this.boughtXP = false;
        this.state = STATES.WAITING;
        this.superpairsRewardsClaimed = false;
        this.superpairsCards = new Map();
        this.superpairsPendingSlot = null;
        this.superpairsCurrentKey = null;

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
        let ignoreEnchantingXpToggle;
        this.addToggle(
            'Automatic Superpairs',
            (v) => {
                this.automaticSuperpairs = v;
                ignoreEnchantingXpToggle.visible = v;
            },
            'Automatically play and claim Superpairs.',
            true
        );
        ignoreEnchantingXpToggle = this.addToggle(
            'Ignore Enchanting XP',
            (v) => (this.ignoreEnchantingXp = v),
            'Do not intentionally match Enchanting XP cards in Superpairs.'
        );
    }

    onTick() {
        if (this.state === STATES.REOPENING) return this.handleReopening();

        const container = Player.getContainer();
        if (!container) return;

        const containerName = ChatLib.removeFormatting(container.getName());
        if (!containerName) return;

        this.detectState(containerName);
        if (this.state === STATES.WAITING) return;

        const items = container.getItems();
        if (!items) return;

        switch (this.state) {
            case STATES.EXPERIMENT_OVER:
                this.message('&aExperiment completed! Claiming...');
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
            case STATES.SUPERPAIRS:
                if (this.automaticSuperpairs) this.handleSuperpairs(items);
                break;
            case STATES.SUPERPAIRS_REWARDS:
                if (this.automaticSuperpairs) this.handleSuperpairsRewards(items);
                break;
        }
    }

    detectState(name) {
        let newState = STATES.WAITING;

        if (name === 'Experiment Over') newState = STATES.EXPERIMENT_OVER;
        else if (name.startsWith('Chronomatron (')) newState = STATES.CHRONOMATRON;
        else if (name.startsWith('Ultrasequencer (')) newState = STATES.ULTRASEQUENCER;
        else if (name.startsWith('Superpairs (')) newState = STATES.SUPERPAIRS;
        else if (name === 'Superpairs Rewards') newState = STATES.SUPERPAIRS_REWARDS;
        else if (name === 'Bottles of Enchanting') newState = STATES.BUYING_XP;
        else if (name === 'Experimentation Table' || name.endsWith('Stakes')) newState = STATES.DECIDING;

        if (newState === this.state) return;

        this.state = newState;
        this.lastClickTime = Date.now();

        switch (newState) {
            case STATES.CHRONOMATRON:
                this.chronomatronOrder = [];
                this.clicks = 0;
                break;
            case STATES.ULTRASEQUENCER:
                this.ultraPatternCaptured = false;
                this.ultrasequencerOrder.clear();
                this.clicks = 0;
                this.lastSlot49Item = null;
                break;
            case STATES.SUPERPAIRS:
                this.superpairsCards.clear();
                this.superpairsPendingSlot = null;
                this.superpairsCurrentKey = null;
                break;
            case STATES.DECIDING:
                this.lastSlot49Item = null;
                break;
        }
    }

    handleDeciding(items, containerName) {
        if (!this.canClick()) return;

        if (this.renewRequired(items)) return this.renewExperiments(items);

        if (this.buyXpTargetLevel > 0) return this._clickSlot(SLOTS.BOTTLE_MENU);

        if (this.onCooldown(items[SLOTS.SUPERPAIRS])) {
            closeInventory();
            this.reset();
            return this.message('Experiments complete');
        }

        if (this.isStakeSelection('Chronomatron', containerName)) return this.selectHighestStake(items, [24, 23, 22, 21, 20]);
        if (this.isStakeSelection('Ultrasequencer', containerName)) return this.selectHighestStake(items, [23, 22, 21]);
        if (this.isStakeSelection('Superpairs', containerName)) return this.automaticSuperpairs && this.selectSuperpairsStake(items);

        if (!this.isCompleted(items[21])) return this._clickSlot(SLOTS.CHRONOMATRON);
        if (!this.isCompleted(items[23])) return this._clickSlot(SLOTS.ULTRASEQUENCER);

        if (!this.automaticSuperpairs) {
            closeInventory();
            this.reset();
            return this.message('Experiments complete');
        }

        this._clickSlot(SLOTS.SUPERPAIRS);
        this.message('Superpairs ready');
    }

    handleUltrasequencer(items) {
        const maxDepth = this.getMaxDepth(7, 9, 20);
        const control = this.getControlState(items);
        if (!control) return;

        if (control.isGlow && !this.ultraPatternCaptured && items[44]) {
            this.captureUltrasequencerOrder(items);
            this.ultraPatternCaptured = true;
            this.clicks = 0;
            if (this.ultrasequencerOrder.size > maxDepth) closeInventory();
        }

        if (control.isClock && this.ultraPatternCaptured && this.canClick() && this.ultrasequencerOrder.has(this.clicks)) {
            if (this._clickSlot(this.ultrasequencerOrder.get(this.clicks))) this.clicks++;
        }

        if (control.isGlow && control.wasClockLastFrame) this.ultraPatternCaptured = false;

        this.lastSlot49Item = control.name;
    }

    handleChronomatron(items) {
        const maxDepth = this.getMaxDepth(9, 12, 15);
        const control = this.getControlState(items);
        if (!control) return;

        const guiRound = this.getChronomatronRound(items);
        const expectedLen = Math.min(maxDepth, guiRound || this.chronomatronOrder.length + 1);

        if (guiRound && guiRound - 1 === maxDepth) closeInventory();

        if (control.isClock && this.chronomatronOrder.length < expectedLen) {
            this.clicks = 0;
            for (let i = 9; i <= 44; i++) {
                const item = items[i];
                if (item) {
                    const mc = item.toMC();
                    if (mc && mc.hasFoil()) {
                        this.chronomatronOrder.push(i);
                        break;
                    }
                }
            }
        } else if (control.isClock && this.chronomatronOrder.length > this.clicks && this.canClick()) {
            if (this._clickSlot(this.chronomatronOrder[this.clicks], 'LEFT')) this.clicks++;
        }

        if (control.isGlow && this.clicks >= this.chronomatronOrder.length && this.chronomatronOrder.length > 0) {
            this.clicks = 0;
        }

        this.lastSlot49Item = control.name;
    }

    handleSuperpairs(items) {
        const proceedSlot = items.findIndex(
            (item, slot) => slot >= 9 && slot <= 44 && this.getLoreLines(item).some((line) => line.includes('Click any to proceed!'))
        );
        if (proceedSlot !== -1) {
            if (this.canClick()) this._clickSlot(proceedSlot, 'LEFT');
            return;
        }

        if (this.superpairsPendingSlot !== null) {
            const item = items[this.superpairsPendingSlot];
            if (!item || this.isSuperpairsHidden(item)) {
                if (item && Date.now() - this.lastClickTime >= Math.max(this.actionDelay, 1000)) {
                    this._clickSlot(this.superpairsPendingSlot);
                }
                return;
            }

            const ignored = this.isSuperpairsPowerup(item) || (this.ignoreEnchantingXp && ChatLib.removeFormatting(item.getName()).includes('Enchanting Exp'));
            this.superpairsCurrentKey = ignored ? null : this.getSuperpairsKey(item);
            this.superpairsCards.set(this.superpairsPendingSlot, this.superpairsCurrentKey);
            this.superpairsPendingSlot = null;
        }

        if (!this.canClick()) return;

        const hiddenSlots = [];
        const knownByKey = new Map();
        let knownPairSlot = null;

        for (let slot = 9; slot <= 44; slot++) {
            if (slot === this.superpairsPendingSlot || !this.isSuperpairsHidden(items[slot])) continue;
            hiddenSlots.push(slot);

            const key = this.superpairsCards.get(slot);
            if (!key) continue;
            if (knownByKey.has(key) && knownPairSlot === null) knownPairSlot = slot;
            else knownByKey.set(key, slot);
        }

        const choosingSecondCard = hiddenSlots.some((slot) => ChatLib.removeFormatting(items[slot].getName()) === 'Click a second button!');
        let nextSlot = choosingSecondCard ? null : knownPairSlot;
        if (choosingSecondCard && this.superpairsCurrentKey && knownByKey.has(this.superpairsCurrentKey)) {
            nextSlot = knownByKey.get(this.superpairsCurrentKey);
        }

        if (nextSlot === null) nextSlot = hiddenSlots.find((slot) => !this.superpairsCards.has(slot));
        if (nextSlot === undefined || nextSlot === null) nextSlot = hiddenSlots[0];

        if (nextSlot !== undefined && this._clickSlot(nextSlot)) this.superpairsPendingSlot = nextSlot;
    }

    getMaxDepth(normalDepth, maxEnchantingDepth, maxXpDepth) {
        if (this.getMaxXpEnabled) return maxXpDepth;
        return (this.maxEnchanting ? maxEnchantingDepth : normalDepth) - this.serumCountValue;
    }

    handleSuperpairsRewards(items) {
        if (this.superpairsRewardsClaimed) {
            this.superpairsRewardsClaimed = false;
            this.startReopenSequence();
            return;
        }

        const rewardItem = items[13];
        if (!rewardItem) return;

        const lore = rewardItem.getLore();
        if (this.canClick() && lore && lore.join(' ').includes('Click to claim rewards')) {
            this.message('&a[Superpairs] Claiming rewards...');
            this._clickSlot(13, 'LEFT');
            this.superpairsRewardsClaimed = true;
        }
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
            closeInventory();
            return this.message('Not enough bits!');
        }

        const slot = this.buyXpTargetLevel <= 100 ? SLOTS.GRAND_BOTTLE : SLOTS.TITANIC_BOTTLE;
        if (items[slot] && this.canClick() && this._clickSlot(slot)) this.boughtXP = true;
    }

    startReopenSequence() {
        this.reopeningStarted = false;
        this.lastClickTime = Date.now();
        this.state = STATES.REOPENING;
    }

    handleReopening() {
        if (!this.canClick()) return;

        if (!this.reopeningStarted) {
            closeInventory();
            this.reopeningStarted = true;
            this.lastClickTime = Date.now();
        } else {
            this.message('&aReopening Experimentation Table...');
            Client.rightClick();
            this.ultrasequencerOrder.clear();
            this.chronomatronOrder = [];
            this.ultraPatternCaptured = false;
            this.clicks = 0;
            this.lastSlot49Item = null;
            this.superpairsCards.clear();
            this.superpairsPendingSlot = null;
            this.superpairsCurrentKey = null;
            this.lastClickTime = Date.now();
            this.state = STATES.WAITING;
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
                return this._clickSlot(slot);
            }
        }
        return false;
    }

    selectSuperpairsStake(items) {
        const stakeSlots = [32, 31, 30, 23, 22, 21];

        for (const slot of stakeSlots) {
            const item = items[slot];
            if (!item || this.isLocked(item)) continue;

            const loreLines = this.getLoreLines(item);
            const lastLine = loreLines[loreLines.length - 1];

            if (lastLine && lastLine.includes('Click to play!')) {
                return this._clickSlot(slot);
            }

            if (lastLine && lastLine.includes('Not enough experience!')) {
                const requiredXp = this.extractStakeCost(item);
                if (requiredXp > 0) {
                    this.buyXpTargetLevel = requiredXp;
                    this.message('&eNeed more XP for Superpairs. Reopening to buy bottles...');
                    this.startReopenSequence();
                    return true;
                }
            }
        }
        return false;
    }

    extractStakeCost(item) {
        const loreLines = this.getLoreLines(item);
        for (const line of loreLines) {
            const match = line.match(/Starting\s+cost:\s*(\d+)\s*XP\s*Levels?/i);
            if (match) return Number.parseInt(match[1], 10);
        }
        return 0;
    }

    renewRequired(items) {
        const item = items[SLOTS.RENEW];
        if (!item) return false;
        const name = ChatLib.removeFormatting(item.getName());
        return name?.includes('Renew Experiments') ?? false;
    }

    renewExperiments(items) {
        for (const line of this.getLoreLines(items[SLOTS.RENEW])) {
            const lower = line.toLowerCase();
            if (lower.includes('click to purchase')) return this._clickSlot(SLOTS.RENEW);
            if (lower.includes('cannot afford this!')) {
                this.buyXpTargetLevel = this.extractRenewCost(items[SLOTS.RENEW]);
                return this._clickSlot(SLOTS.BOTTLE_MENU);
            }
        }
    }

    _clickSlot(slot, clickType = 'MIDDLE') {
        if (clickSlot(slot, false, clickType)) {
            this.lastClickTime = Date.now();
            return true;
        }
        return false;
    }

    canClick() {
        return Date.now() - this.lastClickTime >= this.actionDelay;
    }

    isStakeSelection(game, containerName) {
        const hasGameName = containerName.includes(game);
        const hasStakes = containerName.includes('Stakes');
        return hasGameName && hasStakes;
    }

    extractRenewCost(item) {
        const loreLines = this.getLoreLines(item);
        for (const line of loreLines) {
            const match = line.match(/(\d+)\s*XP\s*Levels?/i);
            if (match) return Number.parseInt(match[1], 10);
        }
        return 0;
    }

    extractXpLevel(item) {
        for (const line of this.getLoreLines(item)) {
            const match = line.match(/Your\s+Exp\s+Level:\s*(\d+)/i);
            if (match) return Number.parseInt(match[1], 10);
        }
        return 0;
    }

    getChronomatronRound(items) {
        const item = items[4];
        if (!item) return null;
        const name = ChatLib.removeFormatting(item.getName());
        if (!name) return null;
        const match = name.match(/Round:\s*(\d+)/i);
        return match ? Number.parseInt(match[1], 10) : null;
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
        this.maxEnchanting = false;
        this.superpairsRewardsClaimed = false;
        this.superpairsCards.clear();
        this.superpairsPendingSlot = null;
        this.superpairsCurrentKey = null;
    }

    isSuperpairsHidden(item) {
        const name = ChatLib.removeFormatting(item?.getName() ?? '');
        return name === '?' || name === 'Click any button!' || name === 'Click a second button!' || name === 'Next button is instantly rewarded!';
    }

    isSuperpairsPowerup(item) {
        return this.getLoreLines(item).some((line) => line.toLowerCase().includes('powerup'));
    }

    getSuperpairsKey(item) {
        return `${item.getType().getRegistryName()}|${item.getDamage()}|${item.getStackSize()}|${item.getNBT().toString()}`;
    }

    isDye(item) {
        if (!item) return false;
        const name = ChatLib.removeFormatting(item.getName());
        return name && /^\d+$/.test(name);
    }

    isLocked(item) {
        if (!item) return true;
        const lore = item.getLore();
        if (!lore) return true;
        return lore.join(' ').includes('Enchanting level too low!');
    }

    isCompleted(item) {
        if (!item) return true;
        const lore = item.getLore()?.join(' ') ?? '';
        return lore.includes('Experiment completed') || lore.includes('Add-on locked!');
    }

    onCooldown(item) {
        if (!item) return true;
        const lore = item.getLore();
        if (!lore) return true;
        return lore.join(' ').includes('Experiments on cooldown!');
    }
}

new AutoExperiments();
