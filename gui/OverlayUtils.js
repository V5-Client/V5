import { Utils } from '../utils/Utils';
import { NVG } from '../utils/Constants';
import {
    drawText,
    getTextWidth,
    FontSizes,
    THEME,
    isInside,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    colorWithAlpha,
    drawRect,
    drawShadow,
    PADDING,
    BORDER_WIDTH,
    CORNER_RADIUS,
} from './Utils';
import { Overlays, GuiState } from './core/GuiState';

const { loadSettings } = require('./GuiSave');

class OverlayUtils {
    constructor() {
        this.ids = [];
        this.draggingId = null;
        this.dragOffset = { x: 0, y: 0 };
        this.scale = 1.2;
        this.boxPadding = (PADDING || 25) * this.scale;
        this.minBoxHeight = 35 * this.scale;
        this.fontSize = FontSizes.LARGE * this.scale;
        this.argFontSize = FontSizes.MEDIUM * this.scale;
        this.startTimes = {};
        this.animations = {};
        this.stepTrigger = null;
        this.drawRegistered = false;
        this.pendingSave = false;

        this.mainRenderTrigger = register('renderOverlay', () => {
            if (Overlays.Gui.isOpen()) return;
            this.drawAllOverlays();
        }).unregister();

        this.loadIDs();
        this.initTriggers();

        if (this.ids.length > 0) {
            this.registerDrawOnce();
        }
    }

    ensureArray(val) {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object') {
            return Object.values(val).filter((item) => item && typeof item === 'object');
        }
        return [];
    }

    startAnimationLoop() {
        if (this.stepTrigger) return;
        this.stepTrigger = register('step', () => {
            let activeAnimations = 0;
            for (let name in this.animations) {
                let anim = this.animations[name];
                let diff = anim.target - anim.progress;
                if (Math.abs(diff) > 0.001) {
                    activeAnimations++;
                    anim.progress += diff * 0.12;
                } else {
                    anim.progress = anim.target;
                }
            }
            const needsToRun = Object.values(this.animations).some((a) => a.target > 0 || a.progress > 0.01);
            if (activeAnimations === 0 && !needsToRun) {
                if (this.stepTrigger) {
                    this.stepTrigger.unregister();
                    this.stepTrigger = null;
                }
            }
        }).setFps(60);
    }

    startTime(idName) {
        this.startTimes[idName] = Date.now();
        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 1 };
        } else {
            this.animations[idName].target = 1;
        }
        if (!this.mainRenderTrigger.isRegistered()) {
            this.mainRenderTrigger.register();
        }
        this.startAnimationLoop();
    }

    resetTime(idName) {
        if (this.animations[idName]) {
            this.animations[idName].target = 0;
        }
        this.startAnimationLoop();
    }

    deleteID(idName) {
        this.ids = this.ids.filter((id) => id.name !== idName);
        delete this.animations[idName];
        delete this.startTimes[idName];
        this.saveIDs();
    }

    formatUptime(startTime) {
        if (!startTime) return '0.00s';
        const diff = Date.now() - startTime;
        const totalSeconds = Math.floor(diff / 1000);

        const s = totalSeconds % 60;
        const m = Math.floor(totalSeconds / 60) % 60;
        const h = Math.floor(totalSeconds / 3600) % 24;
        const d = Math.floor(totalSeconds / 86400);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);

        if (totalSeconds < 60) {
            const ms = Math.floor((diff % 1000) / 10);
            const msStr = String(ms).padStart(2, '0');
            parts.push(`${s}.${msStr}s`);
        } else {
            parts.push(`${s}s`);
        }

        return parts.join(' ');
    }

    initTriggers() {
        Overlays.Gui.registerClosed(() => {
            if (this.pendingSave) {
                this.saveIDs();
                this.pendingSave = false;
            }
            openModuleGui();
        });
        Overlays.Gui.registerClicked((x, y, b) => b === 0 && this.handleMouseClick(x, y));
        Overlays.Gui.registerMouseDragged((x, y, b) => b === 0 && this.handleMouseDrag(x, y));
        Overlays.Gui.registerMouseReleased(() => this.handleMouseRelease());
    }

    registerDrawOnce() {
        if (this.drawRegistered) return;
        Overlays.Gui.registerDraw(() => this.drawGUI());
        this.drawRegistered = true;
    }

    createID(idName, sections = []) {
        const sectionsArray = this.ensureArray(sections);
        let existing = this.ids.find((id) => id.name === idName);

        if (existing) {
            existing.sections = sectionsArray;
        } else {
            const textWidth = getTextWidth(idName, this.fontSize);
            const width = Math.max(200 * this.scale, textWidth + this.boxPadding * 2);

            const newId = {
                name: idName,
                sections: sectionsArray,
                x: 10,
                y: 10,
                width: width,
                height: this.minBoxHeight,
            };

            this.ids.push(newId);
            this.saveIDs();
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 0 };
        }
    }

    handleMouseClick(mouseX, mouseY) {
        for (let i = this.ids.length - 1; i >= 0; i--) {
            const id = this.ids[i];
            if (isInside(mouseX, mouseY, id)) {
                this.draggingId = id;
                this.dragOffset.x = mouseX - id.x;
                this.dragOffset.y = mouseY - id.y;
                break;
            }
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.draggingId) return;
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        this.draggingId.x = Math.max(0, Math.min(mouseX - this.dragOffset.x, sw - this.draggingId.width));
        this.draggingId.y = Math.max(0, Math.min(mouseY - this.dragOffset.y, sh - this.draggingId.height));
        this.pendingSave = true;
    }

    handleMouseRelease() {
        if (this.draggingId) {
            this.draggingId = null;
            this.saveIDs();
            this.pendingSave = false;
        }
    }

    clampToScreen(id) {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || sh === 0) return;
        id.x = Math.max(0, Math.min(id.x, sw - id.width));
        id.y = Math.max(0, Math.min(id.y, sh - id.height));
    }

    drawAccentGlow(x, y, width, height, radius, progress) {
        const accentColor = THEME.ACCENT;
        const glowIntensity = 0.12;
        for (let i = 3; i >= 0; i--) {
            const expand = i * 2;
            const alpha = (glowIntensity - i * 0.025) * progress;
            if (alpha <= 0) continue;
            drawRoundedRectangle({
                x: x - expand,
                y: y - expand,
                width: width + expand * 2,
                height: height + expand * 2,
                radius: radius + expand,
                color: colorWithAlpha(accentColor, alpha),
            });
        }
    }

    drawSectionDivider(x, y, width, progress) {
        const accentColor = THEME.ACCENT;
        const dividerHeight = 1;
        const halfWidth = width / 2;

        const centerColor = colorWithAlpha(accentColor, 0.3 * progress);
        const edgeColor = colorWithAlpha(accentColor, 0);
        // left
        NVG.drawGradientRect(x, y, halfWidth, dividerHeight, edgeColor, centerColor, 'LeftToRight', 0);
        // right
        NVG.drawGradientRect(x + halfWidth, y, halfWidth, dividerHeight, centerColor, edgeColor, 'LeftToRight', 0);
    }

    renderID(id, forceGUI = false) {
        const anim = this.animations[id.name];
        let progress = anim ? anim.progress : 0;
        if (forceGUI) progress = 1.0;
        if (!forceGUI && (!anim || (anim.target === 0 && anim.progress <= 0.01))) return;

        const sections = this.ensureArray(id.sections);
        const uptimeVal = forceGUI ? '0.00s' : this.formatUptime(this.startTimes[id.name]);
        let maxWidth = getTextWidth(id.name, this.fontSize) + this.boxPadding * 3;
        let calculatedHeight = 30 * this.scale;

        sections.forEach((section, sIdx) => {
            if (!section || typeof section !== 'object') return;
            if (section.title) calculatedHeight += 16 * this.scale;
            calculatedHeight += 10 * this.scale;
            const sectionData = section.data || {};
            const entries = Object.entries(sectionData);
            entries.forEach(([k, v]) => {
                const val = typeof v === 'function' ? v() : v;
                const lineW = getTextWidth(`${k}:`, this.argFontSize) + getTextWidth(String(val), this.argFontSize) + 65 * this.scale;
                if (lineW > maxWidth) maxWidth = lineW;
            });
            if (sIdx === 0) {
                const lineW = getTextWidth(`Uptime:`, this.argFontSize) + getTextWidth(uptimeVal, this.argFontSize) + 65 * this.scale;
                if (lineW > maxWidth) maxWidth = lineW;
            }
            let lineCount = entries.length + (sIdx === 0 ? 1 : 0);
            calculatedHeight += lineCount * 14 * this.scale;
            calculatedHeight += 2 * this.scale;
        });
        calculatedHeight += 6 * this.scale;

        id.width = Math.max(220 * this.scale, maxWidth);
        id.height = Math.max(this.minBoxHeight, calculatedHeight);
        this.clampToScreen(id);
        const currentHeight = id.height * progress;
        const radius = CORNER_RADIUS * this.scale;
        const bgColor = colorWithAlpha(THEME.BG_OVERLAY, 0.95 * progress);

        drawShadow(id.x, id.y, id.width, currentHeight, 18 * this.scale, 0.45 * progress);
        drawRoundedRectangleWithBorder({
            x: id.x,
            y: id.y,
            width: id.width,
            height: currentHeight,
            radius: radius,
            color: bgColor,
            borderWidth: BORDER_WIDTH * this.scale,
            borderColor: colorWithAlpha(THEME.ACCENT_GLOW, 0.7 * progress),
        });

        this.drawAccentGlow(id.x, id.y, id.width, currentHeight, radius, progress * 0.4);

        if (progress > 0.1) {
            const contentAlpha = Math.min(1, progress * 3);

            try {
                NVG.scissor(id.x, id.y, id.width, currentHeight);
                const titleY = id.y + 20 * this.scale;
                const titleX = id.x + id.width / 2 - getTextWidth(id.name, this.fontSize) / 2;
                drawText(id.name, titleX + 1, titleY + 1, this.fontSize, colorWithAlpha(0x000000, 0.35 * contentAlpha), 16);
                drawText(id.name, titleX, titleY, this.fontSize, colorWithAlpha(0xffffff, contentAlpha), 16);

                let contentY = titleY + 10 * this.scale;
                sections.forEach((section, sIdx) => {
                    if (!section || typeof section !== 'object') return;
                    this.drawSectionDivider(id.x + 18 * this.scale, contentY, id.width - 36 * this.scale, contentAlpha);
                    contentY += 10 * this.scale;

                    if (section.title) {
                        drawText(
                            section.title.toUpperCase(),
                            id.x + 22 * this.scale,
                            contentY,
                            this.argFontSize * 0.85,
                            colorWithAlpha(THEME.ACCENT, contentAlpha),
                            17
                        );
                        contentY += 14 * this.scale;
                    }

                    const renderLine = (label, val, isUptime = false) => {
                        const displayVal = typeof val === 'function' ? val() : val;
                        const labelWidth = getTextWidth(label, this.argFontSize);
                        drawText(label, id.x + 22 * this.scale, contentY, this.argFontSize, colorWithAlpha(0xff8a94a0, contentAlpha), 17);
                        const valueX = id.x + 22 * this.scale + labelWidth + 5 * this.scale;
                        const valueColor = isUptime ? colorWithAlpha(THEME.ACCENT, contentAlpha) : colorWithAlpha(0xffffff, 0.92 * contentAlpha);
                        drawText(String(displayVal), valueX, contentY, this.argFontSize, valueColor, 17);
                        contentY += 14 * this.scale;
                    };

                    if (sIdx === 0) renderLine('Uptime:', uptimeVal, true);
                    const sectionData = section.data || {};
                    Object.entries(sectionData).forEach(([k, v]) => renderLine(`${k}:`, v, false));
                    contentY += 4 * this.scale;
                });
            } finally {
                NVG.resetScissor();
            }
        }
    }

    drawGUI() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || this.ids.length === 0) return;
        Client.getMinecraft().gameRenderer.renderBlur();

        try {
            NVG.beginFrame(sw, sh);
            this.ids.forEach((id) => this.renderID(id, true));
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            NVG.endFrame();
        }
    }

    drawAllOverlays() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0) return;
        let anyVisible = false;

        try {
            NVG.beginFrame(sw, sh);
            this.ids.forEach((id) => {
                const anim = this.animations[id.name];
                if (anim && (anim.target > 0 || anim.progress > 0.01)) {
                    this.renderID(id);
                    anyVisible = true;
                }
            });
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            NVG.endFrame();
        }

        if (!anyVisible && !this.stepTrigger) {
            this.mainRenderTrigger.unregister();
        }
    }

    saveIDs() {
        const data = {};
        this.ids.forEach((id) => {
            const sections = this.ensureArray(id.sections);
            const serializableSections = sections.map((s) => {
                const cleanData = {};
                Object.entries(s.data || {}).forEach(([k, v]) => {
                    if (typeof v !== 'function') cleanData[k] = v;
                });
                return { title: s.title, data: cleanData };
            });
            data[id.name] = { x: id.x, y: id.y, sections: serializableSections };
        });
        Utils.writeConfigFile('overlays.json', data);
    }

    loadIDs() {
        const data = Utils.getConfigFile('overlays.json') || {};
        this.ids = Object.keys(data).map((name) => {
            const entry = data[name] || {};
            return {
                name,
                x: entry.x !== undefined ? entry.x : 10,
                y: entry.y !== undefined ? entry.y : 10,
                sections: this.ensureArray(entry.sections),
                width: 0,
                height: this.minBoxHeight,
            };
        });
    }

    openPositionsGUI() {
        GuiState.myGui.close();
        Overlays.Gui.open();
    }

    closePositionsGUI() {
        GuiState.isOpening = true;
        loadSettings();
        GuiState.myGui.open();
    }
}

export const OverlayManager = new OverlayUtils();

const openModuleGui = () => {
    let waitTrigger = register('tick', () => {
        OverlayManager.closePositionsGUI();
        waitTrigger.unregister();
    });
};
