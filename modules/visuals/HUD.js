import { BORDER_WIDTH, CORNER_RADIUS, FontSizes, THEME, colorWithAlpha, drawRoundedRectangleWithBorder, drawText, getTextWidth } from '../../gui/Utils';
import { NVG } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { ServerInfo } from '../../utils/player/ServerInfo';

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

        this.addToggle('Edit Mode', (v) => (this.EDIT_MODE = !!v), 'When enabled, the overlays become draggable');
        this.addToggle('Stats Hud', (v) => (this.STATS_HUD = !!v), 'Shows FPS, TPS, Ping etc.');
        this.addToggle('Inventory Hud', (v) => (this.INVENTORY_HUD = !!v), 'Turns on the inventory Hud');

        this.positionConfig = Utils.getConfigFile('OverlayPositions/hud_positions.json') || {};
        this.stats = this.loadOverlayState('stats', { x: 10, y: 10, scale: 1.0 });
        this.inventory = this.loadOverlayState('inventory', { x: 50, y: 100, scale: 1.0 });

        this.on('renderOverlay', () => this.renderOverlay());
        this.on('clicked', (x, y, button, isPressed) => this.handleClick(x, y, button, isPressed));
        this.on('dragged', (dx, dy, x, y, button) => this.handleDrag(dx, dy, x, y, button));

        register('gameUnload', () => this.savePositions());
        register('guiClosed', () => this.savePositions());
    }

    onDisable() {
        this.savePositions();
    }

    isChatOpen() {
        const gui = Client.currentGui.get();
        if (!gui) return false;
        return gui.class.simpleName == 'class_408';
    }

    canEdit() {
        return this.EDIT_MODE && this.isChatOpen();
    }

    getMouseScaleFactor() {
        return Client.getMinecraft().getWindow().getScaleFactor();
    }

    loadOverlayState(key, defaults) {
        const saved = this.positionConfig?.[key] || {};
        const x = typeof saved.x === 'number' ? saved.x : defaults.x;
        const y = typeof saved.y === 'number' ? saved.y : defaults.y;
        const rawScale = typeof saved.scale === 'number' ? saved.scale : defaults.scale;
        const scale = this.clamp(rawScale, 0.5, 3.0);

        return {
            key,
            x,
            y,
            scale,

            width: 0,
            height: 0,

            dragging: false,
            scaling: false,
            dragOffsetX: 0,
            dragOffsetY: 0,

            scaleStartMouseX: 0,
            scaleStartScale: 1,
            scaleStartBaseW: 1,
            scaleStartBaseH: 1,
        };
    }

    getSaveData(overlay) {
        return {
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
        };
    }

    savePositions() {
        this.positionConfig = {
            stats: this.getSaveData(this.stats),
            inventory: this.getSaveData(this.inventory),
        };
        Utils.writeConfigFile('OverlayPositions/hud_positions.json', this.positionConfig);
    }

    clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    isInside(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    clampOverlayToScreen(overlay) {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw <= 0 || sh <= 0) return;

        const maxX = Math.max(0, sw - overlay.width);
        const maxY = Math.max(0, sh - overlay.height);
        overlay.x = this.clamp(overlay.x, 0, maxX);
        overlay.y = this.clamp(overlay.y, 0, maxY);
    }

    getHandleSizePx(scale) {
        const minHandlePx = 8;
        return Math.max(minHandlePx, 14 * scale);
    }

    drawMoveUI(x, y, width, height, scale) {
        const borderColor = Math.trunc(0x80ffffff);
        const cornerColor = Math.trunc(0xccffffff);
        const handleColor = Math.trunc(0xcc5099ff);

        const minLinePx = 1;
        const handleSize = this.getHandleSizePx(scale);
        const cornerSize = Math.max(4, 6 * scale);
        const lineThick = Math.max(minLinePx, 2 * scale);

        NVG.drawRect(x - lineThick, y - lineThick, width + lineThick * 2, lineThick, borderColor); // Top
        NVG.drawRect(x - lineThick, y + height, width + lineThick * 2, lineThick, borderColor); // Bottom
        NVG.drawRect(x - lineThick, y, lineThick, height, borderColor); // Left
        NVG.drawRect(x + width, y, lineThick, height, borderColor); // Right

        NVG.drawRect(x - lineThick, y - lineThick, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x + width - cornerSize + lineThick, y - lineThick, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x + width - cornerSize + lineThick, y + height, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x - lineThick, y + height, cornerSize, lineThick, cornerColor);

        const hx = x + width - handleSize;
        const hy = y + height - handleSize;
        NVG.drawRect(hx, hy, handleSize, handleSize, handleColor);

        const innerPadding = handleSize * (4 / 14);
        const innerSize = handleSize - innerPadding * 2;
        if (innerSize > 0) {
            NVG.drawRect(hx + innerPadding, hy + innerPadding, innerSize, innerSize, cornerColor);
        }
    }

    getTpsColor(tps) {
        if (tps > 19.8) return 0x00aa00;
        if (tps > 19) return 0x55ff55;
        if (tps > 17.5) return 0xffaa00;
        if (tps > 12) return 0xff5555;
        return 0xaa0000;
    }

    getPingColor(ping) {
        if (ping < 50) return 0x55ff55;
        if (ping < 100) return 0x00aa00;
        if (ping < 149) return 0xffff55;
        if (ping < 249) return 0xffaa00;
        return 0xff5555;
    }

    getStatsLines() {
        const fps = Client.getFPS();
        const ping = ServerInfo.getPing();
        const tps = ServerInfo.getTPS();

        return [
            { label: 'FPS', value: String(fps), color: 0xffffffff },
            { label: 'Ping', value: `${ping}ms`, color: (0xff000000 | this.getPingColor(ping)) >>> 0 },
            { label: 'TPS', value: tps.toFixed(2), color: (0xff000000 | this.getTpsColor(tps)) >>> 0 },
        ];
    }

    recalcStatsBounds() {
        const o = this.stats;
        const s = o.scale;
        const pad = 6 * s;
        const fontSize = FontSizes.MEDIUM * 1.25 * s;

        const lines = this.getStatsLines();
        let totalWidth = 0;
        const separator = ' | ';
        const separatorWidth = getTextWidth(separator, fontSize);
        const gap = 3 * s;

        lines.forEach((l, index) => {
            const labelW = getTextWidth(`${l.label}:`, fontSize);
            const valueW = getTextWidth(String(l.value), fontSize);
            l._width = labelW + gap + valueW;
            totalWidth += l._width;

            if (index < lines.length - 1) {
                totalWidth += separatorWidth;
            }
        });

        o.width = pad * 2 + totalWidth;
        o.height = pad * 2 + fontSize;

        this.clampOverlayToScreen(o);
    }

    recalcInventoryBounds() {
        const o = this.inventory;
        const s = o.scale;

        const cols = 9;
        const mainRows = 3;

        const pad = 6 * s;
        const slot = 18 * s;
        const gap = 4 * s;

        o.width = pad * 2 + cols * slot;
        o.height = pad * 2 + mainRows * slot + gap + slot;

        this.clampOverlayToScreen(o);
    }

    recalcAllBounds() {
        if (this.STATS_HUD) this.recalcStatsBounds();
        if (this.INVENTORY_HUD) this.recalcInventoryBounds();
    }

    drawStatsHud() {
        const o = this.stats;
        const s = o.scale;
        const pad = 6 * s;
        const fontSize = FontSizes.MEDIUM * 1.25 * s;

        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.92);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.35);

        drawRoundedRectangleWithBorder({
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
            radius: CORNER_RADIUS * 0.6 * s,
            color: bg,
            borderWidth: BORDER_WIDTH * s,
            borderColor: border,
        });

        const labelColor = colorWithAlpha(0xffffff, 0.7);
        const separatorColor = colorWithAlpha(0xffffff, 0.4);
        const lines = this.getStatsLines();

        const centerY = o.y + o.height / 2;
        let x = o.x + pad;

        const separator = ' | ';
        const separatorWidth = getTextWidth(separator, fontSize);
        const gap = 3 * s;

        lines.forEach((l, index) => {
            drawText(`${l.label}:`, x, centerY, fontSize, labelColor, 17);
            x += getTextWidth(`${l.label}:`, fontSize) + gap;

            drawText(String(l.value), x, centerY, fontSize, l.color, 17);
            x += getTextWidth(String(l.value), fontSize);

            if (index < lines.length - 1) {
                drawText(separator, x, centerY, fontSize, separatorColor, 17);
                x += separatorWidth;
            }
        });
    }

    drawInventoryHudBackground() {
        const o = this.inventory;
        const s = o.scale;

        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.9);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.25);

        drawRoundedRectangleWithBorder({
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
            radius: CORNER_RADIUS * 0.55 * s,
            color: bg,
            borderWidth: BORDER_WIDTH * s,
            borderColor: border,
        });

        const cols = 9;
        const mainRows = 3;
        const pad = 6 * s;
        const slot = 18 * s;
        const gap = 4 * s;
        const separatorThickness = Math.max(1, 1 * s);

        const gridStartX = o.x + pad;
        const mainStartY = o.y + pad;
        const rowWidth = cols * slot;

        const mainHotbarSeparatorY = mainStartY + mainRows * slot + gap / 2 - separatorThickness / 2;
        const halfWidth = rowWidth / 2;
        const centerColor = colorWithAlpha(THEME.ACCENT, 0.3);
        const edgeColor = colorWithAlpha(THEME.ACCENT, 0);

        NVG.drawGradientRect(gridStartX, mainHotbarSeparatorY, halfWidth, separatorThickness, edgeColor, centerColor, 'LeftToRight', 0);
        NVG.drawGradientRect(gridStartX + halfWidth, mainHotbarSeparatorY, halfWidth, separatorThickness, centerColor, edgeColor, 'LeftToRight', 0);
    }

    drawInventoryHudItems() {
        const inv = Player.getInventory();
        if (!inv) return;

        const items = inv.getItems();
        if (!items) return;

        const o = this.inventory;
        const s = o.scale;

        const cols = 9;
        const mainRows = 3;

        const pad = 6 * s;
        const slot = 18 * s;
        const gap = 4 * s;
        const iconPad = 1 * s;

        const hotbar = items.slice(0, 9);
        const main = items.slice(9, 36);

        const mainStartX = o.x + pad;
        const mainStartY = o.y + pad;
        const hotbarStartY = mainStartY + mainRows * slot + gap;

        main.forEach((item, i) => {
            if (!item) return;
            const row = Math.floor(i / cols);
            if (row >= mainRows) return;
            const col = i % cols;
            const x = mainStartX + col * slot + iconPad;
            const y = mainStartY + row * slot + iconPad;
            item.draw(x, y, s);
        });

        hotbar.forEach((item, i) => {
            if (!item) return;
            const x = mainStartX + i * slot + iconPad;
            const y = hotbarStartY + iconPad;
            item.draw(x, y, s);
        });
    }

    handleClick(x, y, button, isPressed) {
        if (!this.canEdit() || button !== 0) return;

        const mouseScale = this.getMouseScaleFactor();
        const mx = x / mouseScale;
        const my = y / mouseScale;

        this.recalcAllBounds();

        if (!isPressed) {
            const wasActive = this.stats.dragging || this.stats.scaling || this.inventory.dragging || this.inventory.scaling;

            this.stats.dragging = false;
            this.stats.scaling = false;
            this.inventory.dragging = false;
            this.inventory.scaling = false;

            if (wasActive) this.savePositions();
            return;
        }

        const overlays = [this.inventory, this.stats];
        const isVisible = (o) => (o.key === 'stats' ? this.STATS_HUD : this.INVENTORY_HUD);

        for (let i = overlays.length - 1; i >= 0; i--) {
            const o = overlays[i];
            if (!isVisible(o)) continue;

            const handleSize = this.getHandleSizePx(o.scale);

            if (this.isInside(mx, my, o.x + o.width - handleSize, o.y + o.height - handleSize, handleSize, handleSize)) {
                o.scaling = true;
                o.dragging = false;
                o.scaleStartMouseX = mx;
                o.scaleStartScale = o.scale;
                o.scaleStartBaseW = Math.max(1, o.width / Math.max(0.001, o.scale));
                o.scaleStartBaseH = Math.max(1, o.height / Math.max(0.001, o.scale));
                break;
            }

            if (this.isInside(mx, my, o.x, o.y, o.width, o.height)) {
                o.dragging = true;
                o.scaling = false;
                o.dragOffsetX = mx - o.x;
                o.dragOffsetY = my - o.y;
                break;
            }
        }
    }

    handleDrag(dx, dy, x, y, button) {
        if (!this.canEdit() || button !== 0) return;

        const mouseScale = this.getMouseScaleFactor();
        const mx = x / mouseScale;
        const my = y / mouseScale;

        this.recalcAllBounds();

        const overlays = [this.inventory, this.stats];

        for (let i = overlays.length - 1; i >= 0; i--) {
            const o = overlays[i];
            if (!o.dragging && !o.scaling) continue;

            if (o.dragging) {
                const sw = Renderer.screen.getWidth();
                const sh = Renderer.screen.getHeight();

                const newX = mx - o.dragOffsetX;
                const newY = my - o.dragOffsetY;

                const maxX = Math.max(0, sw - o.width);
                const maxY = Math.max(0, sh - o.height);

                o.x = this.clamp(newX, 0, maxX);
                o.y = this.clamp(newY, 0, maxY);
                break;
            }

            if (o.scaling) {
                const sw = Renderer.screen.getWidth();
                const sh = Renderer.screen.getHeight();

                const baseW = Math.max(1, o.scaleStartBaseW);
                const baseH = Math.max(1, o.scaleStartBaseH);

                const availableW = Math.max(1, sw - o.x);
                const availableH = Math.max(1, sh - o.y);
                const maxScale = Math.min(availableW / baseW, availableH / baseH, 3.0);

                const deltaX = mx - o.scaleStartMouseX;
                const newScale = o.scaleStartScale + deltaX / baseW;

                o.scale = this.clamp(newScale, 0.5, maxScale);
                break;
            }
        }
    }

    renderOverlay() {
        if (!this.STATS_HUD && !this.INVENTORY_HUD) return;

        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw <= 0 || sh <= 0) return;

        this.recalcAllBounds();

        try {
            NVG.beginFrame(sw, sh);
            if (this.INVENTORY_HUD) this.drawInventoryHudBackground();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        if (this.INVENTORY_HUD) {
            try {
                this.drawInventoryHudItems();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        try {
            NVG.beginFrame(sw, sh);
            if (this.STATS_HUD) this.drawStatsHud();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        if (this.canEdit()) {
            try {
                NVG.beginFrame(sw, sh);
                if (this.INVENTORY_HUD) this.drawMoveUI(this.inventory.x, this.inventory.y, this.inventory.width, this.inventory.height, this.inventory.scale);
                if (this.STATS_HUD) this.drawMoveUI(this.stats.x, this.stats.y, this.stats.width, this.stats.height, this.stats.scale);
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            } finally {
                try {
                    NVG.endFrame();
                } catch (e) {
                    console.error('V5 Caught error' + e + e.stack);
                }
            }
        }
    }
}

new HUD();
