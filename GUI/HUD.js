import { ModuleBase } from '../Utility/ModuleBase';
import { UIRoundedRectangle, Matrix, Color } from '../Utility/Constants';

class HUD extends ModuleBase {
    constructor() {
        super({
            name: 'HUD',
            subcategory: 'Visuals',
            description: 'Different GUI components',
            tooltip: 'GUI overlays like FPS counter or Inventory HUD',
            showEnabledToggle: true,
        });

        this.EDIT_MODE = false;
        this.STATS_HUD = false;
        this.INVENTORY_HUD = false;

        this.addToggle(
            'Edit Mode',
            (v) => {
                this.EDIT_MODE = v;
            },
            'When enabled, the overlays become draggable'
        );

        this.addToggle(
            'Stats Hud',
            (v) => {
                this.STATS_HUD = v;
            },
            'Shows Fps, Tps, Ping etc.'
        );

        this.addToggle(
            'Inventory Hud',
            (v) => {
                this.INVENTORY_HUD = v;
            },
            'Turns on the inventory Hud'
        );

        const LAYOUT = {
            pad: 1,
            slot: 10,
            titleH: 20,
            mainH: 60,
            scale: 0.9,
            cols: 9,
            rows: 3,
        };

        this.x = null;
        this.y = null;

        this.on('renderOverlay', () => {
            if (this.INVENTORY_HUD) {
                const { pad, slot, titleH, scale, cols, rows } = LAYOUT;

                const x = 50;
                const y = 100;

                const w = cols * slot + 2 * pad;
                const h = titleH + (rows + 1) * slot + 2 * pad;

                const r = 5;
                const c = new Color(0, 0, 0, 0.4);

                const PADDING = 1;

                // someone please fix this
                const bgX = x + 43;
                const bgY = y + 125;
                const bgWidth = x + w + 125;
                const bgLength = y + h + 143;

                UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, bgX - PADDING, bgY - PADDING, bgWidth + PADDING, bgLength + PADDING, r, c);

                const inv = Player.getInventory();
                if (!inv) return;

                const items = inv.getItems();
                const hotbar = items.slice(0, 9);
                const main = items.slice(9, 36);

                hotbar.forEach((item, i) => this.drawItems(item, x + pad + i * slot, y + titleH + pad + rows * slot, scale));

                main.forEach((item, i) => {
                    const row = Math.floor(i / cols);
                    if (row < rows) {
                        const col = i % cols;
                        this.drawItems(item, x + pad + col * slot, y + titleH + pad + row * slot, scale);
                    }
                });
            }
        });
    }

    drawItems(item, x, y, scale) {
        if (!item) return;
        item.draw(x, y, scale);
    }
}

new HUD();
