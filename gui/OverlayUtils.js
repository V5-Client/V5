import { Utils } from '../utils/Utils';
import { NVG } from '../utils/Constants';
import {
    drawText,
    getTextWidth,
    FontSizes,
    THEME,
    isInside,
    drawRoundedRectangleWithBorder,
    colorWithAlpha,
    drawRect,
    drawShadow,
    PADDING,
    BORDER_WIDTH,
    CORNER_RADIUS,
} from './Utils';

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

        this.mainRenderTrigger = register('renderOverlay', () => {
            if (global.Overlays.Gui.isOpen()) return;
            this.drawAllOverlays();
        }).unregister();

        this.loadIDs();
        this.initTriggers();

        if (this.ids.length > 0) {
            this.registerDrawOnce();
        }
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
        if (!startTime) return '0.00';
        const diff = Date.now() - startTime;
        const totalSeconds = Math.floor(diff / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const ms = Math.floor((diff % 1000) / 10)
            .toString()
            .padStart(2, '0');
        let timeStr = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:` : m > 0 ? `${m}:` : '';
        return `${timeStr}${s.toString().padStart(m > 0 || h > 0 ? 2 : 1, '0')}.${ms}`;
    }

    initTriggers() {
        global.Overlays.Gui.registerClosed(() => openModuleGui());
        global.Overlays.Gui.registerClicked((x, y, b) => b === 0 && this.handleMouseClick(x, y));
        global.Overlays.Gui.registerMouseDragged((x, y, b) => b === 0 && this.handleMouseDrag(x, y));
        global.Overlays.Gui.registerMouseReleased(() => this.handleMouseRelease());
    }

    registerDrawOnce() {
        if (this.drawRegistered) return;
        global.Overlays.Gui.registerDraw(() => this.drawGUI());
        this.drawRegistered = true;
    }

    createID(idName, sections = []) {
        let existing = this.ids.find((id) => id.name === idName);
        if (existing) {
            existing.sections = sections;
        } else {
            const textWidth = getTextWidth(idName, this.fontSize);
            const width = Math.max(160 * this.scale, textWidth + this.boxPadding * 2);
            const newId = {
                name: idName,
                sections: sections,
                x: 10,
                y: 10 + this.ids.length * (80 * this.scale),
                width: width,
                height: this.minBoxHeight,
            };
            this.ids.push(newId);
        }

        if (!this.animations[idName]) {
            this.animations[idName] = { progress: 0, target: 0 };
        }
        this.saveIDs();
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
    }

    handleMouseRelease() {
        if (this.draggingId) {
            this.draggingId = null;
            this.saveIDs();
        }
    }

    renderID(id, forceGUI = false) {
        const anim = this.animations[id.name];
        let progress = anim ? anim.progress : 0;
        if (forceGUI) progress = 1.0;

        if (!forceGUI && (!anim || (anim.target === 0 && anim.progress <= 0.01))) return;

        const uptimeVal = this.formatUptime(this.startTimes[id.name]);
        let runningY = 25 * this.scale;
        let maxWidth = getTextWidth(id.name, this.fontSize) + this.boxPadding * 2;

        id.sections.forEach((section) => {
            runningY += 30 * this.scale;
            Object.entries(section.data).forEach(([k, v]) => {
                const lineW = getTextWidth(`${k}: ${v}`, this.argFontSize) + 35 * this.scale;
                if (lineW > maxWidth) maxWidth = lineW;
                runningY += 16 * this.scale;
            });
        });

        id.width = Math.max(160 * this.scale, maxWidth);
        id.height = Math.max(this.minBoxHeight, runningY + 10 * this.scale);
        const currentHeight = id.height * progress;

        NVG.resetScissor();
        NVG.scissor(id.x - 5, id.y - 5, id.width + 10, currentHeight + 10);
        drawShadow(id.x, id.y, id.width, currentHeight, 10 * this.scale, 0.35 * progress);
        drawRoundedRectangleWithBorder({
            x: id.x,
            y: id.y,
            width: id.width,
            height: currentHeight,
            radius: CORNER_RADIUS * this.scale,
            color: THEME.GUI_DRAW_BACKGROUND,
            borderWidth: BORDER_WIDTH * this.scale,
            borderColor: THEME.GUI_DRAW_BACKGROUND_BORDER,
        });

        if (progress > 0.4) {
            const titleY = id.y + 13 * this.scale;
            drawText(id.name, id.x + id.width / 2 - getTextWidth(id.name, this.fontSize) / 2, titleY, this.fontSize, colorWithAlpha(0xffffffff, progress), 16);
            let contentY = titleY + 15 * this.scale;
            id.sections.forEach((section, sIdx) => {
                drawRect({
                    x: id.x + 10 * this.scale,
                    y: contentY,
                    width: id.width - 20 * this.scale,
                    height: 1,
                    color: colorWithAlpha(THEME.GUI_DRAW_BORDER, 0.2 * progress),
                });
                contentY += 8 * this.scale;
                const secTitle = section.title.toUpperCase();
                drawText(
                    secTitle,
                    id.x + id.width / 2 - getTextWidth(secTitle, this.argFontSize * 0.9) / 2,
                    contentY,
                    this.argFontSize * 0.9,
                    colorWithAlpha(0xffaaaaaa, progress),
                    16
                );
                contentY += 14 * this.scale;
                const renderLine = (label, val) => {
                    drawText(label, id.x + 15 * this.scale, contentY, this.argFontSize, colorWithAlpha(0xffffffff, progress), 16);
                    drawText(
                        String(val),
                        id.x + 15 * this.scale + getTextWidth(label, this.argFontSize),
                        contentY,
                        this.argFontSize,
                        colorWithAlpha(0xff99a3b0, progress),
                        16
                    );
                    contentY += 16 * this.scale;
                };
                if (sIdx === 0) renderLine('Uptime: ', uptimeVal);
                Object.entries(section.data).forEach(([k, v]) => renderLine(`${k}: `, v));
                contentY += 5 * this.scale;
            });
        }
        NVG.resetScissor();
    }

    drawGUI() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || this.ids.length === 0) return;
        Client.getMinecraft().gameRenderer.renderBlur();
        try {
            NVG.beginFrame(sw, sh);
            this.ids.forEach((id) => {
                this.renderID(id, true);
            });
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
        } finally {
            NVG.endFrame();
        }
        if (!anyVisible && !this.stepTrigger) {
            this.mainRenderTrigger.unregister();
        }
    }

    saveIDs() {
        const data = {};
        this.ids.forEach((id) => (data[id.name] = { x: id.x, y: id.y, sections: id.sections }));
        Utils.writeConfigFile('overlays.json', data);
    }

    loadIDs() {
        const data = Utils.getConfigFile('overlays.json') || {};
        this.ids = Object.keys(data).map((name) => ({
            name,
            x: data[name].x,
            y: data[name].y,
            sections: data[name].sections || [],
            width: 0,
            height: this.minBoxHeight,
        }));
    }

    openPositionsGUI() {
        this.loadIDs();
        global.GuiState.myGui.close();
        global.Overlays.Gui.open();
    }

    closePositionsGUI() {
        global.GuiState.isOpening = true;
        loadSettings();
        global.GuiState.myGui.open();
    }
}

export const OverlayManager = new OverlayUtils();

const openModuleGui = () => {
    let waitTrigger = register('tick', () => {
        OverlayManager.closePositionsGUI();
        waitTrigger.unregister();
    });
};
