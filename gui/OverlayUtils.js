import { NVG } from '../utils/Constants';
import { TimeUtils } from '../utils/TimeUtils';
import { Utils } from '../utils/Utils';
import {
    BORDER_WIDTH,
    colorWithAlpha,
    CORNER_RADIUS,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawText,
    FontSizes,
    getTextWidth,
    isInside,
    PADDING,
    THEME,
} from './Utils';
import { GuiState, Overlays } from './core/GuiState';
import { ServerInfo } from '../utils/player/ServerInfo';

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
        this.hudSettings = {
            stats: { x: 10, y: 10, scale: 1.0 },
            inventory: { x: 50, y: 100, scale: 1.0 },
        };
        this.musicSettings = {
            x: 100,
            y: 100,
            scale: 1.0,
        };

        this.editorOrder = ['default', 'scheduler', 'hudInventory', 'hudStats', 'music'];
        this.editorBoxes = {};

        this.startTimes = {};
        this.animations = {};
        this.stepTrigger = null;
        this.pendingSave = false;
        this.sessionResumeWindowMs = 5 * 60 * 1000; // resume macro within 5 minutes
        this.savedSessions = {};
        this.sessionTrackedDefaults = {};
        this.sessionTrackedValues = {};
        this.renderActive = false;
        this.drawingGUI = false;

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

    cloneTrackedDefaults(idName) {
        return { ...(this.sessionTrackedDefaults[idName] || {}) };
    }

    resolveTrackedValues(idName) {
        if (!this.sessionTrackedValues[idName]) {
            this.sessionTrackedValues[idName] = this.cloneTrackedDefaults(idName);
        }
        return this.sessionTrackedValues[idName];
    }

    startTime(idName, allowResume = true) {
        const now = Date.now();
        const saved = this.savedSessions[idName];
        const canResume = allowResume && saved && now - saved.pausedAt <= this.sessionResumeWindowMs;

        if (canResume) {
            this.startTimes[idName] = now - saved.elapsedMs;
            this.sessionTrackedValues[idName] = saved.trackedValues ? { ...saved.trackedValues } : this.cloneTrackedDefaults(idName);
            delete this.savedSessions[idName];
        } else {
            if (saved) delete this.savedSessions[idName];
            this.startTimes[idName] = now;
            this.sessionTrackedValues[idName] = this.cloneTrackedDefaults(idName);
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 1 };
        } else {
            this.animations[idName].target = 1;
        }
        this.renderActive = true;
        this.startAnimationLoop();
    }

    resetTime(idName, clearSavedSession = true) {
        delete this.startTimes[idName];
        if (clearSavedSession) {
            delete this.savedSessions[idName];
        }
        delete this.sessionTrackedValues[idName];
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
            this.savedSessions[idName] = {
                pausedAt: now,
                elapsedMs: now - startedAt,
                trackedValues: { ...this.resolveTrackedValues(idName) },
            };
        }
        this.resetTime(idName, false);
    }

    deleteID(idName) {
        this.ids = this.ids.filter((id) => id.name !== idName);
        delete this.animations[idName];
        delete this.startTimes[idName];
        delete this.savedSessions[idName];
        delete this.sessionTrackedDefaults[idName];
        delete this.sessionTrackedValues[idName];
        this.updateRenderActive();
        this.saveSettings();
    }

    resetAll() {
        this.ids = [];
        this.animations = {};
        this.startTimes = {};
        this.savedSessions = {};
        this.sessionTrackedDefaults = {};
        this.sessionTrackedValues = {};
        this.dragging = false;
        this.pendingSave = false;
        this.renderActive = false;
        if (this.stepTrigger) {
            this.stepTrigger.unregister();
            this.stepTrigger = null;
        }
    }

    formatUptime(startTime) {
        return TimeUtils.formatUptime(startTime);
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
        const trackedDefaults = options.sessionTrackedValues ? { ...options.sessionTrackedValues } : null;
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

        if (trackedDefaults) {
            this.sessionTrackedDefaults[idName] = trackedDefaults;
            if (!this.sessionTrackedValues[idName]) {
                this.sessionTrackedValues[idName] = { ...trackedDefaults };
            }
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 0 };
        }
    }

    createSchedulerID(idName, sections = []) {
        this.createID(idName, sections, { isScheduler: true });
    }

    getTrackedValue(idName, key, fallback = 0) {
        const activeValues = this.sessionTrackedValues[idName];
        if (activeValues && Object.prototype.hasOwnProperty.call(activeValues, key)) {
            return activeValues[key];
        }

        const saved = this.savedSessions[idName];
        if (saved && saved.trackedValues && Object.prototype.hasOwnProperty.call(saved.trackedValues, key)) {
            return saved.trackedValues[key];
        }

        const defaults = this.sessionTrackedDefaults[idName];
        if (defaults && Object.prototype.hasOwnProperty.call(defaults, key)) {
            return defaults[key];
        }

        return fallback;
    }

    setTrackedValue(idName, key, value) {
        const values = this.resolveTrackedValues(idName);
        values[key] = value;
        return value;
    }

    incrementTrackedValue(idName, key, amount = 1) {
        const current = Number(this.getTrackedValue(idName, key, 0)) || 0;
        return this.setTrackedValue(idName, key, current + amount);
    }

    getSessionElapsedMs(idName) {
        const startedAt = this.startTimes[idName];
        if (startedAt !== undefined) {
            return Math.max(0, Date.now() - startedAt);
        }

        const saved = this.savedSessions[idName];
        if (saved && saved.elapsedMs !== undefined) {
            return Math.max(0, saved.elapsedMs);
        }

        return 0;
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
        for (let i = this.editorOrder.length - 1; i >= 0; i--) {
            const target = this.editorOrder[i];
            const box = this.editorBoxes[target];
            if (!box || !isInside(mouseX, mouseY, box)) continue;

            const settings = this.getTargetSettings(target);
            if (!settings) continue;

            this.dragging = true;
            this.dragTarget = target;
            this.dragOffset.x = mouseX - settings.x;
            this.dragOffset.y = mouseY - settings.y;

            this.editorOrder = this.editorOrder.filter((t) => t !== target);
            this.editorOrder.push(target);
            return;
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.dragging || !this.dragTarget) return;
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        const settings = this.getTargetSettings(this.dragTarget);
        if (!settings) return;

        const box = this.editorBoxes[this.dragTarget];
        const boxWidth = box?.width || 50;
        const boxHeight = box?.height || 20;

        settings.x = Math.max(0, Math.min(mouseX - this.dragOffset.x, sw - boxWidth));
        settings.y = Math.max(0, Math.min(mouseY - this.dragOffset.y, sh - boxHeight));
        this.pendingSave = true;
        this.saveSettings();
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
        for (let i = this.editorOrder.length - 1; i >= 0; i--) {
            const target = this.editorOrder[i];
            const box = this.editorBoxes[target];
            if (!box || !isInside(mouseX, mouseY, box)) continue;

            if (target === 'scheduler') {
                this.schedulerSettings.scale = Math.max(0.5, Math.min(3.0, this.schedulerSettings.scale + (dir > 0 ? 0.1 : -0.1)));
                this.updateScaleProps('scheduler');
                this.pendingSave = true;
                this.saveSettings();
                return;
            }

            if (target === 'default') {
                this.settings.scale = Math.max(0.5, Math.min(3.0, this.settings.scale + (dir > 0 ? 0.1 : -0.1)));
                this.updateScaleProps('default');
                this.pendingSave = true;
                this.saveSettings();
                return;
            }

            if (target === 'hudStats') {
                this.hudSettings.stats.scale = Math.max(0.5, Math.min(3.0, this.hudSettings.stats.scale + (dir > 0 ? 0.1 : -0.1)));
                this.pendingSave = true;
                this.saveSettings();
                return;
            }

            if (target === 'hudInventory') {
                this.hudSettings.inventory.scale = Math.max(0.5, Math.min(3.0, this.hudSettings.inventory.scale + (dir > 0 ? 0.1 : -0.1)));
                this.pendingSave = true;
                this.saveSettings();
                return;
            }

            if (target === 'music') {
                this.musicSettings.scale = Math.max(0.5, Math.min(3.0, (this.musicSettings.scale || 1.0) + (dir > 0 ? 0.1 : -0.1)));
                this.pendingSave = true;
                this.saveSettings();
                return;
            }
        }
    }

    getTargetSettings(target) {
        if (target === 'default') return this.settings;
        if (target === 'scheduler') return this.schedulerSettings;
        if (target === 'hudStats') return this.hudSettings.stats;
        if (target === 'hudInventory') return this.hudSettings.inventory;
        if (target === 'music') return this.musicSettings;
        return null;
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
        const borderColor = colorWithAlpha(THEME.OV_ACCENT, 0.35 * progress);
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
        this.editorBoxes = {};
        this.drawingGUI = true;

        try {
            NVG.beginFrame(sw, sh);
            this.editorOrder.forEach((target) => {
                if (target === 'default') {
                    const example = this.getExampleOverlay();
                    this.renderID(example, true, { sw, sh });
                    this.editorBoxes.default = this.currentExampleBox;
                    return;
                }

                if (target === 'scheduler') {
                    const schedulerExample = this.getSchedulerExampleOverlay();
                    this.renderID(schedulerExample, true, { sw, sh });
                    this.editorBoxes.scheduler = this.currentSchedulerExampleBox;
                    return;
                }

                if (target === 'hudStats') {
                    this.editorBoxes.hudStats = this.drawHudStatsPreview(sw, sh);
                    return;
                }

                if (target === 'hudInventory') {
                    this.editorBoxes.hudInventory = this.drawHudInventoryPreview(sw, sh);
                    return;
                }

                if (target === 'music') {
                    this.editorBoxes.music = this.drawMusicPreview(sw, sh);
                }
            });

            const text = 'Drag overlays to reposition. Scroll over module/scheduler/HUD previews to resize.';
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
        Utils.writeConfigFile('OverlayPositions/hud_positions.json', this.hudSettings);
        Utils.writeConfigFile('OverlayPositions/music_overlay.json', this.musicSettings);
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

        const hudData = Utils.getConfigFile('OverlayPositions/hud_positions.json');
        if (hudData && typeof hudData === 'object') {
            if (hudData.stats && typeof hudData.stats.x === 'number') {
                this.hudSettings.stats = {
                    x: hudData.stats.x,
                    y: hudData.stats.y,
                    scale: typeof hudData.stats.scale === 'number' ? hudData.stats.scale : 1.0,
                };
            }

            if (hudData.inventory && typeof hudData.inventory.x === 'number') {
                this.hudSettings.inventory = {
                    x: hudData.inventory.x,
                    y: hudData.inventory.y,
                    scale: typeof hudData.inventory.scale === 'number' ? hudData.inventory.scale : 1.0,
                };
            }
        }

        const musicData = Utils.getConfigFile('OverlayPositions/music_overlay.json');
        if (musicData && typeof musicData === 'object' && typeof musicData.x === 'number' && typeof musicData.y === 'number') {
            this.musicSettings = {
                x: musicData.x,
                y: musicData.y,
                scale: typeof musicData.scale === 'number' ? musicData.scale : 1.0,
            };
        }
    }

    drawHudStatsPreview(sw, sh) {
        const s = this.hudSettings.stats.scale;
        const pad = 6 * s;
        const fontSize = FontSizes.MEDIUM * 1.25 * s;
        const lines = this.getHudStatsLines();
        const separator = ' | ';
        const separatorWidth = getTextWidth(separator, fontSize);
        const gap = 3 * s;
        let totalWidth = 0;

        lines.forEach((l, index) => {
            totalWidth += getTextWidth(`${l.label}:`, fontSize) + gap + getTextWidth(String(l.value), fontSize);
            if (index < lines.length - 1) totalWidth += separatorWidth;
        });

        const width = pad * 2 + totalWidth;
        const height = pad * 2 + fontSize;

        const clamped = this.clampToScreen(this.hudSettings.stats.x, this.hudSettings.stats.y, width, height, sw, sh);
        this.hudSettings.stats.x = clamped.x;
        this.hudSettings.stats.y = clamped.y;

        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.92);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.35);
        drawRoundedRectangleWithBorder({
            x: clamped.x,
            y: clamped.y,
            width,
            height,
            radius: CORNER_RADIUS * 0.6 * s,
            color: bg,
            borderWidth: BORDER_WIDTH * s,
            borderColor: border,
        });

        const labelColor = colorWithAlpha(0xffffff, 0.7);
        const separatorColor = colorWithAlpha(0xffffff, 0.4);
        const centerY = clamped.y + height / 2;
        let x = clamped.x + pad;

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

        return { x: clamped.x, y: clamped.y, width, height };
    }

    drawHudInventoryPreview(sw, sh) {
        const s = this.hudSettings.inventory.scale;
        const cols = 9;
        const mainRows = 3;
        const pad = 6 * s;
        const slot = 18 * s;
        const gap = 4 * s;
        const width = pad * 2 + cols * slot;
        const height = pad * 2 + mainRows * slot + gap + slot;

        const clamped = this.clampToScreen(this.hudSettings.inventory.x, this.hudSettings.inventory.y, width, height, sw, sh);
        this.hudSettings.inventory.x = clamped.x;
        this.hudSettings.inventory.y = clamped.y;

        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.9);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.25);
        drawRoundedRectangleWithBorder({
            x: clamped.x,
            y: clamped.y,
            width,
            height,
            radius: CORNER_RADIUS * 0.55 * s,
            color: bg,
            borderWidth: BORDER_WIDTH * s,
            borderColor: border,
        });

        const separatorThickness = Math.max(1, 1 * s);
        const gridStartX = clamped.x + pad;
        const mainStartY = clamped.y + pad;
        const rowWidth = cols * slot;
        const mainHotbarSeparatorY = mainStartY + mainRows * slot + gap / 2 - separatorThickness / 2;
        const halfWidth = rowWidth / 2;
        const centerColor = colorWithAlpha(THEME.ACCENT, 0.3);
        const edgeColor = colorWithAlpha(THEME.ACCENT, 0);

        NVG.drawGradientRect(gridStartX, mainHotbarSeparatorY, halfWidth, separatorThickness, edgeColor, centerColor, 'LeftToRight', 0);
        NVG.drawGradientRect(gridStartX + halfWidth, mainHotbarSeparatorY, halfWidth, separatorThickness, centerColor, edgeColor, 'LeftToRight', 0);

        return { x: clamped.x, y: clamped.y, width, height };
    }

    drawMusicPreview(sw, sh) {
        const s = this.musicSettings.scale || 1.0;
        const songName = 'Searching for Media...';
        const timeCur = '--:--';
        const timeMax = '--:--';
        const padding = 12 * s;
        const imageSize = 55 * s;
        const titleFontSize = FontSizes.MEDIUM * 1.3 * s;
        const timerFontSize = FontSizes.MEDIUM * 0.85 * s;
        const barHeight = 4 * s;
        const nameWidth = getTextWidth(songName, titleFontSize);
        const width = Math.max(200 * s, nameWidth + imageSize + padding * 4);
        const height = 90 * s;
        const clamped = this.clampToScreen(this.musicSettings.x, this.musicSettings.y, width, height, sw, sh);
        this.musicSettings.x = clamped.x;
        this.musicSettings.y = clamped.y;

        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.92);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.35);

        drawRoundedRectangleWithBorder({
            x: clamped.x,
            y: clamped.y,
            width,
            height,
            radius: CORNER_RADIUS * 0.6 * s,
            color: bg,
            borderWidth: BORDER_WIDTH * s,
            borderColor: border,
        });

        const imgX = clamped.x + width - imageSize - padding;
        const imgY = clamped.y + padding;
        drawRoundedRectangleWithBorder({
            x: imgX,
            y: imgY,
            width: imageSize,
            height: imageSize,
            radius: CORNER_RADIUS * 0.5 * s,
            color: colorWithAlpha(0x000000, 0.3),
            borderWidth: 0,
            borderColor: 0,
        });

        const qWidth = getTextWidth('...', titleFontSize);
        drawText('...', imgX + imageSize / 2 - qWidth / 2, imgY + imageSize / 2 - titleFontSize / 2.5, titleFontSize, 0xaaaaaaff, 16);
        drawText(songName, clamped.x + padding, clamped.y + padding + titleFontSize, titleFontSize, 0xaaaaaaff, 16);

        const curTimeWidth = getTextWidth(timeCur, timerFontSize);
        const maxTimeWidth = getTextWidth(timeMax, timerFontSize);
        const textToBarGap = 4 * s;
        const barStartX = clamped.x + padding + curTimeWidth + textToBarGap;
        const barEndX = clamped.x + width - padding - maxTimeWidth - textToBarGap;
        const barWidth = barEndX - barStartX;
        const barY = clamped.y + height - padding - barHeight * 0.8;
        const timerY = barY + barHeight / 2 - timerFontSize / 2.5;

        drawText(timeCur, clamped.x + padding, timerY + timerFontSize / 2.5, timerFontSize, 0x888888ff, 16);
        drawText(timeMax, clamped.x + width - padding - maxTimeWidth, timerY + timerFontSize / 2.5, timerFontSize, 0x888888ff, 16);

        drawRoundedRectangleWithBorder({
            x: barStartX,
            y: barY,
            width: barWidth,
            height: barHeight,
            radius: barHeight / 2,
            color: colorWithAlpha(0xffffff, 0.15),
            borderWidth: 0,
            borderColor: 0,
        });

        return { x: clamped.x, y: clamped.y, width, height };
    }

    getHudStatsLines() {
        const fps = Client.getFPS();
        const ping = ServerInfo.getPing();
        const tps = ServerInfo.getTPS();
        return [
            { label: 'FPS', value: String(fps), color: 0xffffffff },
            { label: 'Ping', value: `${ping}ms`, color: (0xff000000 | ServerInfo.getPingColor(ping)) >>> 0 },
            { label: 'TPS', value: tps.toFixed(2), color: (0xff000000 | ServerInfo.getTpsColor(tps)) >>> 0 },
        ];
    }

    openPositionsGUI() {
        GuiState.myGui.close();
        Overlays.Gui.open();
    }

    closePositionsGUI() {
        GuiState.isOpening = true;
        loadSettings();
        GuiState.myGui.open();
        this.drawingGUI = false;
    }
}

export const OverlayManager = new OverlayUtils();

const openModuleGui = () => {
    let waitTrigger = register('tick', () => {
        OverlayManager.closePositionsGUI();
        waitTrigger.unregister();
    });
};
