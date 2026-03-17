//@Private
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

/**
 * @typedef {com.chattriggers.ctjs.api.inventory.Item} item
 * @typedef {Array<com.chattriggers.ctjs.api.inventory.Item | null | undefined>} items
 */

const TERMS = {
    IDLE: 0,
    MELODY: 1,
    NAME: 2,
    ORDER: 3,
    COLOUR: 4,
    PANES: 5,
    SAME: 6,
};

class AutoTerminals extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Terminals',
            subcategory: 'Other',
            description: 'Automatically do terminals.',
            tooltip: 'ez ban',
        });

        this.actionDelay = 500;
        this.lastOpen = Date.now();
        this.lastClick = Date.now();
        this.state = TERMS.IDLE;

        this.targetSlots = [];
        this.clickedSlots = [];

        this.on('tick', () => this.onTick());
        this.addSlider('Action Delay (ms)', 75, 1000, 500, (v) => (this.actionDelay = v), 'Delay in milliseconds between clicks.');
    }

    onTick() {
        const container = Player.getContainer();
        if (!container) return;
        const containerName = ChatLib.removeFormatting(container.getName());
        if (!containerName) return;
        this.detectTerminal(containerName);
        if (this.state === TERMS.IDLE) return;
        if (!this.canClick()) return;
        const items = container.getItems();
        if (!items) return;
        this.targetSlots = [];

        switch (this.state) {
            case TERMS.PANES:
                break;
            case TERMS.ORDER:
                break;
            case TERMS.NAME:
                const letter = containerName.match(/What starts with: '(\w+)'?/)[1];
                for (let i = 0; i <= 36; i++) {
                    let item = items[i];
                    if (item) {
                        let name = ChatLib.removeFormatting(item.getName());
                        if (name.startsWith(letter) && !item.toMC().hasGlint()) this.targetSlots.push(i);
                    }
                }
                break;
            case TERMS.COLOUR:
                break;
            case TERMS.MELODY:
                break;
        }

        for (let i = 0; i < this.targetSlots.length; i++) {
            const slot = this.targetSlots[i];
            if (slot === undefined) continue;
            if (this.clickedSlots.indexOf(slot) === -1) {
                this.clickedSlots.push(slot);
                Guis.clickSlot(slot);
                this.lastClick = Date.now();
                return;
            }
        }
        this.clickedSlots = [];
    }

    detectTerminal(name) {
        let newState = TERMS.IDLE;
        if (name === 'Correct all the panes!') newState = TERMS.PANES;
        else if (name === 'Click in order!') newState = TERMS.ORDER;
        else if (name.startsWith('What starts with: ')) newState = TERMS.NAME;
        else if (name.startsWith('Select all the ')) newState = TERMS.COLOUR;
        else if (name === 'Click the button on time!') newState = TERMS.MELODY;
        else if (name === 'Change all to same color!') newState = TERMS.SAME;
        if (newState === this.state) return;
        this.state = newState;
        this.lastOpen = Date.now();
        this.clickedSlots = [];
    }

    canClick() {
        if (Date.now() - this.lastOpen > 360 && Date.now() - this.lastClick > 210) {
            return true;
        }
        return false;
    }
}

new AutoTerminals();
