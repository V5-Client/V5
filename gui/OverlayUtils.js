import { Chat } from '../utils/Chat';
import { Utils } from '../utils/Utils';
import { NVG } from '../utils/Constants';
import {
    drawRoundedRectangle,
    drawText,
    getTextWidth,
    FontSizes,
    THEME,
    isInside,
    drawRoundedRectangleWithBorder,
    colorWithAlpha,
    drawRect,
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
        this.boxPadding = PADDING || 40;
        this.minBoxHeight = 40;
        this.fontSize = FontSizes.LARGE;
        this.triggersInitialized = false;
        this.drawRegistered = false;

        this.loadIDs();
        this.initTriggers();

        if (this.ids.length > 0) {
            this.registerDrawOnce();
        }
    }

    initTriggers() {
        if (this.triggersInitialized) return;

        global.Overlays.Gui.registerClosed(() => openModuleGui());
        global.Overlays.Gui.registerClicked((mouseX, mouseY, button) => this.handleMouseClick(mouseX, mouseY, button));
        global.Overlays.Gui.registerMouseDragged((mouseX, mouseY, button) => {
            if (button === 0) this.handleMouseDrag(mouseX, mouseY);
        });
        global.Overlays.Gui.registerMouseReleased(() => this.handleMouseRelease());

        this.triggersInitialized = true;
    }

    registerDrawOnce() {
        if (this.drawRegistered) return;
        global.Overlays.Gui.registerDraw(() => this.drawGUI());
        this.drawRegistered = true;
    }

    createID(idName, args = {}) {
        let existing = this.ids.find((id) => id.name === idName);
        if (existing) {
            existing.args = args;
            return;
        }

        const textWidth = getTextWidth(idName, this.fontSize);
        const width = Math.max(150, textWidth + this.boxPadding * 2);

        const newId = {
            name: idName,
            args: args,
            x: 10,
            y: 10 + this.ids.length * 90,
            width: width,
            height: this.minBoxHeight,
        };

        this.ids.push(newId);
        this.saveIDs();
        this.registerDrawOnce();
    }

    handleMouseClick(mouseX, mouseY, button) {
        if (button !== 0) return;
        for (let i = this.ids.length - 1; i >= 0; i--) {
            const id = this.ids[i];
            if (isInside(mouseX, mouseY, id)) {
                this.draggingId = id;
                this.dragOffset.x = mouseX - id.x;
                this.dragOffset.y = mouseY - id.y;
                return;
            }
        }
    }

    handleMouseDrag(mouseX, mouseY) {
        if (this.draggingId) {
            let newX = mouseX - this.dragOffset.x;
            let newY = mouseY - this.dragOffset.y;
            const sw = Renderer.screen.getWidth();
            const sh = Renderer.screen.getHeight();

            newX = Math.max(0, Math.min(newX, sw - this.draggingId.width));
            newY = Math.max(0, Math.min(newY, sh - this.draggingId.height));

            this.draggingId.x = newX;
            this.draggingId.y = newY;
        }
    }

    handleMouseRelease() {
        if (this.draggingId) {
            this.draggingId = null;
            this.saveIDs();
        }
    }

    drawGUI() {
        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();
        if (sw === 0 || sh === 0 || this.ids.length === 0) return;

        Client.getMinecraft().gameRenderer.renderBlur();

        try {
            NVG.beginFrame(sw, sh);
            NVG.save();

            this.ids.forEach((id) => {
                const textWidth = getTextWidth(id.name, this.fontSize);
                const argCount = Object.keys(id.args || {}).length;
                const dynamicHeight = this.minBoxHeight + argCount * 18 + (argCount > 0 ? 10 : 0);

                id.width = Math.max(150, textWidth + this.boxPadding * 2);
                id.height = dynamicHeight;

                drawRoundedRectangleWithBorder({
                    x: id.x,
                    y: id.y,
                    width: id.width,
                    height: id.height,
                    radius: CORNER_RADIUS,
                    color: THEME.GUI_DRAW_BACKGROUND,
                    borderWidth: BORDER_WIDTH,
                    borderColor: THEME.GUI_DRAW_BACKGROUND_BORDER,
                });

                const centerX = id.x + id.width / 2;
                const textStartX = centerX - textWidth / 2;
                const textTopY = id.y + 12;

                drawText(id.name, textStartX, textTopY, this.fontSize, 0xffffffff, 16);

                const lineY = textTopY + 15;
                drawRect({
                    x: id.x + 10,
                    y: lineY,
                    width: id.width - 20,
                    height: 1,
                    color: colorWithAlpha(THEME.GUI_DRAW_BORDER, 0.3),
                });

                if (id.args) {
                    let yOffset = lineY + 10;
                    Object.entries(id.args).forEach(([key, value]) => {
                        drawText(`${key}: ${value}`, id.x + 15, yOffset, FontSizes.MEDIUM, 0xffcccccc, 16);
                        yOffset += 18;
                    });
                }
            });

            NVG.restore();
        } catch (e) {
            console.error('V5 GUI Error: ' + e);
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {}
        }
    }

    saveIDs() {
        const data = {};
        this.ids.forEach((id) => {
            data[id.name] = {
                x: id.x,
                y: id.y,
                args: id.args,
            };
        });
        Utils.writeConfigFile('overlays.json', data);
    }

    loadIDs() {
        const data = Utils.getConfigFile('overlays.json');
        if (!data || Object.keys(data).length === 0) return;

        try {
            this.ids = Object.keys(data).map((name) => {
                return {
                    name: name,
                    x: data[name].x,
                    y: data[name].y,
                    args: data[name].args || {},
                    width: 0,
                    height: this.minBoxHeight,
                };
            });
        } catch (e) {
            this.ids = [];
        }
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
