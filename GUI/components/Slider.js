import { Matrix, UIRoundedRectangle } from '../../Utility/Constants';
import { clamp, playClickSound, drawRoundedRectangleWithBorder, THEME, isInside, drawRoundedRectangle } from '../Utils';

export class Slider {
    constructor(title, min = 0, max = 100, x, y, width = 100, height = 5, value = 50, callback = null) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.min = parseFloat(min);
        this.max = parseFloat(max);
        this.value = parseFloat(value);
        this.step = this.getStepFromPrecision(String(min));
        this.precision = Math.max(0, String(this.step).indexOf('.') === -1 ? 0 : String(this.step).length - String(this.step).indexOf('.') - 1);

        this.dragging = false;
        this.isTyping = false;
        this.inputValue = String(this.value.toFixed(this.precision));

        this.optionPanelWidth = 0;
        this.containerHeight = 40;
        this.callback = callback;
        this.description = null;
        this.valueRect = {};

        register('guiKey', (char, keyCode) => {
            if (this.isTyping) this.handleKeyType(char, keyCode);
        });
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

        Renderer.drawString(this.title, this.x, this.y + componentHeight / 2 - 4, textColor.getRGB(), false);

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

        UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, handleX, handleY, handleX + handleWidth, handleY + handleHeight, 2, handleColor);

        const valueString = this.value.toFixed(this.precision);
        const displayValue = this.isTyping ? this.inputValue : valueString;

        const valueStringWidth = Renderer.getStringWidth(displayValue);
        const valueStringX = sliderX - valueStringWidth - 5;
        const valueStringY = this.y + componentHeight / 2 - 4;

        this.valueRect = {
            x: valueStringX,
            y: valueStringY - 4,
            width: valueStringWidth + 2,
            height: 12,
        };

        if (this.isTyping) {
            drawRoundedRectangle({
                x: this.valueRect.x - 2,
                y: this.valueRect.y,
                width: this.valueRect.width + 2,
                height: this.valueRect.height,
                radius: 3,
                color: THEME.SLIDER_BAR_BACKGROUND,
            });
        }

        Renderer.drawString(displayValue, valueStringX, valueStringY, textColor.getRGB(), false);

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
        if (isInside(mouseX, mouseY, this.valueRect)) {
            this.isTyping = true;
            this.inputValue = String(this.value.toFixed(this.precision));
            return true;
        }

        if (this.isTyping) {
            this.handleInputFinish();
            if (!this.checkSliderClick(mouseX, mouseY)) return true;
        }

        if (this.checkSliderClick(mouseX, mouseY)) {
            this.dragging = true;
            this.updateValue(mouseX);
            playClickSound();
            return true;
        }

        return false;
    }

    checkSliderClick(mouseX, mouseY) {
        const componentHeight = this.containerHeight;
        const panelWidth = this.optionPanelWidth - 35;
        const sliderWidth = 100;
        const rightMargin = 15;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - this.height / 2;

        return mouseX >= sliderX && mouseX <= sliderX + sliderWidth && mouseY >= sliderY - 2 && mouseY <= sliderY + this.height + 2;
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

    handleKeyType(char, keyCode) {
        if (!this.isTyping) return false;

        const DELETE_KEY = 259;
        const ENTER_KEY = 257;

        if (keyCode === ENTER_KEY) {
            this.handleInputFinish(true);
            return true;
        }

        if (keyCode === DELETE_KEY) {
            this.inputValue = this.inputValue.slice(0, -1);
            return true;
        }

        if (/[0-9.\-]/.test(char)) {
            let nextInputValue = this.inputValue + char;

            if (char === '.' && this.inputValue.includes('.')) return true;
            if (char === '-' && this.inputValue.length > 0) return true;

            if (this.precision > 0 && char !== '.') {
                const parts = nextInputValue.split('.');
                if (parts.length === 2 && parts[1].length > this.precision) return true;
            }

            const tentativeValue = parseFloat(nextInputValue);
            if (!isNaN(tentativeValue)) {
                if (tentativeValue > this.max) return true;

                if (tentativeValue < this.min) {
                    if (this.min >= 0 && tentativeValue < 0) return true;
                }
            }

            this.inputValue = nextInputValue;
            return true;
        }

        return true;
    }

    handleInputFinish(forceSave = false) {
        if (!this.isTyping) return;

        let typedValue = parseFloat(this.inputValue);

        if (isNaN(typedValue) || !forceSave) {
            this.isTyping = false;
            return;
        }

        let finalValue = clamp(typedValue, this.min, this.max);
        this.value = parseFloat(finalValue.toFixed(this.precision));

        if (this.callback) {
            this.callback(this.value);
        }

        this.isTyping = false;
        playClickSound();
    }

    updateValue(mouseX) {
        const panelWidth = this.optionPanelWidth - 35;
        const sliderWidth = 100;
        const rightMargin = 15;

        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;

        const progress = clamp((mouseX - sliderX) / sliderWidth, 0, 1);

        let rawValue = this.min + (this.max - this.min) * progress;

        let steppedValue = Math.round(rawValue / this.step) * this.step;

        let finalValue = clamp(steppedValue, this.min, this.max);
        this.value = parseFloat(finalValue.toFixed(this.precision));

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

        if (mouseX >= sliderX && mouseX <= sliderX + sliderWidth && mouseY >= sliderY && mouseY <= sliderY + this.height) {
            const step = dir > 0 ? this.step : -this.step;

            let newValue = this.value + step;
            newValue = parseFloat(newValue.toFixed(this.precision));

            this.value = clamp(newValue, this.min, this.max);

            if (this.callback) {
                this.callback(this.value);
            }
            return true;
        }
        return false;
    }

    getStepFromPrecision(numStr) {
        if (typeof numStr !== 'string') {
            numStr = String(numStr);
        }
        const decimalIndex = numStr.indexOf('.');

        if (decimalIndex === -1) return 1;

        const precision = numStr.length - 1 - decimalIndex;

        return Math.pow(10, -precision);
    }
}
