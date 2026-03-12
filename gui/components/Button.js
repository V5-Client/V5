import {
    FontSizes,
    PADDING,
    THEME,
    clamp,
    colorWithAlpha,
    createHighlight,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawText,
    getTextWidth,
    isInside,
    playClickSound,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';

const PRESS_ANIM_DURATION = 120;

export class Button {
    constructor(title, x, y, buttonText = 'Press', callback = null, options = {}) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.buttonText = buttonText;
        this.callback = callback;
        this.showContainer = options.showContainer !== false;

        this.optionPanelWidth = 0;
        this.containerHeight = 48;
        this.description = null;
        this.highlight = createHighlight();
        this.buttonRect = {};

        this.pressProgress = 0;
        this.pressLastUpdate = 0;
    }

    setButtonText(text) {
        this.buttonText = text;
    }

    startHighlight() {
        this.highlight.startHighlight();
    }

    drawHighlight(panelWidth, panelHeight) {
        this.highlight.draw({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: panelHeight,
            accentColor: THEME.ACCENT,
            accentFillColor: THEME.ACCENT_DIM,
        });
    }

    updateHoverPress() {
        const now = Date.now();
        if (this.pressLastUpdate) {
            const pressDelta = clamp((now - this.pressLastUpdate) / PRESS_ANIM_DURATION, 0, 1);
            this.pressProgress = clamp(this.pressProgress - pressDelta, 0, 1);
            this.pressLastUpdate = this.pressProgress > 0 ? now : 0;
        }
    }

    triggerPressFeedback() {
        this.pressProgress = 1;
        this.pressLastUpdate = Date.now();
    }

    draw(mouseX, mouseY) {
        const componentHeight = this.containerHeight;
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const buttonPadding = 10;
        const buttonHeight = 22;
        const buttonTextWidth = getTextWidth(this.buttonText, FontSizes.REGULAR);
        const buttonWidth = Math.max(64, buttonTextWidth + buttonPadding * 2);

        if (this.showContainer) {
            this.drawHighlight(panelWidth, componentHeight);

            drawRoundedRectangleWithBorder({
                x: this.x,
                y: this.y,
                width: panelWidth,
                height: componentHeight,
                radius: 10,
                color: THEME.BG_COMPONENT,
                borderWidth: 1,
                borderColor: THEME.BORDER,
            });

            drawText(this.title, this.x + 12, this.y + componentHeight / 2, FontSizes.REGULAR, THEME.TEXT);
        }

        const buttonX = this.showContainer ? this.x + panelWidth - buttonWidth - 12 : this.x;
        const buttonY = this.showContainer ? this.y + componentHeight / 2 - buttonHeight / 2 : this.y;

        this.buttonRect = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight,
        };

        this.updateHoverPress();

        const pressedColor = colorWithAlpha(THEME.BG_INSET, 0.45 * this.pressProgress);
        drawRoundedRectangle({
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight,
            radius: 6,
            color: THEME.BG_INSET,
        });
        if (this.pressProgress > 0) {
            drawRoundedRectangle({
                x: buttonX,
                y: buttonY,
                width: buttonWidth,
                height: buttonHeight,
                radius: 6,
                color: pressedColor,
            });
        }

        const pressOffset = this.pressProgress > 0 ? 1 : 0;
        const textX = buttonX + buttonWidth / 2 - buttonTextWidth / 2;
        const textY = buttonY + buttonHeight / 2 + pressOffset;
        drawText(this.buttonText, textX, textY, FontSizes.REGULAR, THEME.TEXT);

        const tooltipRect = this.showContainer
            ? {
                  x: this.x,
                  y: this.y,
                  width: panelWidth,
                  height: componentHeight,
              }
            : this.buttonRect;

        if (this.description && isInside(mouseX, mouseY, tooltipRect)) {
            setTooltip(this.description);
        }
    }

    handleClick(mouseX, mouseY) {
        if (isInside(mouseX, mouseY, this.buttonRect)) {
            this.triggerPressFeedback();
            playClickSound();
            if (this.callback) this.callback();
            return true;
        }
        return false;
    }
}
