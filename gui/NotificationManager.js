import { THEME, colorWithAlpha, drawRoundedRectangle, drawText, FontSizes } from './Utils';
import { NVG } from '../utils/Constants';

// Configuration
const RENDER_ABOVE_GUI = true; // toggle rendering above guis
const NOTIFICATION_WIDTH = 250;
const NOTIFICATION_HEIGHT = 56;
const NOTIFICATION_PADDING = 10;
const NOTIFICATION_SPACING = 8;
const NOTIFICATION_MARGIN = 20;
const DEFAULT_NOTIFICATION_DURATION = 5000;
const ANIMATION_DURATION = 300;
const CORNER_RADIUS = 8;
const TEXT_TOP_PADDING = 21;
const TEXT_LINE_HEIGHT = 15;
const DESC_SCALE = 0.8;
const DESC_LINE_SPACING = 7;

// Colors
const BACKGROUND_COLOR = THEME.NOTIFICATION_BACKGROUND;
const ICON_BACKGROUND_COLOR = THEME.NOTIFICATION_ICON_BACKGROUND;
const ICON_SYMBOL_COLOR = THEME.NOTIFICATION_ICON_SYMBOL;
const TEXT_COLOR = THEME.NOTIFICATION_TEXT;
const DESCRIPTION_COLOR = THEME.NOTIFICATION_DESCRIPTION;
const CLOSE_BUTTON_COLOR = THEME.NOTIFICATION_CLOSE_BUTTON;
const PROGRESS_BAR_COLOR = THEME.NOTIFICATION_PROGRESS_BAR;

const NOTIFICATION_TYPES = {
    SUCCESS: {
        outlineColor: THEME.NOTIFICATION_SUCCESS,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.save();
            NVG.translate(centerX - 2, centerY + 4);
            NVG.rotate(-45);
            NVG.drawRect(-1.5, -7, 3, 8.5, color);
            NVG.drawRect(-1.5, -1.5, 14, 3, color);
            NVG.restore();
        },
    },
    ERROR: {
        outlineColor: THEME.NOTIFICATION_ERROR,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.save();
            NVG.translate(centerX, centerY);
            NVG.rotate(45);
            NVG.drawRect(-1.5, -7, 3, 14, color);
            NVG.drawRect(-7, -1.5, 14, 3, color);
            NVG.restore();
        },
    },
    DANGER: {
        outlineColor: THEME.NOTIFICATION_DANGER,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.drawRect(centerX - 1.5, centerY - 8, 3, 10, color);
            NVG.drawRect(centerX - 1.5, centerY + 4, 3, 3, color);
        },
    },
    'CHECK-IN': {
        outlineColor: THEME.NOTIFICATION_CHECK_IN,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.save();
            NVG.translate(centerX - 2, centerY + 4);
            NVG.rotate(-45);
            NVG.drawRect(-1.5, -7, 3, 8.5, color);
            NVG.drawRect(-1.5, -1.5, 14, 3, color);
            NVG.restore();
        },
    },
    WARNING: {
        outlineColor: THEME.NOTIFICATION_WARNING,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.drawRect(centerX - 1.5, centerY - 8, 3, 10, color);
            NVG.drawRect(centerX - 1.5, centerY + 4, 3, 3, color);
        },
    },
    INFO: {
        outlineColor: THEME.NOTIFICATION_INFO,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            NVG.drawRect(centerX - 1.5, centerY - 8, 3, 3, color);
            NVG.drawRect(centerX - 1.5, centerY - 3, 3, 10, color);
        },
    },
};

class Notification {
    constructor(title, description, type = 'SUCCESS', duration = DEFAULT_NOTIFICATION_DURATION) {
        this.title = title;
        this.description = description;
        this.type = NOTIFICATION_TYPES[type] ? type : 'SUCCESS';
        this.duration = duration;
        this.isSticky = duration === 'sticky';
        this.createdAt = Date.now();
        this.state = 'entering';
        this.animationStart = Date.now();
        this.x = Renderer.screen.getWidth();
        this.targetX = Renderer.screen.getWidth() - NOTIFICATION_WIDTH - NOTIFICATION_MARGIN;
        this.y = Renderer.screen.getHeight();
        this.targetY = 0;
        this.opacity = 0;
        this.closeHovered = false;
        this.closeSize = 14;
        this.closeClickSize = 20;
        this.closeXOffset = NOTIFICATION_WIDTH - 24;
        this.height = NOTIFICATION_HEIGHT;
        this.closeYOffset = 0;
        this.layoutCalculated = false;
        this.wrappedDescription = [];
    }

    wrapText(text, maxWidth) {
        if (text instanceof Error) text = text.message;
        if (!text) return [''];
        const words = text.split(' ');
        if (!words.length) return [''];
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + ' ' + word;
            if (NVG.textWidth(testLine, FontSizes.TINY, NVG.defaultFont) > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    calculateLayout() {
        const iconWidth = 24;
        const textMargin = 8;
        const closeButtonArea = 40;
        const textXOffset = NOTIFICATION_PADDING + iconWidth + textMargin;

        const maxLineWidth = NOTIFICATION_WIDTH - textXOffset - closeButtonArea;

        this.wrappedDescription = this.wrapText(this.description, maxLineWidth);
        const baseHeight = NOTIFICATION_HEIGHT;
        const extraLines = Math.max(0, this.wrappedDescription.length - 1);
        this.height = baseHeight + extraLines * DESC_LINE_SPACING;
        this.closeYOffset = this.height / 2 - this.closeClickSize / 2;
        this.layoutCalculated = true;
    }

    update() {
        if (!this.layoutCalculated) {
            this.calculateLayout();
            notificationManager.updatePositions();
        }

        const now = Date.now();
        const lifetime = now - this.createdAt;
        if (this.state === 'entering') {
            const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
            const eased = this.easeOutCubic(progress);
            this.x = Renderer.screen.getWidth() + (this.targetX - Renderer.screen.getWidth()) * eased;
            this.opacity = eased;
            const yDiff = this.targetY - this.y;
            if (Math.abs(yDiff) > 0.5) this.y += yDiff * 0.3;
            else this.y = this.targetY;
            if (progress >= 1) {
                this.state = 'active';
                this.x = this.targetX;
            }
        } else if (this.state === 'active') {
            this.x = this.targetX;
            this.opacity = 1;
            const yDiff = this.targetY - this.y;
            if (Math.abs(yDiff) > 0.5) this.y += yDiff * 0.3;
            else this.y = this.targetY;
            if (!this.isSticky && lifetime >= this.duration) this.startExit();
        } else if (this.state === 'exiting') {
            const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
            this.x = this.exitX + (Renderer.screen.getWidth() - this.exitX) * progress;
            this.opacity = 1 - progress;
            this.y = this.exitY;
            if (progress >= 1) this.state = 'removed';
        }
    }

    startExit() {
        if (this.state !== 'exiting') {
            this.state = 'exiting';
            this.animationStart = Date.now();
            this.exitX = this.x;
            this.exitY = this.y;
        }
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    draw(mouseX, mouseY) {
        if (this.state === 'removed') return;

        const alpha = this.opacity;
        const typeInfo = NOTIFICATION_TYPES[this.type] || NOTIFICATION_TYPES['SUCCESS'];
        const bgColor = colorWithAlpha(BACKGROUND_COLOR, alpha);

        drawRoundedRectangle({
            x: this.x,
            y: this.y,
            width: NOTIFICATION_WIDTH,
            height: this.height,
            radius: CORNER_RADIUS,
            color: bgColor,
        });

        const iconBgX = this.x + NOTIFICATION_PADDING;
        const iconBgY = this.y + this.height / 2 - 12;
        const iconBgSize = 24;

        const outlineColor = colorWithAlpha(typeInfo.outlineColor, alpha);
        drawRoundedRectangle({
            x: iconBgX - 1,
            y: iconBgY - 1,
            width: iconBgSize + 2,
            height: iconBgSize + 2,
            radius: 7,
            color: outlineColor,
        });
        // Main bg
        drawRoundedRectangle({
            x: iconBgX,
            y: iconBgY,
            width: iconBgSize,
            height: iconBgSize,
            radius: 6,
            color: bgColor,
        });
        // Tinted overlay
        const iconTint = colorWithAlpha(typeInfo.outlineColor, alpha * 0.2);
        drawRoundedRectangle({
            x: iconBgX,
            y: iconBgY,
            width: iconBgSize,
            height: iconBgSize,
            radius: 6,
            color: iconTint,
        });

        if (typeInfo.iconDrawer) {
            typeInfo.iconDrawer(iconBgX + iconBgSize / 2, iconBgY + iconBgSize / 2, Math.floor(alpha * 255));
        }

        const textX = iconBgX + iconBgSize + 8;
        const titleY = this.y + TEXT_TOP_PADDING;
        const descY = titleY + TEXT_LINE_HEIGHT;

        const textAlpha = colorWithAlpha(TEXT_COLOR, alpha);
        const descAlpha = colorWithAlpha(DESCRIPTION_COLOR, alpha);

        drawText(this.title, textX, titleY, FontSizes.LARGE, textAlpha);

        this.wrappedDescription.forEach((line, index) => {
            const currentDescY = descY + index * DESC_LINE_SPACING;
            drawText(line, textX, currentDescY, FontSizes.TINY, descAlpha);
        });

        const closeX = this.x + this.closeXOffset;
        const closeY = this.y + this.closeYOffset;
        const closeColor = (Math.floor(alpha * 255) << 24) | CLOSE_BUTTON_COLOR;
        NVG.save();
        NVG.translate(closeX + this.closeClickSize / 2, closeY + this.closeClickSize / 2);
        NVG.rotate(45);
        NVG.drawRect(-0.75, -5, 1.5, 10, closeColor);
        NVG.drawRect(-5, -0.75, 10, 1.5, closeColor);
        NVG.restore();

        if (this.state === 'active' && !this.isSticky) {
            const progress = 1 - (Date.now() - this.createdAt) / this.duration;
            const progressBarWidth = NOTIFICATION_WIDTH * progress;
            const progressColor = colorWithAlpha(PROGRESS_BAR_COLOR, alpha);

            if (progressBarWidth > 0.5) {
                NVG.save();
                NVG.scissor(this.x, this.y + this.height - 4, progressBarWidth, 4);

                drawRoundedRectangle({
                    x: this.x,
                    y: this.y,
                    width: NOTIFICATION_WIDTH,
                    height: this.height,
                    radius: CORNER_RADIUS,
                    color: progressColor,
                });

                NVG.resetScissor();
                NVG.restore();
            }
        }
    }

    handleClick(mouseX, mouseY) {
        const closeX = this.x + this.closeXOffset;
        const closeY = this.y + this.closeYOffset;

        const buffer = 5;

        if (
            mouseX >= closeX - buffer &&
            mouseX <= closeX + this.closeClickSize + buffer &&
            mouseY >= closeY - buffer &&
            mouseY <= closeY + this.closeClickSize + buffer
        ) {
            this.startExit();
            return true;
        }
        return false;
    }
}

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.renderTrigger = null;
        this.guiRenderTrigger = null;
        this.clickTrigger = null;
        this.tickTrigger = null;
    }

    registerEvents() {
        if (!this.renderTrigger) {
            this.renderTrigger = register('renderOverlay', () => {
                if (!RENDER_ABOVE_GUI || !Client.isInGui()) {
                    this.render();
                }
            });
        }

        if (RENDER_ABOVE_GUI && !this.guiRenderTrigger) {
            this.guiRenderTrigger = register('postGuiRender', (mouseX, mouseY, gui) => {
                this.renderAboveGui();
            });
        }

        if (!this.clickTrigger) {
            this.clickTrigger = register('guiMouseClick', (mouseX, mouseY, button) => {
                if (button === 0) this.handleClick(mouseX, mouseY);
            });
        }
        if (!this.tickTrigger) {
            this.tickTrigger = register('tick', () => this.update());
        }
    }

    unregisterEvents() {
        if (this.renderTrigger) {
            this.renderTrigger.unregister();
            this.renderTrigger = null;
        }
        if (this.guiRenderTrigger) {
            this.guiRenderTrigger.unregister();
            this.guiRenderTrigger = null;
        }
        if (this.clickTrigger) {
            this.clickTrigger.unregister();
            this.clickTrigger = null;
        }
        if (this.tickTrigger) {
            this.tickTrigger.unregister();
            this.tickTrigger = null;
        }
    }
    add(title, description, type = 'SUCCESS', duration = DEFAULT_NOTIFICATION_DURATION) {
        if (this.notifications.length === 0) this.registerEvents();
        const notification = new Notification(title, description, type, duration);
        this.notifications.unshift(notification);
        this.updatePositions();
    }
    update() {
        this.notifications.forEach((n) => n.update());
        const beforeCount = this.notifications.length;
        this.notifications = this.notifications.filter((n) => n.state !== 'removed');
        if (this.notifications.length !== beforeCount) this.updatePositions();
        if (beforeCount > 0 && this.notifications.length === 0) this.unregisterEvents();
    }
    updatePositions() {
        let yOffset = 0;
        this.notifications.forEach((notification) => {
            const targetY = Renderer.screen.getHeight() - NOTIFICATION_MARGIN - notification.height - yOffset;
            notification.targetY = targetY;
            yOffset += notification.height + NOTIFICATION_SPACING;
        });
    }
    render() {
        try {
            NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
            const mouseX = Client.getMouseX();
            const mouseY = Client.getMouseY();
            for (let i = this.notifications.length - 1; i >= 0; i--) {
                this.notifications[i].draw(mouseX, mouseY);
            }
        } catch (e) {
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {}
        }
    }
    renderAboveGui() {
        try {
            NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
            const mouseX = Client.getMouseX();
            const mouseY = Client.getMouseY();
            for (let i = this.notifications.length - 1; i >= 0; i--) {
                this.notifications[i].draw(mouseX, mouseY);
            }
        } catch (e) {
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {}
        }
    }
    handleClick(mouseX, mouseY) {
        for (let i = 0; i < this.notifications.length; i++) {
            if (this.notifications[i].handleClick(mouseX, mouseY)) break;
        }
    }
    destroy() {
        this.unregisterEvents();
    }
}

const notificationManager = new NotificationManager();

export { notificationManager };

export const showNotification = (title, description, type = 'SUCCESS', duration = DEFAULT_NOTIFICATION_DURATION) => {
    notificationManager.add(title, description, type, duration);
};
