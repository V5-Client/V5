import {
    Color,
    UMatrixStack,
    Matrix,
    UIRoundedRectangle,
} from '../Utility/Constants';

import { clamp, playClickSound } from './Utils';

export class Slider {
    constructor(
        title,
        min = 0,
        max = 100,
        x,
        y,
        width = 100,
        height = 5,
        value = 50
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
    }

    draw() {
        const backgroundColor = new Color(0.11, 0.11, 0.11, 1);
        const foregroundColor = new Color(0.6, 0.3, 0.8, 0.8);
        const handleColor = new Color(0.8, 0.8, 0.8, 1);
        const textColor = 0xffffff;

        const progress = (this.value - this.min) / (this.max - this.min);
        const handleWidth = 2;
        const handleHeight = 8;
        const handleX = this.x + (this.width - handleWidth) * progress;
        const handleY = this.y + this.height / 2 - handleHeight / 2;

        // Dark bar (background)
        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            this.x,
            this.y,
            this.x + this.width,
            this.y + this.height,
            2,
            backgroundColor
        );

        // Purple bar (foreground)
        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            this.x,
            this.y,
            this.x + this.width * progress,
            this.y + this.height,
            2,
            foregroundColor
        );

        // Handle
        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            handleX,
            handleY,
            handleX + handleWidth,
            handleY + handleHeight,
            handleWidth / 2,
            handleColor
        );

        const scale = 0.9;
        Renderer.scale(scale, scale);
        Renderer.drawString(
            this.title,
            this.x / scale,
            (this.y - 10) / scale,
            textColor,
            false
        );
        const valueString = Math.round(this.value).toString();
        Renderer.drawString(
            valueString,
            (this.x + this.width - Renderer.getStringWidth(valueString)) /
                scale,
            (this.y - 10) / scale,
            textColor,
            false
        );
        Renderer.scale(1 / scale, 1 / scale);
    }

    handleClick(mouseX, mouseY) {
        if (
            mouseX >= this.x &&
            mouseX <= this.x + this.width &&
            mouseY >= this.y - 2 &&
            mouseY <= this.y + this.height + 2
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
        const progress = clamp((mouseX - this.x) / this.width, 0, 1);
        this.value = Math.round(this.min + (this.max - this.min) * progress);
    }

    handleScroll(mouseX, mouseY, dir) {
        if (
            mouseX >= this.x &&
            mouseX <= this.x + this.width &&
            mouseY >= this.y - 2 &&
            mouseY <= this.y + this.height + 2
        ) {
            const step = dir > 0 ? 1 : -1;
            this.value = clamp(this.value + step, this.min, this.max);
            return true;
        }
        return false;
    }
}
