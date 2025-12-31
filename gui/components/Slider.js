import {
    clamp,
    playClickSound,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    THEME,
    isInside,
    PADDING,
    drawText,
    getTextWidth,
    FontSizes,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';

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
        this.containerHeight = 48;
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
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;

        drawRoundedRectangleWithBorder({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 10,
            color: backgroundColor,
            borderWidth: 1,
            borderColor: THEME.TOGGLE_BORDER,
        });

        drawText(this.title, this.x + 12, this.y + componentHeight / 2, FontSizes.REGULAR, textColor);

        const sliderWidth = 140;
        const rightMargin = 12;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - 3;
        const sliderHeight = 6;
        const foregroundColor = THEME.SLIDER_FOREGROUND;
        const handleColor = THEME.SLIDER_HANDLE;

        const progress = (this.value - this.min) / (this.max - this.min);

        drawRoundedRectangle({
            x: sliderX,
            y: sliderY,
            width: sliderWidth,
            height: sliderHeight,
            radius: sliderHeight / 2,
            color: THEME.SLIDER_BAR_BACKGROUND,
        });

        drawRoundedRectangle({
            x: sliderX,
            y: sliderY,
            width: sliderWidth * progress,
            height: sliderHeight,
            radius: sliderHeight / 2,
            color: foregroundColor,
        });

        const handleSize = 14;
        const handleX = sliderX + (sliderWidth - handleSize / 2) * progress - handleSize / 2;
        const handleY = sliderY + sliderHeight / 2 - handleSize / 2;

        drawRoundedRectangle({
            x: handleX,
            y: handleY,
            width: handleSize,
            height: handleSize,
            radius: handleSize / 2,
            color: handleColor,
        });

        const valueString = this.value.toFixed(this.precision);
        const displayValue = this.isTyping ? this.inputValue : valueString;
        const valueStringWidth = getTextWidth(displayValue, FontSizes.REGULAR);
        const valuePadding = 8;
        const valueBoxHeight = 20;
        const valueBoxWidth = valueStringWidth + valuePadding * 2;

        const valueStringX = sliderX - valueBoxWidth - 8;
        const valueStringY = this.y + componentHeight / 2 - valueBoxHeight / 2;

        this.valueRect = {
            x: valueStringX,
            y: valueStringY,
            width: valueBoxWidth,
            height: valueBoxHeight,
        };

        drawRoundedRectangle({
            x: valueStringX,
            y: valueStringY,
            width: valueBoxWidth,
            height: valueBoxHeight,
            radius: 6,
            color: this.isTyping ? THEME.SLIDER_FOREGROUND : THEME.SLIDER_VALUE_BG,
        });

        const textCenteredX = valueStringX + valueBoxWidth / 2 - valueStringWidth / 2;

        drawText(displayValue, textCenteredX, valueStringY + valueBoxHeight / 2, FontSizes.REGULAR, THEME.SLIDER_VALUE_TEXT);

        const componentRect = {
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            setTooltip(this.description);
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
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const sliderWidth = 140;
        const rightMargin = 12;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - 8;

        return mouseX >= sliderX && mouseX <= sliderX + sliderWidth && mouseY >= sliderY && mouseY <= sliderY + 16;
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
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const sliderWidth = 140;
        const rightMargin = 12;

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
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const sliderWidth = 140;
        const rightMargin = 12;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - 8;

        if (mouseX >= sliderX && mouseX <= sliderX + sliderWidth && mouseY >= sliderY && mouseY <= sliderY + 16) {
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
