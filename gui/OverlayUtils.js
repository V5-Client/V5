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
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };

        this.settings = {
            x: 10,
            y: 10,
            scale: 1.2,
        };
        this.schedulerSettings = {
            x: 10,
            y: 80,
            scale: 1.0,
        };
        this.scaleProps = {
            default: this.getScaleProps(this.settings.scale),
            scheduler: this.getScaleProps(this.schedulerSettings.scale),
        };

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

    getScaleProps(scale) {
        return {
            boxPadding: (PADDING || 12) * scale,
            minBoxHeight: 35 * scale,
            fontSize: FontSizes.LARGE * scale,
            argFontSize: FontSizes.MEDIUM * scale,
        };
    }

    updateScaleProps(target) {
        if (target === 'scheduler') {
            this.scaleProps.scheduler = this.getScaleProps(this.schedulerSettings.scale);
        } else {
            this.scaleProps.default = this.getScaleProps(this.settings.scale);
        }
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

    createID(idName, sections = [], options = {}) {
        const sectionsArray = this.ensureArray(sections);
        let existing = this.ids.find((id) => id.name === idName);

        if (existing) {
            existing.sections = sectionsArray;
            if (options.isScheduler !== undefined) {
                existing.isScheduler = options.isScheduler === true;
            }
        } else {
            const newId = {
                name: idName,
                sections: sectionsArray,
                width: 0,
                height: 0,
                isScheduler: options.isScheduler === true,
            };
            this.ids.push(newId);
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 0 };
        }
    }

    createSchedulerID(idName, sections = []) {
        this.createID(idName, sections, { isScheduler: true });
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

    getSchedulerExampleOverlay() {
        return {
            name: 'Scheduler',
            x: this.schedulerSettings.x,
            y: this.schedulerSettings.y,
            width: 0,
            height: 0,
            isScheduler: true,
            sections: [
                {
                    title: 'Scheduler',
                    data: {
                        Status: 'Running',
                        'Time Left': '5m 0s',
                        Active: 'Any Macro',
                    },
                },
            ],
        };
    }

    handleMouseClick(mouseX, mouseY) {
        if (this.currentSchedulerExampleBox && isInside(mouseX, mouseY, this.currentSchedulerExampleBox)) {
            this.dragging = true;
            this.dragTarget = 'scheduler';
            this.dragOffset.x = mouseX - this.schedulerSettings.x;
            this.dragOffset.y = mouseY - this.schedulerSettings.y;
            return;
        }
        if (this.currentExampleBox && isInside(mouseX, mouseY, this.currentExampleBox)) {
            this.dragging = true;
            this.dragTarget = 'default';
            this.dragOffset.x = mouseX - this.settings.x;
            this.dragOffset.y = mouseY - this.settings.y;
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.dragging || !this.dragTarget) return;
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        const settings = this.dragTarget === 'scheduler' ? this.schedulerSettings : this.settings;
        const box = this.dragTarget === 'scheduler' ? this.currentSchedulerExampleBox : this.currentExampleBox;
        const boxWidth = box?.width || 50;
        const boxHeight = box?.height || 20;

        settings.x = Math.max(0, Math.min(mouseX - this.dragOffset.x, sw - boxWidth));
        settings.y = Math.max(0, Math.min(mouseY - this.dragOffset.y, sh - boxHeight));
        this.pendingSave = true;
    }

    handleMouseRelease() {
        if (this.dragging) {
            this.dragging = false;
            this.dragTarget = null;
            this.saveSettings();
            this.pendingSave = false;
        }
    }

    handleScroll(mouseX, mouseY, dir) {
        if (this.currentSchedulerExampleBox && isInside(mouseX, mouseY, this.currentSchedulerExampleBox)) {
            this.schedulerSettings.scale = Math.max(0.5, Math.min(3.0, this.schedulerSettings.scale + (dir > 0 ? 0.1 : -0.1)));
            this.updateScaleProps('scheduler');
            this.pendingSave = true;
            return;
        }
        if (this.currentExampleBox && isInside(mouseX, mouseY, this.currentExampleBox)) {
            this.settings.scale = Math.max(0.5, Math.min(3.0, this.settings.scale + (dir > 0 ? 0.1 : -0.1)));
            this.updateScaleProps('default');
            this.pendingSave = true;
        }
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

    drawAccentGlow(x, y, width, height, radius, progress, accentOverride = null) {
        const accentColor = accentOverride || THEME.OV_ACCENT;
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

    drawSectionDivider(x, y, width, progress, accentOverride = null) {
        const accentColor = accentOverride || THEME.ACCENT;
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

        const isScheduler = id.isScheduler === true;
        const settings = isScheduler ? this.schedulerSettings : this.settings;
        const scaleProps = isScheduler ? this.scaleProps.scheduler : this.scaleProps.default;
        const scale = settings.scale;
        const { boxPadding, minBoxHeight, fontSize, argFontSize } = scaleProps;
        const accentColor = THEME.ACCENT;
        const glowColor = THEME.OV_ACCENT;
        const borderColor = colorWithAlpha(THEME.OV_BORDER, 0.7 * progress);
        const showUptime = !isScheduler;

        const headerHeight = 20 * scale;
        const rowHeight = 14 * scale;
        const sectionGap = 10 * scale;

        const basePadding = boxPadding;

        const sections = this.ensureArray(id.sections);
        const uptimeVal = forceGUI ? '0.00s' : this.formatUptime(this.startTimes[id.name]);

        let contentMaxWidth = getTextWidth(id.name, fontSize);
        let calculatedHeight = 30 * scale;
        const renderSections = [];

        sections.forEach((section, sIdx) => {
            if (!section || typeof section !== 'object') return;
            const sectionLines = [];
            const sectionData = section.data || {};

            if (section.title) {
                const titleWidth = getTextWidth(section.title.toUpperCase(), argFontSize * 0.85);
                contentMaxWidth = Math.max(contentMaxWidth, titleWidth + 10 * scale);
                calculatedHeight += headerHeight - 4 * scale;
            }
            calculatedHeight += sectionGap;

            if (sIdx === 0 && showUptime) {
                const label = 'Uptime:';
                const labelWidth = getTextWidth(label, argFontSize);
                const valueWidth = getTextWidth(uptimeVal, argFontSize);
                const lineTotalWidth = labelWidth + valueWidth + 25 * scale;
                contentMaxWidth = Math.max(contentMaxWidth, lineTotalWidth);
                sectionLines.push({ label, value: uptimeVal, isUptime: true, labelWidth });
            }

            Object.entries(sectionData).forEach(([k, v]) => {
                const displayVal = typeof v === 'function' ? v() : v;
                const label = `${k}:`;
                const labelWidth = getTextWidth(label, argFontSize);
                const valueWidth = getTextWidth(String(displayVal), argFontSize);
                const lineTotalWidth = labelWidth + valueWidth + 25 * scale;
                contentMaxWidth = Math.max(contentMaxWidth, lineTotalWidth);
                sectionLines.push({ label, value: displayVal, isUptime: false, labelWidth });
            });

            const lineCount = sectionLines.length;
            calculatedHeight += lineCount * rowHeight;
            calculatedHeight += 2 * scale;

            renderSections.push({ title: section.title, lines: sectionLines });
        });
        calculatedHeight += 6 * scale;

        const totalWidth = contentMaxWidth + basePadding * 2;

        const targetWidth = Math.max(100 * scale, totalWidth);
        const targetHeight = Math.max(minBoxHeight, calculatedHeight);

        id.width = targetWidth;
        id.height = targetHeight;

        let x = settings.x;
        let y = settings.y;

        const sw = screenSize ? screenSize.sw : null;
        const sh = screenSize ? screenSize.sh : null;
        if (sw && sh) {
            const clamped = this.clampToScreen(x, y, id.width, id.height, sw, sh);
            x = clamped.x;
            y = clamped.y;
        }

        const currentHeight = id.height * progress;
        const radius = CORNER_RADIUS * scale;
        const bgColor = colorWithAlpha(THEME.OV_WINDOW, 0.95 * progress);

        drawShadow(x, y, id.width, currentHeight, 12 * scale, 0.45 * progress);
        drawRoundedRectangleWithBorder({
            x: x,
            y: y,
            width: id.width,
            height: currentHeight,
            radius: radius,
            color: bgColor,
            borderWidth: BORDER_WIDTH * scale,
            borderColor: borderColor,
        });

        this.drawAccentGlow(x, y, id.width, currentHeight, radius, progress * 0.4, glowColor);

        if (progress > 0.1) {
            const contentAlpha = Math.min(1, progress * 3);

            try {
                NVG.scissor(x, y, id.width, currentHeight);
                const titleY = y + 20 * scale;
                const titleX = x + id.width / 2 - getTextWidth(id.name, fontSize) / 2;
                const titleAlign = 16;

                drawText(id.name, titleX + 1, titleY + 1, fontSize, colorWithAlpha(0x000000, 0.35 * contentAlpha), titleAlign);
                drawText(id.name, titleX, titleY, fontSize, colorWithAlpha(0xffffff, contentAlpha), titleAlign);

                let contentY = titleY + 10 * scale;

                renderSections.forEach((section) => {
                    this.drawSectionDivider(x + 10 * scale, contentY, id.width - 20 * scale, contentAlpha, accentColor);
                    contentY += 10 * scale;

                    const leftAlignX = x + basePadding;

                    if (section.title) {
                        drawText(section.title.toUpperCase(), leftAlignX, contentY, argFontSize * 0.8, colorWithAlpha(accentColor, contentAlpha), 17);
                        contentY += headerHeight - 6 * scale;
                    }

                    section.lines.forEach((line) => {
                        drawText(line.label, leftAlignX, contentY, argFontSize, colorWithAlpha(0xff8a94a0, contentAlpha), 17);

                        const valueX = x + id.width - basePadding;
                        const valueColor = line.isUptime ? colorWithAlpha(accentColor, contentAlpha) : colorWithAlpha(0xffffff, 0.92 * contentAlpha);

                        drawText(String(line.value), valueX, contentY, argFontSize, valueColor, 20);

                        contentY += rowHeight;
                    });
                    contentY += 4 * scale;
                });
            } finally {
                NVG.resetScissor();
            }
        }

        if (forceGUI) {
            if (isScheduler) {
                this.currentSchedulerExampleBox = { x, y, width: id.width, height: id.height };
            } else {
                this.currentExampleBox = { x, y, width: id.width, height: id.height };
            }
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
            const schedulerExample = this.getSchedulerExampleOverlay();
            this.renderID(example, true, { sw, sh });
            this.renderID(schedulerExample, true, { sw, sh });

            const text = 'Drag the example module or scheduler panel to reposition. Scroll to resize.';
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
        Utils.writeConfigFile('OverlayPositions/overlays.json', {
            default: this.settings,
            scheduler: this.schedulerSettings,
        });
    }

    loadSettings() {
        const data = Utils.getConfigFile('OverlayPositions/overlays.json');
        if (data) {
            if (data.default && typeof data.default.x === 'number') {
                this.settings = {
                    x: data.default.x,
                    y: data.default.y,
                    scale: data.default.scale || 1.2,
                };
            } else if (typeof data.x === 'number') {
                this.settings = {
                    x: data.x,
                    y: data.y,
                    scale: data.scale || 1.2,
                };
            }

            if (data.scheduler && typeof data.scheduler.x === 'number') {
                this.schedulerSettings = {
                    x: data.scheduler.x,
                    y: data.scheduler.y,
                    scale: data.scheduler.scale || 1.0,
                };
            }

            this.updateScaleProps('default');
            this.updateScaleProps('scheduler');
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
