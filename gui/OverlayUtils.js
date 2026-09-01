import { formatDurationMs, formatUptime } from '../utils/TimeUtils';
import { getConfigFile, writeConfigFile } from '../utils/Utils';
import { clamp, colorWithAlpha, drawRoundedRectangle, isInside, PADDING, THEME } from './Utils';
import { GuiState, Overlays } from './core/GuiState';
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

const GRID_SIZE = 10;
const ELEMENT_SNAP_DISTANCE = 4;
const ELEMENT_NEAR_DISTANCE = 20;

class OverlayUtils {
    constructor() {
        this.ids = [];
        this.dragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.snapGuides = [];

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
        this.lastClickTarget = null;
        this.lastClickAt = 0;

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

        this.renderCallback = () => {
            if (!Overlays.Gui.isOpen() && !this.renderActive) return;
            if (Overlays.Gui.isOpen()) {
                this.drawGUI();
            } else {
                this.drawAllOverlays();
            }
        };
        this.renderRegistration = null;

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
        this.renderActive = this.ids.some((id) => {
            const animation = this.animations[id.name];
            const settings = id.isScheduler ? this.schedulerSettings : this.settings;
            return settings.enabled !== false && animation && (animation.target > 0 || animation.progress > 0.01);
        });
        this.updateRenderRegistration();
        return this.renderActive;
    }

    updateRenderRegistration(active = this.renderActive || Overlays.Gui.isOpen()) {
        if (active && !this.renderRegistration) this.renderRegistration = Render2D.registerV5Render(this.renderCallback);
        else if (!active && this.renderRegistration) {
            Render2D.unregisterV5Render(this.renderRegistration);
            this.renderRegistration = null;
        }
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
        this.updateRenderActive();
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
        this.snapGuides = [];
        this.pendingSave = false;
        this.renderActive = false;
        this.updateRenderRegistration(false);
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
        Overlays.Gui.registerOpened(() => this.updateRenderRegistration(true));
        Overlays.Gui.registerClosed(() => {
            this.handleMouseRelease();
            if (this.pendingSave) {
                this.saveSettings();
                this.pendingSave = false;
            }
            this.updateRenderRegistration(this.renderActive);
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
            delete existing.renderLayout;
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
        return (this.exampleOverlay ||= {
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
        });
    }

    getSchedulerExampleOverlay() {
        return (this.schedulerExampleOverlay ||= {
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
        });
    }

    handleMouseClick(mouseX, mouseY) {
        for (let i = this.editorOrder.length - 1; i >= 0; i--) {
            const target = this.editorOrder[i];
            const box = this.editorBoxes[target];
            if (!box || !isInside(mouseX, mouseY, box)) continue;

            const settings = this.getTargetSettings(target);
            if (!settings) continue;

            const now = Date.now();
            if (this.lastClickTarget === target && now - this.lastClickAt <= 300) {
                settings.enabled = settings.enabled === false;
                this.lastClickTarget = null;
                this.dragging = false;
                this.dragTarget = null;
                this.saveSettings();
                this.updateRenderActive();
                return;
            }

            this.lastClickTarget = target;
            this.lastClickAt = now;

            this.dragging = true;
            this.dragTarget = target;
            this.snapGuides = [];
            this.dragOffset.x = mouseX - settings.x;
            this.dragOffset.y = mouseY - settings.y;

            this.editorOrder = this.editorOrder.filter((t) => t !== target);
            this.editorOrder.push(target);
            return;
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.dragging || !this.dragTarget) return;
        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();
        const settings = this.getTargetSettings(this.dragTarget);
        if (!settings) return;

        const box = this.editorBoxes[this.dragTarget];
        const border = box?.border || BORDER_WIDTH * settings.scale;
        const boxWidth = box?.width || 50 + border * 2;
        const boxHeight = box?.height || 20 + border * 2;
        let x = mouseX - this.dragOffset.x - border;
        let y = mouseY - this.dragOffset.y - border;

        const snap = (value, candidates) => {
            const nearest = candidates.reduce((best, candidate) => (Math.abs(candidate.value - value) < Math.abs(best.value - value) ? candidate : best), {
                value: Infinity,
            });
            return Math.abs(nearest.value - value) <= ELEMENT_SNAP_DISTANCE ? nearest : null;
        };
        const otherBoxes = Object.entries(this.editorBoxes).filter(([target]) => target !== this.dragTarget);
        const getSnapPositions = (axis, size, perpendicularStart, perpendicularSize) =>
            otherBoxes.reduce((positions, [target, other]) => {
                const perpendicularAxis = axis === 'x' ? 'y' : 'x';
                const otherPerpendicularStart = other[perpendicularAxis];
                const otherPerpendicularEnd = otherPerpendicularStart + other[perpendicularAxis === 'x' ? 'width' : 'height'];
                if (
                    perpendicularStart > otherPerpendicularEnd + ELEMENT_NEAR_DISTANCE ||
                    perpendicularStart + perpendicularSize < otherPerpendicularStart - ELEMENT_NEAR_DISTANCE
                )
                    return positions;

                const start = other[axis];
                const end = start + other[axis === 'x' ? 'width' : 'height'];
                return positions.concat([
                    { value: start, guide: start, target },
                    { value: end, guide: end, target },
                    { value: start - size, guide: start, target },
                    { value: end - size, guide: end, target },
                    { value: (start + end - size) / 2, guide: (start + end) / 2, target },
                ]);
            }, []);
        const elementX = snap(x, getSnapPositions('x', boxWidth, y, boxHeight));
        const elementY = snap(y, getSnapPositions('y', boxHeight, x, boxWidth));
        const skipGrid = Client.isAltDown();
        x = elementX?.value ?? (skipGrid ? x : Math.round(x / GRID_SIZE) * GRID_SIZE);
        y = elementY?.value ?? (skipGrid ? y : Math.round(y / GRID_SIZE) * GRID_SIZE);
        const clampedX = Math.max(0, Math.min(x, sw - boxWidth));
        const clampedY = Math.max(0, Math.min(y, sh - boxHeight));

        this.snapGuides = [
            ...(elementX && clampedX === x ? [{ axis: 'x', coordinate: elementX.guide, target: elementX.target }] : []),
            ...(elementY && clampedY === y ? [{ axis: 'y', coordinate: elementY.guide, target: elementY.target }] : []),
        ];

        settings.x = clampedX + border;
        settings.y = clampedY + border;
        this.pendingSave = true;
    }

    handleMouseRelease() {
        if (this.dragging) {
            this.dragging = false;
            this.dragTarget = null;
            this.snapGuides = [];
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

    clampToScreen(x, y, w, h, swOverride = null, shOverride = null, border = 0) {
        const sw = swOverride !== null ? swOverride : Render2D.screen.getWidth();
        const sh = shOverride !== null ? shOverride : Render2D.screen.getHeight();
        if (sw === 0 || sh === 0) return { x, y };

        return {
            x: Math.max(border, Math.min(x, sw - w - border)),
            y: Math.max(border, Math.min(y, sh - h - border)),
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
        Render2D.drawGradientRect(x, y, halfWidth, dividerHeight, edgeColor, centerColor, 'LeftToRight', 0);
        // right
        Render2D.drawGradientRect(x + halfWidth, y, halfWidth, dividerHeight, centerColor, edgeColor, 'LeftToRight', 0);
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

        let layout = id.renderLayout;
        if (!layout || layout.sections !== sections || layout.scale !== scale || layout.showUptime !== showUptime) {
            let contentBaseWidth = getTextWidth(id.name, fontSize);
            let calculatedHeight = 30 * scale;
            const renderSections = [];

            sections.forEach((section, sIdx) => {
                if (!section || typeof section !== 'object') return;
                const sectionLines = [];
                const title = section.title ? section.title.toUpperCase() : null;

                if (title) {
                    contentBaseWidth = Math.max(contentBaseWidth, getTextWidth(title, argFontSize * 0.85) + 10 * scale);
                    calculatedHeight += headerHeight - 4 * scale;
                }
                calculatedHeight += sectionGap;

                if (sIdx === 0 && showUptime) {
                    sectionLines.push({
                        label: 'Uptime:',
                        labelWidth: getTextWidth('Uptime:', argFontSize),
                        source: null,
                        value: null,
                        valueWidth: 0,
                        isUptime: true,
                    });
                }

                Object.entries(section.data || {}).forEach(([key, source]) => {
                    const label = `${key}:`;
                    sectionLines.push({
                        label,
                        labelWidth: getTextWidth(label, argFontSize),
                        source,
                        value: null,
                        valueWidth: 0,
                        isUptime: false,
                    });
                });

                calculatedHeight += sectionLines.length * rowHeight + 2 * scale;
                renderSections.push({ title, lines: sectionLines });
            });
            calculatedHeight += 6 * scale;
            layout = { sections, scale, showUptime, contentBaseWidth, calculatedHeight, renderSections };
            id.renderLayout = layout;
        }

        let contentMaxWidth = layout.contentBaseWidth;
        layout.renderSections.forEach((section) =>
            section.lines.forEach((line) => {
                const value = String(line.isUptime ? uptimeVal : typeof line.source === 'function' ? line.source() : line.source);
                if (value !== line.value) {
                    line.value = value;
                    line.valueWidth = getTextWidth(value, argFontSize);
                }
                contentMaxWidth = Math.max(contentMaxWidth, line.labelWidth + line.valueWidth + 25 * scale);
            })
        );
        const calculatedHeight = layout.calculatedHeight;
        const renderSections = layout.renderSections;

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
            const clamped = this.clampToScreen(x, y, id.width, id.height, sw, sh, BORDER_WIDTH * scale);
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
                Render2D.scissor(x, y, id.width, currentHeight);
                const titleY = y + 20 * scale;
                const titleX = x + id.width / 2;
                const titleAlign = 18;

                drawText(id.name, titleX + 1, titleY + 1, fontSize, colorWithAlpha(0xff000000, 0.35 * contentAlpha), titleAlign);
                drawText(id.name, titleX, titleY, fontSize, colorWithAlpha(THEME.TEXT, contentAlpha), titleAlign);

                let contentY = titleY + 10 * scale;

                renderSections.forEach((section) => {
                    this.drawSectionDivider(x + 10 * scale, contentY, id.width - 20 * scale, contentAlpha, accentColor);
                    contentY += 10 * scale;

                    const leftAlignX = x + basePadding;

                    if (section.title) {
                        drawText(section.title, leftAlignX, contentY, argFontSize * 0.8, colorWithAlpha(accentColor, contentAlpha), 17);
                        contentY += headerHeight - 6 * scale;
                    }

                    section.lines.forEach((line) => {
                        drawText(line.label, leftAlignX, contentY, argFontSize, colorWithAlpha(THEME.TEXT_MUTED, contentAlpha), 17);

                        const valueX = x + id.width - basePadding;
                        const valueColor = line.isUptime ? colorWithAlpha(accentColor, contentAlpha) : colorWithAlpha(THEME.TEXT, contentAlpha);

                        drawText(line.value, valueX, contentY, argFontSize, valueColor, 20);

                        contentY += rowHeight;
                    });
                    contentY += 4 * scale;
                });
            } finally {
                Render2D.resetScissor();
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
        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();
        if (sw === 0 || sh === 0) return;
        Render2D.blurBackground();
        const gridColor = colorWithAlpha(THEME.BORDER, 0.18);
        for (let x = GRID_SIZE; x < sw; x += GRID_SIZE) Render2D.drawRect(x, 0, 1, sh, gridColor);
        for (let y = GRID_SIZE; y < sh; y += GRID_SIZE) Render2D.drawRect(0, y, sw, 1, gridColor);
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

            Object.entries(this.editorBoxes).forEach(([target, box]) => {
                const border = BORDER_WIDTH * this.getTargetSettings(target).scale;
                this.editorBoxes[target] = {
                    x: box.x - border,
                    y: box.y - border,
                    width: box.width + border * 2,
                    height: box.height + border * 2,
                    border,
                };
            });

            const draggedBox = this.editorBoxes[this.dragTarget];
            this.snapGuides.forEach(({ axis, coordinate, target }) => {
                const otherBox = this.editorBoxes[target];
                if (!draggedBox || !otherBox) return;

                if (axis === 'x') {
                    Render2D.drawLine(
                        coordinate,
                        Math.min(draggedBox.y, otherBox.y),
                        coordinate,
                        Math.max(draggedBox.y + draggedBox.height, otherBox.y + otherBox.height),
                        1,
                        colorWithAlpha(THEME.NOTIF_DANGER, 0.9)
                    );
                } else {
                    Render2D.drawLine(
                        Math.min(draggedBox.x, otherBox.x),
                        coordinate,
                        Math.max(draggedBox.x + draggedBox.width, otherBox.x + otherBox.width),
                        coordinate,
                        1,
                        colorWithAlpha(THEME.NOTIF_DANGER, 0.9)
                    );
                }
            });

            this.editorOrder.forEach((target) => {
                const settings = this.getTargetSettings(target);
                const box = this.editorBoxes[target];
                if (!settings || !box) return;
                if (settings.enabled === false) {
                    const radiusScale = { default: 1, scheduler: 1, hudStats: 0.6, hudInventory: 0.55, music: 0.6 }[target];
                    drawRoundedRectangle({
                        ...box,
                        radius: CORNER_RADIUS * radiusScale * settings.scale + box.border,
                        color: colorWithAlpha(THEME.NOTIF_ERROR, 0.4),
                    });
                }
                if (this.dragging && target === this.dragTarget) {
                    const details = `X: ${Math.round(box.x)}  Y: ${Math.round(box.y)}  Scale: ${settings.scale.toFixed(1)}`;
                    const detailsY = box.y + box.height + 14 < sh ? box.y + box.height + 14 : box.y - 6;
                    drawText(details, box.x + box.width / 2, detailsY, FontSizes.MEDIUM, THEME.TEXT, 18);
                }
            });

            const text = 'Drag to move. Scroll to resize. Double-click to toggle. Hold Alt to skip the grid.';
            drawText(text, sw / 2, 30, FontSizes.MEDIUM, THEME.TEXT, 18);
        } catch (e) {
            console.error(e);
        }
    }

    drawAllOverlays() {
        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();
        if (sw === 0 || sh === 0) return;

        const visibleIds = this.ids.filter((id) => {
            const anim = this.animations[id.name];
            const settings = id.isScheduler ? this.schedulerSettings : this.settings;
            return settings.enabled !== false && anim && (anim.target > 0 || anim.progress > 0.01);
        });

        if (visibleIds.length === 0) {
            this.renderActive = false;
            this.updateRenderRegistration(false);
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
                    enabled: data.default.enabled !== false,
                };
            } else if (typeof data.x === 'number') {
                this.settings = {
                    x: data.x,
                    y: data.y,
                    scale: data.scale || 1.2,
                    enabled: data.enabled !== false,
                };
            }

            if (data.scheduler && typeof data.scheduler.x === 'number') {
                this.schedulerSettings = {
                    x: data.scheduler.x,
                    y: data.scheduler.y,
                    scale: data.scheduler.scale || 1.0,
                    enabled: data.scheduler.enabled !== false,
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
                    enabled: hudData.stats.enabled !== false,
                };
            }

            if (hudData.inventory && typeof hudData.inventory.x === 'number') {
                this.hudSettings.inventory = {
                    x: hudData.inventory.x,
                    y: hudData.inventory.y,
                    scale: typeof hudData.inventory.scale === 'number' ? hudData.inventory.scale : 1.0,
                    enabled: hudData.inventory.enabled !== false,
                };
            }
        }

        const musicData = getConfigFile('OverlayPositions/music_overlay.json');
        if (musicData && typeof musicData === 'object' && typeof musicData.x === 'number' && typeof musicData.y === 'number') {
            this.musicSettings = {
                x: musicData.x,
                y: musicData.y,
                scale: typeof musicData.scale === 'number' ? musicData.scale : 1.0,
                enabled: musicData.enabled !== false,
            };
        }
    }

    drawHudStatsPreview(sw, sh) {
        const lines = getStatsHudLines();
        const overlay = {
            ...this.hudSettings.stats,
            ...getStatsHudBounds(this.hudSettings.stats.scale, lines),
        };
        Object.assign(this.hudSettings.stats, this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh, BORDER_WIDTH * overlay.scale));
        Object.assign(overlay, this.hudSettings.stats);
        drawStatsHud(overlay, lines);
        return overlay;
    }

    drawHudInventoryPreview(sw, sh) {
        const overlay = {
            ...this.hudSettings.inventory,
            ...getInventoryHudBounds(this.hudSettings.inventory.scale),
        };
        Object.assign(
            this.hudSettings.inventory,
            this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh, BORDER_WIDTH * overlay.scale)
        );
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
        Object.assign(this.musicSettings, this.clampToScreen(overlay.x, overlay.y, overlay.width, overlay.height, sw, sh, BORDER_WIDTH * overlay.scale));
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
