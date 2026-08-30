import { drawInventoryHudBackground, drawStatsHud, getInventoryHudBounds, getStatsHudBounds, getStatsHudLines } from '../../gui/OverlayRenderers';
import { ModuleBase } from '../../utils/ModuleBase';
import { getConfigFile, writeConfigFile } from '../../utils/Utils';
import { OverlayManager } from '../../gui/OverlayUtils';
import { GuiState } from '../../gui/core/GuiState';

const DrawContextHolder = com.chattriggers.ctjs.api.render.DrawContextHolder;
const SkijaPIP = com.chattriggers.ctjs.api.render.skia.SkijaPIP;

class HUD extends ModuleBase {
    constructor() {
        super({
            name: 'HUD',
            subcategory: 'Visuals',
            description: 'Different GUI components',
            tooltip: 'GUI overlays like FPS counter or Inventory HUD',
            showEnabledToggle: false,
        });

        this.STATS_HUD = true;
        this.INVENTORY_HUD = true;
        this.worldLoaded = World.isLoaded();

        this.addToggle('Stats Hud', (v) => (this.STATS_HUD = !!v), 'Shows FPS, TPS, Ping etc.', true);
        this.addToggle('Inventory Hud', (v) => (this.INVENTORY_HUD = !!v), 'Turns on the inventory Hud', true);

        this.positionConfig = getConfigFile('OverlayPositions/hud_positions.json') || {};
        this.stats = this.loadOverlayState('stats', { x: 10, y: 10, scale: 1.0 });
        this.inventory = this.loadOverlayState('inventory', {
            x: 50,
            y: 100,
            scale: 1.0,
        });

        this.when(
            () => this.INVENTORY_HUD,
            'renderOverlay',
            () => this.renderOverlay()
        );
        this.when(
            () => this.INVENTORY_HUD,
            'postGuiRender',
            () => this.renderOverlay()
        );
        this.inventoryBackgroundCallback = () => drawInventoryHudBackground(this.inventory);
        this.statsCallback = () => this.renderStatsOverlay();
        this.statsRegistration = null;

        register('gameUnload', () => this.savePositions());
        register('guiClosed', () => this.savePositions());
        register('tick', () => {
            this.worldLoaded = World.isLoaded();
            this.updateRenderRegistrations();
        });
        this.updateRenderRegistrations();
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
            x,
            y,
            scale,
            enabled: saved.enabled !== false,

            width: 0,
            height: 0,
        };
    }

    getSaveData(overlay) {
        return {
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
            enabled: overlay.enabled !== false,
        };
    }

    applyOverlayState(overlay, saved = {}) {
        if (typeof saved.x === 'number') overlay.x = saved.x;
        if (typeof saved.y === 'number') overlay.y = saved.y;
        if (typeof saved.scale === 'number') overlay.scale = this.clamp(saved.scale, 0.5, 3.0);
        if (typeof saved.enabled === 'boolean') overlay.enabled = saved.enabled;
    }

    syncFromOverlayEditor() {
        const latest = OverlayManager?.hudSettings;
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
        writeConfigFile('OverlayPositions/hud_positions.json', this.positionConfig);
    }

    clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    clampOverlayToScreen(overlay) {
        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();
        if (sw <= 0 || sh <= 0) return;

        const maxX = Math.max(0, sw - overlay.width);
        const maxY = Math.max(0, sh - overlay.height);
        overlay.x = Math.max(0, Math.min(maxX, overlay.x));
        overlay.y = Math.max(0, Math.min(maxY, overlay.y));
    }

    recalcStatsBounds() {
        const o = this.stats;
        Object.assign(o, getStatsHudBounds(o.scale));

        this.clampOverlayToScreen(o);
    }

    recalcInventoryBounds() {
        const o = this.inventory;
        Object.assign(o, getInventoryHudBounds(o.scale));

        this.clampOverlayToScreen(o);
    }

    prepareOverlay(enabled, recalc) {
        if (GuiState.myGui.isOpen() || OverlayManager.drawingGUI || !enabled || !this.worldLoaded) return false;

        if (Render2D.screen.getWidth() <= 0 || Render2D.screen.getHeight() <= 0) return false;

        recalc.call(this);
        return true;
    }

    updateRenderRegistrations() {
        this.syncFromOverlayEditor();
        const visible = this.worldLoaded && !GuiState.myGui.isOpen() && !OverlayManager.drawingGUI;
        if (visible && this.STATS_HUD && this.stats.enabled !== false && !this.statsRegistration) {
            this.statsRegistration = Render2D.registerV5Render(this.statsCallback);
        } else if ((!visible || !this.STATS_HUD || this.stats.enabled === false) && this.statsRegistration) {
            Render2D.unregisterV5Render(this.statsRegistration);
            this.statsRegistration = null;
        }
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
        if (!this.prepareOverlay(this.INVENTORY_HUD && this.inventory.enabled !== false, this.recalcInventoryBounds)) return;

        try {
            // ponytail: queue directly until Render2D exposes ordered callbacks.
            SkijaPIP.draw(DrawContextHolder.currentContext, this.inventoryBackgroundCallback, false);
            this.drawInventoryHudItems();
        } catch (e) {
            console.error(e);
        }
    }

    renderStatsOverlay() {
        if (!this.prepareOverlay(this.STATS_HUD && this.stats.enabled !== false, this.recalcStatsBounds)) return;
        try {
            drawStatsHud(this.stats, getStatsHudLines());
        } catch (e) {
            console.error(e);
        }
    }
}

new HUD();
