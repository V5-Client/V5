const Color = java.awt.Color;
const UMatrixStack = Java.type('gg.essential.universal.UMatrixStack').Compat
    .INSTANCE;
const matrix = UMatrixStack.get();
const UIRoundedRectangle = Java.type(
    'gg.essential.elementa.components.UIRoundedRectangle'
);
import { playClickSound } from './Utils';

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
    }

    draw() {
        const backgroundColor = new Color(0.15, 0.15, 0.15, 1);
        const foregroundColor = new Color(0.6, 0.3, 0.8, 0.8);
        const textColor = 0xffffff;
        const cornerRadius = 3;

        UIRoundedRectangle.Companion.drawRoundedRectangle(
            matrix,
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

        if (this.expanded) {
            const dropdownHeight =
                this.options.length * (this.buttonHeight + 2);
            UIRoundedRectangle.Companion.drawRoundedRectangle(
                matrix,
                this.x,
                this.y + this.buttonHeight + 1,
                this.x + this.buttonWidth,
                this.y + this.buttonHeight + 1 + dropdownHeight,
                cornerRadius,
                backgroundColor
            );

            let currentY = this.y + this.buttonHeight + 2;
            this.options.forEach((option) => {
                const toggleX = this.x + 5;
                const toggleWidth = this.buttonWidth - 10;
                const toggleHeight = this.buttonHeight;

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    matrix,
                    toggleX,
                    currentY,
                    toggleX + toggleWidth,
                    currentY + toggleHeight,
                    cornerRadius,
                    new Color(0.2, 0.2, 0.2, 1)
                );

                const toggleColor = option.enabled
                    ? foregroundColor
                    : new Color(0.4, 0.4, 0.4, 1);
                const toggleSize = toggleHeight - 6;
                const toggleXPos = toggleX + toggleWidth - toggleSize - 3;
                const toggleYPos = currentY + (toggleHeight - toggleSize) / 2;

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    matrix,
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
                    currentY + toggleHeight / 2 - 4,
                    textColor,
                    false
                );

                currentY += toggleHeight + 2;
            });
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
