import { playClickSound, THEME } from './Utils';
import {
    Color,
    UMatrixStack,
    Matrix,
    UIRoundedRectangle,
} from '../Utility/Constants';

export class MultiToggle {
    constructor(title, x, y, options = [], singleSelect = false) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.options = options.map((option) => ({
            name: option,
            enabled: false,
        }));
        this.expanded = false;
        this.buttonHeight = 15;
        this.buttonWidth = 100;
        this.singleSelect = singleSelect;

        this.animStart = 0;
        this.animFrom = 0;
        this.animTo = 0;
        this.animDuration = 200; // ms
        this.animationProgress = 0;
    }

    startAnimation(expanding) {
        this.animStart = Date.now();
        this.animFrom = this.animationProgress;
        this.animTo = expanding ? 1 : 0;
    }

    updateAnimation() {
        if (this.animStart === 0) return;

        const elapsed = Date.now() - this.animStart;
        const t = Math.min(elapsed / this.animDuration, 1);

        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        this.animationProgress =
            this.animFrom + (this.animTo - this.animFrom) * eased;

        if (t >= 1) {
            this.animStart = 0;
        }
    }

    draw() {
        this.updateAnimation();

        const backgroundColor = THEME.DROPDOWN_BACKGROUND;
        const foregroundColor = THEME.DROPDOWN_FOREGROUND;
        const textColor = THEME.DROPDOWN_TEXT;
        const cornerRadius = 3;

        // Main button
        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            this.x,
            this.y,
            this.x + this.buttonWidth,
            this.y + this.buttonHeight,
            cornerRadius,
            backgroundColor
        );
        Renderer.drawString(
            this.title,
            this.x + 5,
            this.y + this.buttonHeight / 2 - 4,
            textColor,
            false
        );

        const arrow = this.expanded ? '▲' : '▼';
        const arrowWidth = Renderer.getStringWidth(arrow);
        Renderer.drawString(
            arrow,
            this.x + this.buttonWidth - arrowWidth - 5,
            this.y + this.buttonHeight / 2 - 4,
            textColor,
            false
        );

        if (this.animationProgress > 0) {
            const fullDropdownHeight =
                this.options.length * (this.buttonHeight + 2);
            const animatedHeight = fullDropdownHeight * this.animationProgress;

            // Background
            UIRoundedRectangle.Companion.drawRoundedRectangle(
                Matrix,
                this.x,
                this.y + this.buttonHeight + 1,
                this.x + this.buttonWidth,
                this.y + this.buttonHeight + 1 + animatedHeight,
                cornerRadius,
                backgroundColor
            );

            let currentY = this.y + this.buttonHeight + 2;
            for (let i = 0; i < this.options.length; i++) {
                const optionTop = currentY;
                const optionBottom = optionTop + this.buttonHeight;

                if (
                    optionTop - (this.y + this.buttonHeight + 1) >=
                    animatedHeight
                )
                    break;

                const option = this.options[i];
                const toggleX = this.x + 2;
                const toggleWidth = this.buttonWidth - 4;
                const toggleHeight = this.buttonHeight;

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    Matrix,
                    toggleX,
                    optionTop,
                    toggleX + toggleWidth,
                    optionTop + toggleHeight,
                    cornerRadius,
                    THEME.DROPDOWN_OPTION_BACKGROUND
                );

                const toggleColor = option.enabled
                    ? foregroundColor
                    : THEME.DROPDOWN_TOGGLE_DISABLED;
                const toggleSize = toggleHeight - 6;
                const toggleXPos = toggleX + toggleWidth - toggleSize - 3;
                const toggleYPos = optionTop + (toggleHeight - toggleSize) / 2;

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    Matrix,
                    toggleXPos,
                    toggleYPos,
                    toggleXPos + toggleSize,
                    toggleYPos + toggleSize,
                    cornerRadius,
                    toggleColor
                );

                Renderer.drawString(
                    option.name,
                    toggleX + 3,
                    optionTop + toggleHeight / 2 - 4,
                    textColor,
                    false
                );

                currentY += this.buttonHeight + 2;
            }
        }
    }

    handleClick(mouseX, mouseY) {
        if (
            mouseX >= this.x &&
            mouseX <= this.x + this.buttonWidth &&
            mouseY >= this.y &&
            mouseY <= this.y + this.buttonHeight
        ) {
            this.expanded = !this.expanded;
            this.startAnimation(this.expanded);
            playClickSound();
            return true;
        }

        if (this.expanded) {
            const startY = this.y + this.buttonHeight + 2;
            for (let i = 0; i < this.options.length; i++) {
                const optionY = startY + i * (this.buttonHeight + 2);
                if (
                    mouseX >= this.x &&
                    mouseX <= this.x + this.buttonWidth &&
                    mouseY >= optionY &&
                    mouseY <= optionY + this.buttonHeight
                ) {
                    if (this.singleSelect) {
                        if (this.options[i].enabled) {
                            this.options[i].enabled = false;
                        } else {
                            this.options.forEach((opt, index) => {
                                opt.enabled = index === i;
                            });
                        }
                    } else {
                        this.options[i].enabled = !this.options[i].enabled;
                    }
                    playClickSound();
                    return true;
                }
            }
        }
        return false;
    }
}
