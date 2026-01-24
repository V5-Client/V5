import { NVG } from '../utils/Constants';
import { Utils } from '../utils/Utils';
import {
    BORDER_WIDTH,
    colorWithAlpha,
    CORNER_RADIUS,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawShadow,
    drawText,
    FontSizes,
    getTextWidth,
    isInside,
    PADDING,
    THEME,
} from './Utils';
import { GuiState, Overlays } from './core/GuiState';

const { loadSettings } = require('./GuiSave');

class OverlayUtils {
    constructor() {
        this.ids = [];
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };

        this.settings = {
            x: 10,
            y: 10,
            scale: 1.2,
        };

        this.boxPadding = (PADDING || 12) * this.settings.scale;
        this.minBoxHeight = 35 * this.settings.scale;
        this.fontSize = FontSizes.LARGE * this.settings.scale;
        this.argFontSize = FontSizes.MEDIUM * this.settings.scale;

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

        this.loadSettings();
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
                if (this.stepTrigger) {
                    this.stepTrigger.unregister();
                    this.stepTrigger = null;
                }
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
        this.saveSettings();
    }

    resetAll() {
        this.ids = [];
        this.animations = {};
        this.startTimes = {};
        this.savedSessions = {};
        this.dragging = false;
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
                this.saveSettings();
                this.pendingSave = false;
            }
            openModuleGui();
        });
        Overlays.Gui.registerClicked((x, y, b) => b === 0 && this.handleMouseClick(x, y));
        Overlays.Gui.registerMouseDragged((x, y, b) => b === 0 && this.handleMouseDrag(x, y));
        Overlays.Gui.registerMouseReleased(() => this.handleMouseRelease());
        Overlays.Gui.registerScrolled((x, y, dir) => this.handleScroll(x, y, dir));
    }

    createID(idName, sections = []) {
        const sectionsArray = this.ensureArray(sections);
        let existing = this.ids.find((id) => id.name === idName);

        if (existing) {
            existing.sections = sectionsArray;
        } else {
            const newId = {
                name: idName,
                sections: sectionsArray,
                width: 0,
                height: 0,
            };
            this.ids.push(newId);
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 0 };
        }
    }

    getExampleOverlay() {
        return {
            name: 'Example Module',
            x: this.settings.x,
            y: this.settings.y,
            width: 0,
            height: 0,
            sections: [
                {
                    title: 'General',
                    data: {
                        'PLACEHOLDER 1': 'PLACEHOLDER 1',
                        'PLACEHOLDER 2': 'PLACEHOLDER 2',
                    },
                },
                {
                    title: 'Statistics',
                    data: {
                        'PLACEHOLDER 3': 'PLACEHOLDER 3',
                        'PLACEHOLDER 4': 'PLACEHOLDER 4',
                        'PLACEHOLDER 9': 'PLACEHOLDER 9',
                    },
                },
                {
                    title: 'Settings',
                    data: {
                        'PLACEHOLDER 5': 'PLACEHOLDER 5',
                        'PLACEHOLDER 6': 'PLACEHOLDER 6',
                        'PLACEHOLDER 10': 'PLACEHOLDER 10',
                    },
                },
                {
                    title: 'Other',
                    data: {
                        'PLACEHOLDER 7': 'PLACEHOLDER 7',
                        'PLACEHOLDER 8': 'PLACEHOLDER 8',
                        'PLACEHOLDER 11': 'PLACEHOLDER 11',
                        'PLACEHOLDER 12': 'PLACEHOLDER 12',
                        'PLACEHOLDER 13': 'PLACEHOLDER 13',
                    },
                },
            ],
        };
    }

    handleMouseClick(mouseX, mouseY) {
        if (this.currentExampleBox && isInside(mouseX, mouseY, this.currentExampleBox)) {
            this.dragging = true;
            this.dragOffset.x = mouseX - this.settings.x;
            this.dragOffset.y = mouseY - this.settings.y;
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.dragging) return;
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();

        this.settings.x = Math.max(0, Math.min(mouseX - this.dragOffset.x, sw - (this.currentExampleBox?.width || 50)));
        this.settings.y = Math.max(0, Math.min(mouseY - this.dragOffset.y, sh - (this.currentExampleBox?.height || 20)));
        this.pendingSave = true;
    }

    handleMouseRelease() {
        if (this.dragging) {
            this.dragging = false;
            this.saveSettings();
            this.pendingSave = false;
        }
    }

    handleScroll(mouseX, mouseY, dir) {
        if (this.currentExampleBox && isInside(mouseX, mouseY, this.currentExampleBox)) {
            this.settings.scale = Math.max(0.5, Math.min(3.0, this.settings.scale + (dir > 0 ? 0.1 : -0.1)));
            this.updateScaleDependents();
            this.pendingSave = true;
        }
    }

    updateScaleDependents() {
        this.boxPadding = (PADDING || 12) * this.settings.scale;
        this.minBoxHeight = 35 * this.settings.scale;
        this.fontSize = FontSizes.LARGE * this.settings.scale;
        this.argFontSize = FontSizes.MEDIUM * this.settings.scale;
    }

    clampToScreen(x, y, w, h, swOverride = null, shOverride = null) {
        const sw = swOverride !== null ? swOverride : Renderer.screen.getWidth();
        const sh = shOverride !== null ? shOverride : Renderer.screen.getHeight();
        if (sw === 0 || sh === 0) return { x, y };

        return {
            x: Math.max(0, Math.min(x, sw - w)),
            y: Math.max(0, Math.min(y, sh - h)),
        };
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

        let contentMaxWidth = getTextWidth(id.name, this.fontSize);
        let calculatedHeight = 30 * this.settings.scale;
        const renderSections = [];

        sections.forEach((section, sIdx) => {
            if (!section || typeof section !== 'object') return;
            const sectionLines = [];
            const sectionData = section.data || {};

            if (section.title) {
                const titleWidth = getTextWidth(section.title.toUpperCase(), this.argFontSize * 0.85);
                contentMaxWidth = Math.max(contentMaxWidth, titleWidth + 10 * this.settings.scale);
                calculatedHeight += 16 * this.settings.scale;
            }
            calculatedHeight += 10 * this.settings.scale;

            if (sIdx === 0) {
                const label = 'Uptime:';
                const labelWidth = getTextWidth(label, this.argFontSize);
                const valueWidth = getTextWidth(uptimeVal, this.argFontSize);
                const lineTotalWidth = labelWidth + valueWidth + 25 * this.settings.scale;
                contentMaxWidth = Math.max(contentMaxWidth, lineTotalWidth);
                sectionLines.push({ label, value: uptimeVal, isUptime: true, labelWidth });
            }

            Object.entries(sectionData).forEach(([k, v]) => {
                const displayVal = typeof v === 'function' ? v() : v;
                const label = `${k}:`;
                const labelWidth = getTextWidth(label, this.argFontSize);
                const valueWidth = getTextWidth(String(displayVal), this.argFontSize);
                const lineTotalWidth = labelWidth + valueWidth + 25 * this.settings.scale;
                contentMaxWidth = Math.max(contentMaxWidth, lineTotalWidth);
                sectionLines.push({ label, value: displayVal, isUptime: false, labelWidth });
            });

            const lineCount = sectionLines.length;
            calculatedHeight += lineCount * 14 * this.settings.scale;
            calculatedHeight += 2 * this.settings.scale;

            renderSections.push({ title: section.title, lines: sectionLines });
        });
        calculatedHeight += 6 * this.settings.scale;

        const totalWidth = contentMaxWidth + this.boxPadding * 2;

        const targetWidth = Math.max(100 * this.settings.scale, totalWidth);
        const targetHeight = Math.max(this.minBoxHeight, calculatedHeight);

        id.width = targetWidth;
        id.height = targetHeight;

        let x = this.settings.x;
        let y = this.settings.y;

        const sw = screenSize ? screenSize.sw : null;
        const sh = screenSize ? screenSize.sh : null;
        if (sw && sh) {
            const clamped = this.clampToScreen(x, y, id.width, id.height, sw, sh);
            x = clamped.x;
            y = clamped.y;
        }

        const currentHeight = id.height * progress;
        const radius = CORNER_RADIUS * this.settings.scale;
        const bgColor = colorWithAlpha(THEME.BG_OVERLAY, 0.95 * progress);

        drawShadow(x, y, id.width, currentHeight, 12 * this.settings.scale, 0.45 * progress);
        drawRoundedRectangleWithBorder({
            x: x,
            y: y,
            width: id.width,
            height: currentHeight,
            radius: radius,
            color: bgColor,
            borderWidth: BORDER_WIDTH * this.settings.scale,
            borderColor: colorWithAlpha(THEME.ACCENT_GLOW, 0.7 * progress),
        });

        this.drawAccentGlow(x, y, id.width, currentHeight, radius, progress * 0.4);

        if (progress > 0.1) {
            const contentAlpha = Math.min(1, progress * 3);

            try {
                NVG.scissor(x, y, id.width, currentHeight);
                const titleY = y + 20 * this.settings.scale;
                const titleX = x + id.width / 2 - getTextWidth(id.name, this.fontSize) / 2;

                drawText(id.name, titleX + 1, titleY + 1, this.fontSize, colorWithAlpha(0x000000, 0.35 * contentAlpha), 16);
                drawText(id.name, titleX, titleY, this.fontSize, colorWithAlpha(0xffffff, contentAlpha), 16);

                let contentY = titleY + 10 * this.settings.scale;

                renderSections.forEach((section) => {
                    this.drawSectionDivider(x + 10 * this.settings.scale, contentY, id.width - 20 * this.settings.scale, contentAlpha);
                    contentY += 10 * this.settings.scale;

                    const leftAlignX = x + this.boxPadding;

                    if (section.title) {
                        drawText(section.title.toUpperCase(), leftAlignX, contentY, this.argFontSize * 0.85, colorWithAlpha(THEME.ACCENT, contentAlpha), 17);
                        contentY += 14 * this.settings.scale;
                    }

                    section.lines.forEach((line) => {
                        drawText(line.label, leftAlignX, contentY, this.argFontSize, colorWithAlpha(0xff8a94a0, contentAlpha), 17);

                        const valueX = x + id.width - this.boxPadding;
                        const valueColor = line.isUptime ? colorWithAlpha(THEME.ACCENT, contentAlpha) : colorWithAlpha(0xffffff, 0.92 * contentAlpha);

                        drawText(String(line.value), valueX, contentY, this.argFontSize, valueColor, 20);

                        contentY += 14 * this.settings.scale;
                    });
                    contentY += 4 * this.settings.scale;
                });
            } finally {
                NVG.resetScissor();
            }
        }

        if (forceGUI) {
            this.currentExampleBox = { x, y, width: id.width, height: id.height };
        }
    }

    drawGUI() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0) return;
        Client.getMinecraft().gameRenderer.renderBlur();

        try {
            NVG.beginFrame(sw, sh);
            const example = this.getExampleOverlay();
            this.renderID(example, true, { sw, sh });

            const text = 'Drag the example module to reposition. Scroll to resize.';
            const textWidth = getTextWidth(text, FontSizes.MEDIUM);
            drawText(text, (sw - textWidth) / 2, 30, FontSizes.MEDIUM, 0xffffffff, 16);
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
            visibleIds.forEach((id) => {
                this.renderID(id, false, { sw, sh });
            });
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            NVG.endFrame();
        }
    }

    saveSettings() {
        Utils.writeConfigFile('overlays.json', this.settings);
    }

    loadSettings() {
        const data = Utils.getConfigFile('overlays.json');
        if (data && typeof data.x === 'number') {
            this.settings = {
                x: data.x,
                y: data.y,
                scale: data.scale || 1.2,
            };
            this.updateScaleDependents();
        }
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
