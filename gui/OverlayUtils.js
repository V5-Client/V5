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
        this.pendingSave = false;
        this.sessionResumeWindowMs = 5 * 60 * 1000; // resume macro within 5 minutes
        this.savedSessions = {};
        this.renderActive = false;

        NVG.registerV5Render(() => {
            if (!Overlays.Gui.isOpen() && !this.renderActive) return;
            if (Overlays.Gui.isOpen()) {
                this.drawGUI();
            } else {
                this.drawAllOverlays();
            }
        });

        register('gameUnload', () => this.resetAll());

        this.loadIDs();
        this.initTriggers();
    }

    ensureArray(val) {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object') {
            return Object.values(val).filter((item) => item && typeof item === 'object');
        }
        return [];
    }

    updateRenderActive() {
        this.renderActive = Object.values(this.animations).some((a) => a.target > 0 || a.progress > 0.01);
        return this.renderActive;
    }

    startAnimationLoop() {
        if (this.stepTrigger) return;
        this.stepTrigger = register('step', () => {
            let animating = false;
            for (let name in this.animations) {
                let anim = this.animations[name];
                let diff = anim.target - anim.progress;
                if (Math.abs(diff) > 0.001) {
                    animating = true;
                    anim.progress += diff * 0.12;
                } else {
                    anim.progress = anim.target;
                }
            }
            const hasVisible = this.updateRenderActive();
            if (!animating) {
                this.stepTrigger.unregister();
                this.stepTrigger = null;
                if (!hasVisible) this.renderActive = false;
            }
        }).setFps(60);
    }

    startTime(idName, allowResume = true) {
        const now = Date.now();
        const saved = this.savedSessions[idName];
        const canResume = allowResume && saved && now - saved.pausedAt <= this.sessionResumeWindowMs;

        if (canResume) {
            this.startTimes[idName] = now - saved.elapsedMs;
            delete this.savedSessions[idName];
        } else {
            if (saved) delete this.savedSessions[idName];
            this.startTimes[idName] = now;
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 1 };
        } else {
            this.animations[idName].target = 1;
        }
        this.renderActive = true;
        this.startAnimationLoop();
    }

    resetTime(idName) {
        if (this.animations[idName]) {
            this.animations[idName].target = 0;
        }
        this.updateRenderActive();
        this.startAnimationLoop();
    }

    pauseTime(idName) {
        const startedAt = this.startTimes[idName];
        if (startedAt) {
            const now = Date.now();
            this.savedSessions[idName] = { pausedAt: now, elapsedMs: now - startedAt };
        }
        this.resetTime(idName);
    }

    deleteID(idName) {
        this.ids = this.ids.filter((id) => id.name !== idName);
        delete this.animations[idName];
        delete this.startTimes[idName];
        delete this.savedSessions[idName];
        this.updateRenderActive();
        this.saveIDs();
    }

    resetAll() {
        this.ids = [];
        this.animations = {};
        this.startTimes = {};
        this.savedSessions = {};
        this.draggingId = null;
        this.pendingSave = false;
        this.renderActive = false;
        if (this.stepTrigger) {
            this.stepTrigger.unregister();
            this.stepTrigger = null;
        }
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

    clampToScreen(id, swOverride = null, shOverride = null) {
        const sw = swOverride !== null ? swOverride : Renderer.screen.getWidth();
        const sh = shOverride !== null ? shOverride : Renderer.screen.getHeight();
        if (sw === 0 || sh === 0) return;
        id.x = Math.max(0, Math.min(id.x, sw - id.width));
        id.y = Math.max(0, Math.min(id.y, sh - id.height));
    }

    drawAccentGlow(x, y, width, height, radius, progress) {
        const accentColor = THEME.ACCENT;
        const glowIntensity = 0.12;
        for (let i = 2; i >= 0; i--) {
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

    renderID(id, forceGUI = false, screenSize = null) {
        const anim = this.animations[id.name];
        let progress = anim ? anim.progress : 0;
        if (forceGUI) progress = 1.0;
        if (!forceGUI && (!anim || (anim.target === 0 && anim.progress <= 0.01))) return;

        const sections = this.ensureArray(id.sections);
        const uptimeVal = forceGUI ? '0.00s' : this.formatUptime(this.startTimes[id.name]);
        let maxWidth = getTextWidth(id.name, this.fontSize) + this.boxPadding * 3;
        let calculatedHeight = 30 * this.scale;
        const renderSections = [];

        sections.forEach((section, sIdx) => {
            if (!section || typeof section !== 'object') return;
            const sectionLines = [];
            const sectionData = section.data || {};

            if (section.title) calculatedHeight += 16 * this.scale;
            calculatedHeight += 10 * this.scale;

            if (sIdx === 0) {
                const label = 'Uptime:';
                const labelWidth = getTextWidth(label, this.argFontSize);
                const valueWidth = getTextWidth(uptimeVal, this.argFontSize);
                maxWidth = Math.max(maxWidth, labelWidth + valueWidth + 65 * this.scale);
                sectionLines.push({ label, value: uptimeVal, isUptime: true, labelWidth });
            }

            Object.entries(sectionData).forEach(([k, v]) => {
                const displayVal = typeof v === 'function' ? v() : v;
                const label = `${k}:`;
                const labelWidth = getTextWidth(label, this.argFontSize);
                const valueWidth = getTextWidth(String(displayVal), this.argFontSize);
                maxWidth = Math.max(maxWidth, labelWidth + valueWidth + 65 * this.scale);
                sectionLines.push({ label, value: displayVal, isUptime: false, labelWidth });
            });

            const lineCount = sectionLines.length;
            calculatedHeight += lineCount * 14 * this.scale;
            calculatedHeight += 2 * this.scale;

            renderSections.push({ title: section.title, lines: sectionLines });
        });
        calculatedHeight += 6 * this.scale;

        const targetWidth = Math.max(220 * this.scale, maxWidth);
        const targetHeight = Math.max(this.minBoxHeight, calculatedHeight);
        if (id.width !== targetWidth || id.height !== targetHeight) {
            id.width = targetWidth;
            id.height = targetHeight;
            const sw = screenSize ? screenSize.sw : null;
            const sh = screenSize ? screenSize.sh : null;
            this.clampToScreen(id, sw, sh);
        }
        const currentHeight = id.height * progress;
        const radius = CORNER_RADIUS * this.scale;
        const bgColor = colorWithAlpha(THEME.BG_OVERLAY, 0.95 * progress);

        drawShadow(id.x, id.y, id.width, currentHeight, 12 * this.scale, 0.45 * progress);
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
                renderSections.forEach((section) => {
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

                    section.lines.forEach((line) => {
                        drawText(
                            line.label,
                            id.x + 22 * this.scale,
                            contentY,
                            this.argFontSize,
                            colorWithAlpha(0xff8a94a0, contentAlpha),
                            17
                        );
                        const valueX = id.x + 22 * this.scale + line.labelWidth + 5 * this.scale;
                        const valueColor = line.isUptime
                            ? colorWithAlpha(THEME.ACCENT, contentAlpha)
                            : colorWithAlpha(0xffffff, 0.92 * contentAlpha);
                        drawText(String(line.value), valueX, contentY, this.argFontSize, valueColor, 17);
                        contentY += 14 * this.scale;
                    });
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
            this.ids.forEach((id) => this.renderID(id, true, { sw, sh }));
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
        const visibleIds = this.ids.filter((id) => {
            const anim = this.animations[id.name];
            return anim && (anim.target > 0 || anim.progress > 0.01);
        });
        if (visibleIds.length === 0) {
            this.renderActive = false;
            return;
        }
        this.renderActive = true;

        try {
            NVG.beginFrame(sw, sh);
            visibleIds.forEach((id) => this.renderID(id, false, { sw, sh }));
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            NVG.endFrame();
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
