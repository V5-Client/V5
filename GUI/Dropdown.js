import {
    playClickSound,
    THEME,
    drawRoundedRectangleWithBorder,
    PADDING,
    isInside,
} from './Utils';
import {
    Color,
    UMatrixStack,
    Matrix,
    UIRoundedRectangle,
} from '../Utility/Constants';

export class MultiToggle {
    constructor(
        title,
        x,
        y,
        options = [],
        singleSelect = false,
        callback = null
    ) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.options = options.map((option) => ({
            name: option,
            enabled: false,
        }));
        this.expanded = false;
        this.optionHeight = 25;
        this.containerHeight = 40;
        this.singleSelect = singleSelect;
        this.callback = callback;
        this.optionPanelWidth = 0;

        this.animStart = 0;
        this.animFrom = 0;
        this.animTo = 0;
        this.animDuration = 200;
        this.animationProgress = 0;
        this.description = null;
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
        if (t >= 1) this.animStart = 0;
    }

    getExpandedHeight() {
        return this.options.length * (this.optionHeight + 2) + 5;
    }

    draw(mouseX, mouseY) {
        this.updateAnimation();

        const panelWidth = this.optionPanelWidth - 2 * PADDING;
        const textColor = THEME.TOGGLE_TEXT;
        const cornerRadius = 6;

        // Main container
        drawRoundedRectangleWithBorder({
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: this.containerHeight,
            radius: cornerRadius,
            color: THEME.TOGGLE_BACKGROUND,
            borderWidth: 0.5,
            borderColor: THEME.TOGGLE_BORDER,
        });

        Renderer.drawString(
            this.title,
            this.x,
            this.y + this.containerHeight / 2 - 4,
            textColor.getRGB(),
            false
        );

        const boxSize = 15;
        const rightMargin = 15;
        const boxX = this.x + panelWidth - boxSize - rightMargin - 10;

        const arrow = this.expanded ? '▲' : '▼';
        const arrowWidth = Renderer.getStringWidth(arrow);
        Renderer.drawString(
            arrow,
            boxX + (boxSize - arrowWidth) / 2,
            this.y + this.containerHeight / 2 - 4,
            textColor.getRGB(),
            false
        );

        const componentRect = {
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: this.containerHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            global.setTooltip(this.description);
        }

        if (this.animationProgress > 0) {
            const fullDropdownHeight = this.getExpandedHeight();
            const animatedHeight = fullDropdownHeight * this.animationProgress;
            const dropdownX = this.x - 10;
            const dropdownY = this.y + this.containerHeight + 1;

            UIRoundedRectangle.Companion.drawRoundedRectangle(
                Matrix,
                dropdownX,
                dropdownY,
                dropdownX + panelWidth,
                dropdownY + animatedHeight,
                cornerRadius,
                THEME.TOGGLE_BACKGROUND
            );

            let currentY = dropdownY + 5;
            for (let i = 0; i < this.options.length; i++) {
                const optionTop = currentY;
                if (optionTop >= dropdownY + animatedHeight) break;
                const option = this.options[i];
                const optionX = this.x - 5;

                const innerBoxSize = 15;
                const innerRightMargin = 15;
                const toggleXPos =
                    this.x + panelWidth - innerBoxSize - innerRightMargin - 10;
                const toggleYPos =
                    optionTop + (this.optionHeight - innerBoxSize) / 2;
                const toggleColor = option.enabled
                    ? THEME.TOGGLE_ACCENT
                    : THEME.DROPDOWN_TOGGLE_DISABLED;

                UIRoundedRectangle.Companion.drawRoundedRectangle(
                    Matrix,
                    toggleXPos,
                    toggleYPos,
                    toggleXPos + innerBoxSize,
                    toggleYPos + innerBoxSize,
                    4,
                    toggleColor
                );

                Renderer.drawString(
                    option.name,
                    optionX + 5,
                    optionTop + this.optionHeight / 2 - 4,
                    textColor.getRGB(),
                    false
                );

                currentY += this.optionHeight + 2;
            }
        }
    }

    handleClick(mouseX, mouseY) {
        const panelWidth = this.optionPanelWidth - 2 * PADDING;

        if (
            mouseX >= this.x - 10 &&
            mouseX <= this.x - 10 + panelWidth &&
            mouseY >= this.y &&
            mouseY <= this.y + this.containerHeight
        ) {
            this.expanded = !this.expanded;
            this.startAnimation(this.expanded);
            playClickSound();
            return true;
        }

        if (this.expanded) {
            const dropdownY = this.y + this.containerHeight + 1;
            const fullDropdownHeight = this.getExpandedHeight();

            if (
                mouseX >= this.x - 10 &&
                mouseX <= this.x - 10 + panelWidth &&
                mouseY >= dropdownY &&
                mouseY <= dropdownY + fullDropdownHeight
            ) {
                let currentY = dropdownY + 5;
                for (let i = 0; i < this.options.length; i++) {
                    const optionTop = currentY;
                    const optionBottom = optionTop + this.optionHeight;
                    if (mouseY >= optionTop && mouseY <= optionBottom) {
                        if (this.singleSelect) {
                            const isEnabled = this.options[i].enabled;
                            this.options.forEach((opt, index) => {
                                opt.enabled = !isEnabled && index === i;
                            });
                        } else {
                            this.options[i].enabled = !this.options[i].enabled;
                        }
                        playClickSound();
                        if (this.callback) {
                            const selectedOptions = this.options
                                .filter((option) => option.enabled)
                                .map((option) => option.name);
                            this.callback(selectedOptions);
                        }
                        return true;
                    }
                    currentY += this.optionHeight + 2;
                }
            }
        }
        return false;
    }
}
