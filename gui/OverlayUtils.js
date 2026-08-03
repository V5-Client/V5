import { formatDurationMs, formatUptime } from '../utils/TimeUtils';
import { getConfigFile, writeConfigFile } from '../utils/Utils';
import {
    BORDER_WIDTH,
    clamp,
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
import { getPing, getPingColor, getTPS, getTpsColor } from '../utils/player/ServerInfo';
import { loadSettings } from './GuiSave';
import {
    drawInventoryHudBackground,
    drawMusicOverlay,
    drawStatsHud,
    getInventoryHudBounds,
    getMusicOverlayBounds,
    getStatsHudBounds,
    getStatsHudLines,
} from './OverlayRenderers';

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

        Renderer.registerV5Render(() => {
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
            boxPadding: PADDING * scale,
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
        this.renderActive = Object.values(this.animations).some((animation) => animation.target > 0 || animation.progress > 0.01);
        return this.renderActive;
    }

    startAnimationLoop() {
        if (this.stepTrigger) return;
        this.stepTrigger = register('step', () => {
            let animating = false;
            for (const name in this.animations) {
                const anim = this.animations[name];
                const diff = anim.target - anim.progress;
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

    getMacroDuration(macroName) {
        const saved = this.savedSessions && this.savedSessions[macroName];
        if (saved && typeof saved.elapsedMs === 'number') return formatDurationMs(saved.elapsedMs);

        const startTime = this.startTimes && this.startTimes[macroName];
        return startTime ? formatUptime(startTime) : '';
    }

    initTriggers() {
        Overlays.Gui.registerClosed(() => {
            this.handleMouseRelease();
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

            const settings = this.getTargetSettings(target);
            if (!settings) continue;

            const scale = target === 'music' ? settings.scale || 1 : settings.scale;
            settings.scale = clamp(scale + (dir > 0 ? 0.1 : -0.1), 0.5, 3);
            if (target === 'default' || target === 'scheduler') this.updateScaleProps(target);
            this.pendingSave = true;
            this.saveSettings();
            return;
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
        const accentColor = accentOverride || THEME.ACCENT;
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
        Renderer.drawGradientRect(x, y, halfWidth, dividerHeight, edgeColor, centerColor, 'LeftToRight', 0);
        // right
        Renderer.drawGradientRect(x + halfWidth, y, halfWidth, dividerHeight, centerColor, edgeColor, 'LeftToRight', 0);
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
        const borderColor = colorWithAlpha(THEME.BORDER, progress);
        const showUptime = !isScheduler;

        const headerHeight = 20 * scale;
        const rowHeight = 14 * scale;
        const sectionGap = 10 * scale;

        const basePadding = boxPadding;

        const sections = this.ensureArray(id.sections);
        const uptimeVal = forceGUI ? '0.00s' : formatUptime(this.startTimes[id.name]);

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
                sectionLines.push({ label, value: uptimeVal, isUptime: true });
            }

            Object.entries(sectionData).forEach(([k, v]) => {
                const displayVal = typeof v === 'function' ? v() : v;
                const label = `${k}:`;
                const labelWidth = getTextWidth(label, argFontSize);
                const valueWidth = getTextWidth(String(displayVal), argFontSize);
                const lineTotalWidth = labelWidth + valueWidth + 25 * scale;
                contentMaxWidth = Math.max(contentMaxWidth, lineTotalWidth);
                sectionLines.push({ label, value: displayVal, isUptime: false });
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
            if (forceGUI) {
                settings.x = x;
                settings.y = y;
            }
        }

        const currentHeight = id.height * progress;
        const radius = CORNER_RADIUS * scale;
        const bgColor = colorWithAlpha(THEME.BG_COMPONENT, progress);

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
                Renderer.scissor(x, y, id.width, currentHeight);
                const titleY = y + 20 * scale;
                const titleX = x + id.width / 2 - getTextWidth(id.name, fontSize) / 2;
                const titleAlign = 16;

                drawText(id.name, titleX + 1, titleY + 1, fontSize, colorWithAlpha(0xff000000, 0.35 * contentAlpha), titleAlign);
                drawText(id.name, titleX, titleY, fontSize, colorWithAlpha(THEME.TEXT, contentAlpha), titleAlign);

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
                        drawText(line.label, leftAlignX, contentY, argFontSize, colorWithAlpha(THEME.TEXT_MUTED, contentAlpha), 17);

                        const valueX = x + id.width - basePadding;
                        const valueColor = line.isUptime ? colorWithAlpha(accentColor, contentAlpha) : colorWithAlpha(THEME.TEXT, contentAlpha);

                        drawText(String(line.value), valueX, contentY, argFontSize, valueColor, 20);

                        contentY += rowHeight;
                    });
                    contentY += 4 * scale;
                });
            } finally {
                Renderer.resetScissor();
            }
        }

        if (forceGUI) {
            if (isScheduler) {
                this.currentSchedulerExampleBox = {
                    x,
                    y,
                    width: id.width,
                    height: id.height,
                };
            } else {
                this.currentExampleBox = { x, y, width: id.width, height: id.height };
            }
        }
    }

    drawGUI() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || sh === 0) return;
        Renderer.blurBackground();
        this.editorBoxes = {};
        this.drawingGUI = true;

        try {
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
            drawText(text, (sw - textWidth) / 2, 30, FontSizes.MEDIUM, THEME.TEXT, 16);
        } catch (e) {
            console.error(e);
        }
    }

    drawAllOverlays() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || sh === 0) return;

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
            visibleIds.forEach((id) => {
                this.renderID(id, false, { sw, sh });
            });
        } catch (e) {
            console.error(e);
        }
    }

    saveSettings() {
        writeConfigFile('OverlayPositions/overlays.json', {
            default: this.settings,
            scheduler: this.schedulerSettings,
        });
        writeConfigFile('OverlayPositions/hud_positions.json', this.hudSettings);
        writeConfigFile('OverlayPositions/music_overlay.json', this.musicSettings);
    }

    loadSettings() {
        const data = getConfigFile('OverlayPositions/overlays.json');
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

        const hudData = getConfigFile('OverlayPositions/hud_positions.json');
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

        const musicData = getConfigFile('OverlayPositions/music_overlay.json');
        if (musicData && typeof musicData === 'object' && typeof musicData.x === 'number' && typeof musicData.y === 'number') {
            this.musicSettings = {
                x: musicData.x,
                y: musicData.y,
                scale: typeof musicData.scale === 'number' ? musicData.scale : 1.0,
            };
        }
    }

    drawHudStatsPreview(sw, sh) {
        const lines = getStatsHudLines();
        const overlay = {
            ...this.hudSettings.stats,
            ...getStatsHudBounds(this.hudSettings.stats.scale, lines),
        };
        Object.assign(this.hudSettings.stats, this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh));
        Object.assign(overlay, this.hudSettings.stats);
        drawStatsHud(overlay, lines);
        return overlay;
    }

    drawHudInventoryPreview(sw, sh) {
        const overlay = {
            ...this.hudSettings.inventory,
            ...getInventoryHudBounds(this.hudSettings.inventory.scale),
        };
        Object.assign(this.hudSettings.inventory, this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh));
        Object.assign(overlay, this.hudSettings.inventory);
        drawInventoryHudBackground(overlay);
        return overlay;
    }

    drawMusicPreview(sw, sh) {
        const songName = 'Searching for Media...';
        const overlay = {
            ...this.musicSettings,
            ...getMusicOverlayBounds(this.musicSettings.scale || 1, songName),
        };
        Object.assign(this.musicSettings, this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh));
        Object.assign(overlay, this.musicSettings);
        drawMusicOverlay({
            overlay,
            songName,
            currentTime: '--:--',
            totalTime: '--:--',
        });
        return overlay;
    }

    getHudStatsLines() {
        return getStatsHudLines();
    }

    openPositionsGUI() {
        Client.currentGui.close();
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
    const waitTrigger = register('tick', () => {
        OverlayManager.closePositionsGUI();
        waitTrigger.unregister();
    });
};
