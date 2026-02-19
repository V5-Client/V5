import { BORDER_WIDTH, CORNER_RADIUS, FontSizes, THEME, colorWithAlpha, drawRoundedRectangleWithBorder, drawText, getTextWidth } from '../../gui/Utils';
import { NVG } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { ServerInfo } from '../../utils/player/ServerInfo';
import { OverlayManager } from '../../gui/OverlayUtils';

class HUD extends ModuleBase {
    constructor() {
        super({
            name: 'HUD',
            subcategory: 'Visuals',
            description: 'Different GUI components',
            tooltip: 'GUI overlays like FPS counter or Inventory HUD',
            showEnabledToggle: true,
        });

        this.STATS_HUD = false;
        this.INVENTORY_HUD = false;

        this.addToggle('Stats Hud', (v) => (this.STATS_HUD = !!v), 'Shows FPS, TPS, Ping etc.');
        this.addToggle('Inventory Hud', (v) => (this.INVENTORY_HUD = !!v), 'Turns on the inventory Hud');

        this.positionConfig = Utils.getConfigFile('OverlayPositions/hud_positions.json') || {};
        this.stats = this.loadOverlayState('stats', { x: 10, y: 10, scale: 1.0 });
        this.inventory = this.loadOverlayState('inventory', { x: 50, y: 100, scale: 1.0 });

        this.on('renderOverlay', () => this.renderOverlay());

        register('gameUnload', () => this.savePositions());
        register('guiClosed', () => this.savePositions());
    }

    onDisable() {
        this.savePositions();
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
        };
    }

    getSaveData(overlay) {
        return {
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
        };
    }

    applyOverlayState(overlay, saved = {}) {
        if (typeof saved.x === 'number') overlay.x = saved.x;
        if (typeof saved.y === 'number') overlay.y = saved.y;
        if (typeof saved.scale === 'number') overlay.scale = this.clamp(saved.scale, 0.5, 3.0);
    }

    syncFromOverlayEditor() {
        const latest = Utils.getConfigFile('OverlayPositions/hud_positions.json');
        if (!latest || typeof latest !== 'object') return;

        if (latest.stats && typeof latest.stats === 'object') {
            this.applyOverlayState(this.stats, latest.stats);
        }

        if (latest.inventory && typeof latest.inventory === 'object') {
            this.applyOverlayState(this.inventory, latest.inventory);
        }

        this.positionConfig = latest;
    }

    savePositions() {
        this.syncFromOverlayEditor();
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

    getStatsLines() {
        const fps = Client.getFPS();
        const ping = ServerInfo.getPing();
        const tps = ServerInfo.getTPS();

        return [
            { label: 'FPS', value: String(fps), color: 0xffffffff },
            { label: 'Ping', value: `${ping}ms`, color: (0xff000000 | ServerInfo.getPingColor(ping)) >>> 0 },
            { label: 'TPS', value: tps.toFixed(2), color: (0xff000000 | ServerInfo.getTpsColor(tps)) >>> 0 },
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

    renderOverlay() {
        if (!this.STATS_HUD && !this.INVENTORY_HUD) return;
        if (OverlayManager.drawingGUI) return;

        this.syncFromOverlayEditor();

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
    }
}

new HUD();
