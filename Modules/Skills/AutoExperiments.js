import { ModuleBase } from '../../Utility/ModuleBase';
import { Guis } from '../../Utility/Inventory';
import { Chat } from '../../Utility/Chat';

// maybe automate clicks between each activity when on the table? idk

class AutoExperiments extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Experiments',
            subcategory: 'Skills',
            description: 'Automatically do the Chronomatron and Ultrasequencer experiments.',
            tooltip: 'Automatically does the experiments',
        });

        this.clickDelay = 500;
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

        this.STATES = {
            WAITING: 0,
            DECIDING: 1,
            ULTRASEQUENCER: 2,
            CHRONOMATRON: 3,
            SUPERPAIRS: 4, // do this thingy
        };

        this.state = this.STATES.WAITING;

        this.on('guiClosed', () => this.reset());

        this.on('guiRender', () => {
            const container = Player.getContainer();
            if (!container) return;

            const containerName = Guis.guiName();
            if (!containerName) return;

            const items = container.getItems();
            if (!items) return;

            if (containerName.startsWith('Chronomatron (')) this.state = this.STATES.CHRONOMATRON;
            if (containerName.startsWith('Ultrasequencer (')) this.state = this.STATES.ULTRASEQUENCER;

            switch (this.state) {
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
                            ChatLib.chat(items[i].toMC().hasGlint());
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
            500,
            1000,
            500,
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

    onEnable() {
        Chat.message('AutoExperiments §aEnabled');
    }

    onDisable() {
        Chat.message('AutoExperiments §cDisabled');
    }
}

new AutoExperiments();
