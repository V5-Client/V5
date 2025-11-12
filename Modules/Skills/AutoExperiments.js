import { ModuleBase } from '../../Utility/ModuleBase';
import { Guis } from '../../Utility/Inventory';
import { Chat } from '../../Utility/Chat';
import { Keybind } from '../../Utility/Keybinding';
class AutoExperiments extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Experiments',
            subcategory: 'Skills',
            description: 'Automatically do the Chronomatron and Ultrasequencer experiments.',
            tooltip: 'Automatically does the experiments',
        });

        this.clickDelay = 150;
        this.serumCountValue = 0;
        this.getMaxXpEnabled = false;

        this.bindToggleKey();

        this.ultrasequencerOrder = new Map();
        this.chronomatronOrder = [];
        this.lastClickTime = 0;
        this.hasAdded = false;
        this.lastAdded = 0;
        this.clicks = 0;
        this.lastSlot49Item = null;
        this.lastTableClickTime = 0;
        this.shouldRightClick = false;
        this.rightClickTime = 0;

        this.STATES = {
            WAITING: 0,
            DECIDING: 1,
            ULTRASEQUENCER: 2,
            CHRONOMATRON: 3,
            SUPERPAIRS: 4,
            EXPERIMENT_OVER: 5,
        };

        this.state = this.STATES.WAITING;

        this.on('guiClosed', () => this.reset());

        this.on('tick', () => {
            // Right click to reopen the table after claiming
            if (this.shouldRightClick && Date.now() - this.rightClickTime > 500) {
                Client.currentGui.close();
                Keybind.rightClick();
                this.shouldRightClick = false;
                Chat.message('§aReopening Experimentation Table...');
            }
        });

        this.on('guiRender', () => {
            const container = Player.getContainer();
            if (!container) return;

            const containerName = Guis.guiName();
            if (!containerName) return;

            const items = container.getItems();
            if (!items) return;

            if (containerName === 'Experimentation Table') this.state = this.STATES.DECIDING;
            if (containerName.includes('Chronomatron') && !containerName.includes('(')) this.state = this.STATES.DECIDING;
            if (containerName.startsWith('Chronomatron (')) this.state = this.STATES.CHRONOMATRON;
            if (containerName.startsWith('Ultrasequencer (')) this.state = this.STATES.ULTRASEQUENCER;
            if (containerName === 'Experiment Over') this.state = this.STATES.EXPERIMENT_OVER;

            switch (this.state) {
                case this.STATES.EXPERIMENT_OVER:
                    Chat.message('§aExperiment completed! Claiming...');
                    Guis.closeInv();
                    this.shouldRightClick = true;
                    this.rightClickTime = Date.now();
                    break;

                case this.STATES.DECIDING:
                    if (Date.now() - this.lastTableClickTime < 500) return;

                    // Check if we're in the Chronomatron selection screen
                    if (containerName.includes('Chronomatron') && !containerName.includes('(')) {
                        // Select highest available stakes thing
                        for (let slot = 24; slot >= 20; slot--) {
                            if (items[slot] && !this.isLocked(items[slot])) {
                                Chat.message(`§aSelecting Chronomatron stake at slot ${slot}...`);
                                Player.getContainer().click(slot, false, 'MIDDLE');
                                this.lastTableClickTime = Date.now();
                                return;
                            }
                        }
                        return;
                    }

                    // Check if we're in the Ultrasequencer selection screen
                    if (containerName.includes('Ultrasequencer') && !containerName.includes('(')) {
                        // Select highest available stakes thing
                        for (let slot = 23; slot >= 21; slot--) {
                            if (items[slot] && !this.isLocked(items[slot])) {
                                Chat.message(`§aSelecting Ultrasequencer stake at slot ${slot}...`);
                                Player.getContainer().click(slot, false, 'MIDDLE');
                                this.lastTableClickTime = Date.now();
                                return;
                            }
                        }
                        return;
                    }

                    const chronomatronCompleted = items[21] && this.isCompleted(items[21]);
                    const ultrasequencerCompleted = items[23] && this.isCompleted(items[23]);

                    // Try Chronomatron (slot 29) if not completed
                    if (!chronomatronCompleted && items[29]) {
                        const slot29Name = ChatLib.removeFormatting(items[29].getName());
                        if (slot29Name.includes('Chronomatron')) {
                            Chat.message('§aOpening Chronomatron...');
                            Player.getContainer().click(29, false, 'MIDDLE');
                            this.lastTableClickTime = Date.now();
                            return;
                        }
                    }

                    // Try Ultrasequencer (slot 33) if not completed
                    if (!ultrasequencerCompleted && items[33]) {
                        const slot33Name = ChatLib.removeFormatting(items[33].getName());
                        if (slot33Name.includes('Ultrasequencer')) {
                            Chat.message('§aStarting Ultrasequencer...');
                            Player.getContainer().click(33, false, 'MIDDLE');
                            this.lastTableClickTime = Date.now();
                            return;
                        }
                    }

                    if (chronomatronCompleted && ultrasequencerCompleted) {
                        Chat.message('§eAll experiments completed!');
                    }
                    break;

                case this.STATES.ULTRASEQUENCER:
                    const maxUltraSequencer = this.getMaxXpEnabled ? 20 : 9 - this.serumCountValue;

                    if (!items[49]) return;

                    const currentSlot49Name = ChatLib.removeFormatting(items[49].getName());
                    const isClock = this.isClock(items[49]);
                    const isGlow = this.isGlowstone(items[49]);

                    // build the order when the glowstone happens
                    if (isGlow && !this.hasAdded) {
                        if (!items[44]) return;

                        this.ultrasequencerOrder.clear();

                        for (let i = 9; i <= 44; i++) {
                            if (items[i] && this.isDye(items[i])) {
                                const stackSize = items[i].getStackSize();
                                const orderNumber = stackSize - 1;
                                this.ultrasequencerOrder.set(orderNumber, i);
                            }
                        }

                        this.hasAdded = true;
                        this.clicks = 0;

                        if (this.ultrasequencerOrder.size > maxUltraSequencer) {
                            Guis.closeInv();
                        }
                    }

                    // click when clock.
                    if (isClock && this.hasAdded && Date.now() - this.lastClickTime > this.clickDelay) {
                        if (this.ultrasequencerOrder.has(this.clicks)) {
                            const slot = this.ultrasequencerOrder.get(this.clicks);
                            Player.getContainer().click(slot, false, 'MIDDLE');
                            this.lastClickTime = Date.now();
                            this.clicks++;
                        }
                    }

                    // reset
                    const wasClockLastFrame = this.lastSlot49Item && this.lastSlot49Item.startsWith('Timer:');
                    if (isGlow && wasClockLastFrame) {
                        this.hasAdded = false;
                    }

                    this.lastSlot49Item = currentSlot49Name;
                    break;

                case this.STATES.CHRONOMATRON:
                    const maxChronomatron = this.getMaxXpEnabled ? 15 : 11 - this.serumCountValue;

                    if (items[49] && this.isGlowstone(items[49]) && items[this.lastAdded] && !items[this.lastAdded].toMC().hasGlint()) {
                        if (this.chronomatronOrder.length > maxChronomatron) {
                            Guis.closeInv();
                        }
                        this.hasAdded = false;
                    }

                    if (!this.hasAdded && items[49] && this.isClock(items[49])) {
                        for (let i = 10; i <= 43; i++) {
                            if (items[i] && items[i].toMC().hasGlint()) {
                                this.chronomatronOrder.push(i);
                                this.lastAdded = i;
                                this.hasAdded = true;
                                this.clicks = 0;
                                break;
                            }
                        }
                    }

                    if (
                        this.hasAdded &&
                        items[49] &&
                        this.isClock(items[49]) &&
                        this.chronomatronOrder.length > this.clicks &&
                        Date.now() - this.lastClickTime > this.clickDelay
                    ) {
                        const slot = this.chronomatronOrder[this.clicks];
                        Player.getContainer().click(slot, false, 'MIDDLE');
                        this.lastClickTime = Date.now();
                        this.clicks++;
                    }
                    break;
            }
        });

        this.addSlider(
            'Click Delay',
            150,
            600,
            150,
            (value) => {
                this.clickDelay = value;
            },
            'Time in ms between automatic test clicks.'
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

    reset() {
        if (this.ultrasequencerOrder.size === 0 && this.chronomatronOrder.length === 0) return;
        this.ultrasequencerOrder.clear();
        this.chronomatronOrder = [];
        this.hasAdded = false;
        this.lastAdded = 0;
        this.clicks = 0;
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
        return loreText.includes('Experiment completed');
    }

    onEnable() {
        Chat.message('AutoExperiments §aEnabled');
    }

    onDisable() {
        Chat.message('AutoExperiments §cDisabled');
    }
}

new AutoExperiments();
