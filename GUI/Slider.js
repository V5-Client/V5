import { Color, Matrix, UIRoundedRectangle } from '../Utility/Constants';

import {
    clamp,
    playClickSound,
    drawRoundedRectangleWithBorder,
    THEME,
    isInside,
} from './Utils';

export class Slider {
    constructor(
        title,
        min = 0,
        max = 100,
        x,
        y,
        width = 100,
        height = 5,
        value = 50,
        callback = null
    ) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.min = min;
        this.max = max;
        this.value = value;
        this.dragging = false;
        this.optionPanelWidth = 0;
        this.containerHeight = 40;
        this.callback = callback;
        this.description = null;
    }

    draw(mouseX, mouseY) {
        const componentHeight = this.containerHeight;
        const backgroundColor = THEME.SLIDER_BACKGROUND;
        const textColor = THEME.SLIDER_TEXT;
        const panelWidth = this.optionPanelWidth - 20;

        drawRoundedRectangleWithBorder({
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 6,
            color: backgroundColor,
            borderWidth: 0.5,
            borderColor: THEME.TOGGLE_BORDER,
        });

        Renderer.drawString(
            this.title,
            this.x,
            this.y + componentHeight / 2 - 4,
            textColor.getRGB(),
            false
        );

        const sliderWidth = 100;
        const rightMargin = 15;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin - 10;
        const sliderY = this.y + componentHeight / 2 - this.height / 2;
        const foregroundColor = THEME.SLIDER_FOREGROUND;
        const handleColor = THEME.SLIDER_HANDLE;

        const progress = (this.value - this.min) / (this.max - this.min);
        const handleWidth = 2;
        const handleHeight = 8;
        const handleX = sliderX + (sliderWidth - handleWidth) * progress;
        const handleY = sliderY + this.height / 2 - handleHeight / 2;

        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            sliderX,
            sliderY,
            sliderX + sliderWidth,
            sliderY + this.height,
            3,
            THEME.SLIDER_BAR_BACKGROUND
        );

        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            sliderX,
            sliderY,
            sliderX + sliderWidth * progress,
            sliderY + this.height,
            3,
            foregroundColor
        );

        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            handleX,
            handleY,
            handleX + handleWidth,
            handleY + handleHeight,
            2,
            handleColor
        );

        const valueString = Math.round(this.value).toString();
        const valueStringWidth = Renderer.getStringWidth(valueString);
        const valueStringX = sliderX - valueStringWidth - 5;
        Renderer.drawString(
            valueString,
            valueStringX,
            this.y + componentHeight / 2 - 4,
            textColor.getRGB(),
            false
        );

        const componentRect = {
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            global.setTooltip(this.description);
        }
    }

    handleClick(mouseX, mouseY) {
        const componentHeight = this.containerHeight;
        const panelWidth = this.optionPanelWidth - 35;
        const sliderWidth = 100;
        const rightMargin = 15;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - this.height / 2;

        if (
            mouseX >= sliderX &&
            mouseX <= sliderX + sliderWidth &&
            mouseY >= sliderY - 2 &&
            mouseY <= sliderY + this.height + 2
        ) {
            this.dragging = true;
            this.updateValue(mouseX);
            playClickSound();
            return true;
        }
        return false;
    }

    handleMouseDrag(mouseX, mouseY) {
        if (this.dragging) {
            this.updateValue(mouseX);
            return true;
        }
        return false;
    }

    handleMouseRelease() {
        this.dragging = false;
    }

    updateValue(mouseX) {
        const panelWidth = this.optionPanelWidth - 35;
        const sliderWidth = 100;
        const rightMargin = 15;

        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;

        const progress = clamp((mouseX - sliderX) / sliderWidth, 0, 1);
        this.value = Math.round(this.min + (this.max - this.min) * progress);
        if (this.callback) {
            this.callback(this.value);
        }
    }

    handleScroll(mouseX, mouseY, dir) {
        const componentHeight = this.containerHeight;
        const panelWidth = this.optionPanelWidth - 35;
        const sliderWidth = 100;
        const rightMargin = 15;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - this.height / 2;

        if (
            mouseX >= sliderX &&
            mouseX <= sliderX + sliderWidth &&
            mouseY >= sliderY &&
            mouseY <= sliderY + this.height
        ) {
            const step = dir > 0 ? 1 : -1;
            this.value = clamp(this.value + step, this.min, this.max);
            return true;
        }
        return false;
    }
}
