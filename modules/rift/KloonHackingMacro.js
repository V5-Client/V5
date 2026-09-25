import { ModuleBase } from '../../utils/ModuleBase';
import { clickSlot, getGuiName } from '../../utils/player/Inventory';

const TERMINALS = [
    ['RED', -69, 65, -63],
    ['ORANGE', -44, 71, -62],
    ['YELLOW', -39, 71, -95],
    ['GREEN', -62, 71, -83],
    ['AQUA', -33, 70, -134.5],
    ['BLUE', -66.5, 72, -119],
    ['PURPLE', -89, 73, -115],
    ['PINK', -110, 73, -107],
];

class KloonHackingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Kloon Hacking Macro',
            subcategory: 'Rift',
            description: 'Automatically clicks matching Rift hacking rows and picks the terminal color.',
            tooltip: 'Automatically clicks matching Rift hacking rows and picks the terminal color.',
        });

        this.on('tick', () => this.tick());
        this.on('guiClosed', () => this.reset());
    }

    reset() {
        this.clickedRows = new Set();
        this.lastColorClick = 0;
    }

    onEnable() {
        this.reset();
    }

    tick() {
        const name = getGuiName();
        const items = Player.getContainer()?.getItems();
        if (!items) return;

        if (name === 'Hacking' || name === 'Hacking (As seen on CSI)') {
            for (let row = 0; row < 5; row++) {
                const target = items[2 + row]?.getStackSize();
                const slot = 11 + 10 * row;
                if (!target || items[slot]?.getStackSize() !== target) {
                    this.clickedRows.delete(row);
                    continue;
                }
                if (!this.clickedRows.has(row) && clickSlot(slot, false, 'MIDDLE')) this.clickedRows.add(row);
            }
            return;
        }

        if (name !== 'Hacked Terminal Color Picker' || Date.now() - this.lastColorClick < 500) return;
        const terminal = TERMINALS.find(([_, x, y, z]) => Math.hypot(Player.getX() - x, Player.getY() - y, Player.getZ() - z) < 8);
        if (!terminal) return;
        const slot = items.findIndex((item) => item?.getLore()?.some((line) => ChatLib.removeFormatting(line).includes(terminal[0])));
        if (slot >= 0 && clickSlot(slot)) this.lastColorClick = Date.now();
    }
}

new KloonHackingMacro();
