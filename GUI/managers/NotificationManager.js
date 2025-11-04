import { UIRoundedRectangle, Matrix, Color } from '../../Utility/Constants';
import { THEME } from '../utils/theme';
import { isInside, colorWithAlpha } from '../utils/helpers';

// Configuration
const RENDER_ABOVE_GUI = true;
const NOTIFICATION_WIDTH = 250;
const NOTIFICATION_HEIGHT = 56;
const NOTIFICATION_SPACING = 8;
const NOTIFICATION_MARGIN = 20;
const DEFAULT_NOTIFICATION_DURATION = 5000;
const ANIMATION_DURATION = 300;
const CORNER_RADIUS = 8;
const TEXT_TOP_PADDING = 18;
const TEXT_LINE_HEIGHT = 14;
const DESC_SCALE = 0.8;
const DESC_LINE_SPACING = 10;

// Colors
const BACKGROUND_COLOR = THEME.NOTIFICATION_BACKGROUND;
const ICON_BACKGROUND_COLOR = THEME.NOTIFICATION_ICON_BACKGROUND;
const ICON_SYMBOL_COLOR = THEME.NOTIFICATION_ICON_SYMBOL;
const TEXT_COLOR = THEME.NOTIFICATION_TEXT;
const DESCRIPTION_COLOR = THEME.NOTIFICATION_DESCRIPTION;
const CLOSE_BUTTON_COLOR = THEME.NOTIFICATION_CLOSE_BUTTON;
const CLOSE_BUTTON_HOVER_COLOR = THEME.NOTIFICATION_CLOSE_BUTTON_HOVER;
const PROGRESS_BAR_COLOR = THEME.NOTIFICATION_PROGRESS_BAR;

const NOTIFICATION_TYPES = {
    SUCCESS: {
        outlineColor: THEME.NOTIFICATION_SUCCESS,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            const points = [
                { x: -6, y: 0 },
                { x: -2, y: 4 },
                { x: 6, y: -4 },
            ];
            for (let i = 0; i < points.length - 1; i++) {
                const x1 = centerX + points[i].x;
                const y1 = centerY + points[i].y;
                const x2 = centerX + points[i + 1].x;
                const y2 = centerY + points[i + 1].y;
                Renderer.drawLine(color, x1, y1, x2, y2, 2);
            }
        },
    },
    ERROR: {
        outlineColor: THEME.NOTIFICATION_ERROR,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            const size = 5;
            Renderer.drawLine(color, centerX - size, centerY - size, centerX + size, centerY + size, 2);
            Renderer.drawLine(color, centerX - size, centerY + size, centerX + size, centerY - size, 2);
        },
    },
    DANGER: {
        outlineColor: THEME.NOTIFICATION_DANGER,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 8);
            Renderer.drawRect(color, centerX - 1.5, centerY + 4, 3, 3);
        },
    },
    'CHECK-IN': {
        outlineColor: THEME.NOTIFICATION_CHECK_IN,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            const points = [
                { x: 0, y: 1 },
                { x: 3, y: 4 },
                { x: 8, y: -4 },
            ];
            for (let i = 0; i < points.length - 1; i++) {
                const x1 = centerX + points[i].x - 4;
                const y1 = centerY + points[i].y;
                const x2 = centerX + points[i + 1].x - 4;
                const y2 = centerY + points[i + 1].y;
                Renderer.drawLine(color, x1, y1, x2, y2, 2);
            }
        },
    },
    WARNING: {
        outlineColor: THEME.NOTIFICATION_WARNING,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 8);
            Renderer.drawRect(color, centerX - 1.5, centerY + 4, 3, 3);
        },
    },
    INFO: {
        outlineColor: THEME.NOTIFICATION_INFO,
        iconDrawer: (centerX, centerY, alpha) => {
            const color = (alpha << 24) | ICON_SYMBOL_COLOR;
            Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 3);
            Renderer.drawRect(color, centerX - 1.5, centerY - 2, 3, 8);
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

        this.calculateLayout();
    }

    wrapText(text, maxWidth) {
        if (text instanceof Error) {
            text = text.message;
        }
        if (!text) return [''];
        const words = text.split(' ');
        if (!words.length) return [''];
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + ' ' + word;
            if (Renderer.getStringWidth(testLine) > maxWidth) {
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
        const closeButtonArea = 30;

        const textXOffset = 10 + iconWidth + textMargin;
        const maxLineWidth = (NOTIFICATION_WIDTH - textXOffset - closeButtonArea) / DESC_SCALE;

        this.wrappedDescription = this.wrapText(this.description, maxLineWidth);

        const baseHeight = NOTIFICATION_HEIGHT;
        const extraLines = Math.max(0, this.wrappedDescription.length - 1);
        this.height = baseHeight + extraLines * DESC_LINE_SPACING;
    }

    update() {
        const now = Date.now();
        const lifetime = now - this.createdAt;

        if (this.state === 'entering') {
            const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
            const eased = this.easeOutCubic(progress);
            this.x = Renderer.screen.getWidth() - (Renderer.screen.getWidth() - this.targetX) * eased;
            this.opacity = eased;

            if (progress >= 1) this.state = 'active';
        } else if (this.state === 'active') {
            this.x = this.targetX;
            this.opacity = 1;

            if (!this.isSticky && lifetime >= this.duration) {
                this.startExit();
            }
        } else if (this.state === 'exiting') {
            const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
            const eased = this.easeInCubic(progress);
            this.x = this.targetX + (Renderer.screen.getWidth() - this.targetX) * eased;
            this.opacity = 1 - eased;

            if (progress >= 1) this.state = 'removed';
        }

        const yDiff = this.targetY - this.y;
        if (Math.abs(yDiff) > 0.5) {
            this.y += yDiff * 0.3;
        } else {
            this.y = this.targetY;
        }
    }

    startExit() {
        if (this.state !== 'exiting') {
            this.state = 'exiting';
            this.animationStart = Date.now();
        }
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInCubic(t) {
        return t * t * t;
    }

    draw(mouseX, mouseY) {
        if (this.state === 'removed') return;

        const alpha = this.opacity;
        const typeInfo = NOTIFICATION_TYPES[this.type];

        const bgColor = colorWithAlpha(BACKGROUND_COLOR, alpha);
        UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, this.x, this.y, this.x + NOTIFICATION_WIDTH, this.y + this.height, CORNER_RADIUS, bgColor);

        const iconBgX = this.x + 10;
        const iconBgY = this.y + this.height / 2 - 12;
        const iconBgSize = 24;

        const outlineColor = colorWithAlpha(typeInfo.outlineColor, alpha);
        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            iconBgX - 1,
            iconBgY - 1,
            iconBgX + iconBgSize + 1,
            iconBgY + iconBgSize + 1,
            7,
            outlineColor
        );

        const iconBgColor = colorWithAlpha(ICON_BACKGROUND_COLOR, alpha);
        UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, iconBgX, iconBgY, iconBgX + iconBgSize, iconBgY + iconBgSize, 6, iconBgColor);

        typeInfo.iconDrawer(iconBgX + iconBgSize / 2, iconBgY + iconBgSize / 2, Math.floor(alpha * 255));

        const textX = iconBgX + iconBgSize + 8;
        const titleY = this.y + TEXT_TOP_PADDING;
        const descY = titleY + TEXT_LINE_HEIGHT;

        const textAlpha = (Math.floor(alpha * 255) << 24) | TEXT_COLOR;
        const descAlpha = (Math.floor(alpha * 255) << 24) | DESCRIPTION_COLOR;

        Renderer.drawString(this.title, textX, titleY, textAlpha, false);

        Renderer.scale(DESC_SCALE, DESC_SCALE);
        this.wrappedDescription.forEach((line, index) => {
            const currentDescY = descY + index * DESC_LINE_SPACING;
            Renderer.drawString(line, textX / DESC_SCALE, currentDescY / DESC_SCALE, descAlpha, false);
        });
        Renderer.scale(1 / DESC_SCALE, 1 / DESC_SCALE);

        const closeX = this.x + NOTIFICATION_WIDTH - 30;
        const closeY = this.y + this.height / 2 - 10;
        const closeSize = 20;

        const closeRect = {
            x: closeX,
            y: closeY,
            width: closeSize,
            height: closeSize,
        };
        this.closeHovered = isInside(mouseX, mouseY, closeRect);

        if (this.closeHovered) {
            const hoverColor = colorWithAlpha(CLOSE_BUTTON_HOVER_COLOR, alpha);
            UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, closeX, closeY, closeX + closeSize, closeY + closeSize, 4, hoverColor);
        }

        this.drawXSymbol(closeX + closeSize / 2, closeY + closeSize / 2, Math.floor(alpha * 255));

        if (this.state === 'active' && !this.isSticky) {
            const progress = 1 - (Date.now() - this.createdAt) / this.duration;
            const progressBarHeight = 4;
            const progressBarWidth = NOTIFICATION_WIDTH * progress;

            const progressColor = colorWithAlpha(PROGRESS_BAR_COLOR, alpha);

            if (progressBarWidth > 0) {
                const scale = Renderer.screen.getScale();
                const screenHeight = Renderer.screen.getHeight();

                const scissorY = screenHeight - (this.y + this.height) - 1;
                const scissorHeight = progressBarHeight;

                GL11.glEnable(GL11.GL_SCISSOR_TEST);
                GL11.glScissor(
                    Math.round(this.x * scale),
                    Math.round(scissorY * scale),
                    Math.round(progressBarWidth * scale),
                    Math.round(scissorHeight * scale)
                );

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    Matrix,
                    this.x,
                    this.y,
                    this.x + NOTIFICATION_WIDTH,
                    this.y + this.height,
                    CORNER_RADIUS,
                    progressColor
                );

                GL11.glDisable(GL11.GL_SCISSOR_TEST);
            }
        }
    }

    drawXSymbol(centerX, centerY, alpha) {
        const color = (alpha << 24) | CLOSE_BUTTON_COLOR;
        const size = 4;
        Renderer.drawLine(color, centerX - size, centerY - size, centerX + size, centerY + size, 1.5);
        Renderer.drawLine(color, centerX - size, centerY + size, centerX + size, centerY - size, 1.5);
    }

    handleClick(mouseX, mouseY) {
        if (this.closeHovered) {
            this.startExit();
            return true;
        }
        return false;
    }
}

export class NotificationManager {
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
            this.guiRenderTrigger = register('postGuiRender', () => {
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
        if (this.notifications.length === 0) {
            this.registerEvents();
        }

        const notification = new Notification(title, description, type, duration);
        this.notifications.unshift(notification);
        this.updatePositions();
    }

    update() {
        this.notifications.forEach((n) => n.update());

        const beforeCount = this.notifications.length;
        this.notifications = this.notifications.filter((n) => n.state !== 'removed');

        if (this.notifications.length !== beforeCount) {
            this.updatePositions();
        }

        if (beforeCount > 0 && this.notifications.length === 0) {
            this.unregisterEvents();
        }
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
        const mouseX = Client.getMouseX();
        const mouseY = Client.getMouseY();

        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].draw(mouseX, mouseY);
        }
    }

    renderAboveGui() {
        const mouseX = Client.getMouseX();
        const mouseY = Client.getMouseY();

        Renderer.translate(0, 0, 500);

        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].draw(mouseX, mouseY);
        }

        Renderer.translate(0, 0, -500);
    }

    handleClick(mouseX, mouseY) {
        for (const notification of this.notifications) {
            if (notification.handleClick(mouseX, mouseY)) break;
        }
    }

    destroy() {
        this.unregisterEvents();
    }
}
