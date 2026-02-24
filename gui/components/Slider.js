import {
    FontSizes,
    PADDING,
    THEME,
    TypingState,
    clamp,
    createHighlight,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawText,
    getTextWidth,
    isInside,
    playClickSound,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';

export class Slider {
    constructor(title, min = 0, max = 100, x, y, width = 100, height = 5, value = 50, callback = null, isRange = false) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.isRange = isRange;

        this.min = Number.parseFloat(min);
        this.max = Number.parseFloat(max);
        if (Number.isNaN(this.min)) this.min = 0;
        if (Number.isNaN(this.max)) this.max = this.min;
        if (this.max < this.min) {
            const temp = this.min;
            this.min = this.max;
            this.max = temp;
        }

        if (this.isRange) {
            const rawRange = value && typeof value === 'object' ? value : { low: this.min, high: value };
            const parsedLow = Number.parseFloat(rawRange.low);
            const parsedHigh = Number.parseFloat(rawRange.high);
            const safeLow = Number.isNaN(parsedLow) ? this.min : parsedLow;
            const safeHigh = Number.isNaN(parsedHigh) ? this.max : parsedHigh;
            const clampedLow = clamp(safeLow, this.min, this.max);
            const clampedHigh = clamp(safeHigh, this.min, this.max);
            this.value = {
                low: Math.min(clampedLow, clampedHigh),
                high: Math.max(clampedLow, clampedHigh),
            };
        } else {
            const parsedValue = Number.parseFloat(value);
            this.value = Number.isNaN(parsedValue) ? this.min : clamp(parsedValue, this.min, this.max);
        }

        this.step = this.getStepFromPrecision([this.min, this.max, value]);
        this.precision = Math.max(0, String(this.step).indexOf('.') === -1 ? 0 : String(this.step).length - String(this.step).indexOf('.') - 1);

        this.dragging = false;
        this.draggingHandle = null;
        this.isTyping = false;

        this.inputValue = this.isRange
            ? `${this.value.low.toFixed(this.precision)} - ${this.value.high.toFixed(this.precision)}`
            : String(this.value.toFixed(this.precision));

        this.optionPanelWidth = 0;
        this.containerHeight = 48;
        this.callback = callback;
        this.description = null;
        this.valueRect = {};
        this.highlight = createHighlight();

        register('guiKey', (char, keyCode) => {
            if (this.isTyping) this.handleKeyType(char, keyCode);
        });
    }

    getRangeSpan() {
        return this.max - this.min || 1;
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

    draw(mouseX, mouseY) {
        const componentHeight = this.containerHeight;
        const backgroundColor = THEME.BG_COMPONENT;
        const textColor = THEME.TEXT;
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;

        this.drawHighlight(panelWidth, componentHeight);

        drawRoundedRectangleWithBorder({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 10,
            color: backgroundColor,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });

        drawText(this.title, this.x + 12, this.y + componentHeight / 2, FontSizes.REGULAR, textColor);

        const sliderWidth = 140;
        const rightMargin = 12;
        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
        const sliderY = this.y + componentHeight / 2 - 3;
        const sliderHeight = 6;
        const foregroundColor = THEME.ACCENT;
        const handleColor = THEME.KNOB;

        drawRoundedRectangle({
            x: sliderX,
            y: sliderY,
            width: sliderWidth,
            height: sliderHeight,
            radius: sliderHeight / 2,
            color: THEME.BG_INSET,
        });

        const handleSize = 14;

        if (this.isRange) {
            const span = this.getRangeSpan();
            const progressLow = (this.value.low - this.min) / span;
            const progressHigh = (this.value.high - this.min) / span;

            drawRoundedRectangle({
                x: sliderX + sliderWidth * progressLow,
                y: sliderY,
                width: sliderWidth * (progressHigh - progressLow),
                height: sliderHeight,
                radius: sliderHeight / 2,
                color: foregroundColor,
            });

            const handleLowX = sliderX + sliderWidth * progressLow - handleSize / 2;
            const handleLowY = sliderY + sliderHeight / 2 - handleSize / 2;
            drawRoundedRectangle({
                x: handleLowX,
                y: handleLowY,
                width: handleSize,
                height: handleSize,
                radius: handleSize / 2,
                color: handleColor,
            });

            const handleHighX = sliderX + sliderWidth * progressHigh - handleSize / 2;
            const handleHighY = sliderY + sliderHeight / 2 - handleSize / 2;
            drawRoundedRectangle({
                x: handleHighX,
                y: handleHighY,
                width: handleSize,
                height: handleSize,
                radius: handleSize / 2,
                color: handleColor,
            });
        } else {
            const progress = (this.value - this.min) / this.getRangeSpan();

            drawRoundedRectangle({
                x: sliderX,
                y: sliderY,
                width: sliderWidth * progress,
                height: sliderHeight,
                radius: sliderHeight / 2,
                color: foregroundColor,
            });

            const handleX = sliderX + sliderWidth * progress - handleSize / 2;
            const handleY = sliderY + sliderHeight / 2 - handleSize / 2;

            drawRoundedRectangle({
                x: handleX,
                y: handleY,
                width: handleSize,
                height: handleSize,
                radius: handleSize / 2,
                color: handleColor,
            });
        }

        const valueString = this.isRange
            ? `${this.value.low.toFixed(this.precision)} - ${this.value.high.toFixed(this.precision)}`
            : this.value.toFixed(this.precision);
        const displayValue = this.isTyping ? this.inputValue : valueString;
        const valueStringWidth = getTextWidth(displayValue, FontSizes.REGULAR);
        const valuePadding = 8;
        const valueBoxHeight = 20;
        const valueBoxWidth = Math.max(40, valueStringWidth + valuePadding * 2);

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
            color: this.isTyping ? THEME.ACCENT : THEME.BG_INSET,
        });

        const textCenteredX = valueStringX + valueBoxWidth / 2 - valueStringWidth / 2;

        drawText(displayValue, textCenteredX, valueStringY + valueBoxHeight / 2, FontSizes.REGULAR, THEME.TEXT_DIM);

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
            if (!this.isRange) {
                this.isTyping = true;
                TypingState.isTyping = true;
                this.inputValue = String(this.value.toFixed(this.precision));
                return true;
            }
            // no typing for range sliders because laziness
            return true;
        }

        if (this.isTyping) {
            this.handleInputFinish();
            if (!this.checkSliderClick(mouseX, mouseY)) return true;
        }

        if (this.checkSliderClick(mouseX, mouseY)) {
            this.dragging = true;
            if (this.isRange) {
                const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
                const sliderWidth = 140;
                const rightMargin = 12;
                const sliderX = this.x + panelWidth - sliderWidth - rightMargin;
                const progress = clamp((mouseX - sliderX) / sliderWidth, 0, 1);
                const val = this.min + this.getRangeSpan() * progress;

                const distLow = Math.abs(val - this.value.low);
                const distHigh = Math.abs(val - this.value.high);
                this.draggingHandle = distLow < distHigh ? 'low' : 'high';
            }
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
        this.draggingHandle = null;
    }

    handleKeyType(char, keyCode) {
        if (!this.isTyping || this.isRange) return false;

        const DELETE_KEY = 259;
        const ENTER_KEY = 257;
        const ESCAPE_KEY = 256;

        if (keyCode === ENTER_KEY || keyCode === ESCAPE_KEY) {
            this.handleInputFinish();
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

            const tentativeValue = Number.parseFloat(nextInputValue);
            if (!Number.isNaN(tentativeValue)) {
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

    handleInputFinish() {
        if (!this.isTyping) return;

        let typedValue = Number.parseFloat(this.inputValue);

        if (Number.isNaN(typedValue)) {
            this.isTyping = false;
            TypingState.isTyping = false;
            return;
        }

        let finalValue = clamp(typedValue, this.min, this.max);
        this.value = Number.parseFloat(finalValue.toFixed(this.precision));

        if (this.callback) {
            this.callback(this.value);
        }

        this.isTyping = false;
        TypingState.isTyping = false;
        playClickSound();
    }

    updateValue(mouseX) {
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const sliderWidth = 140;
        const rightMargin = 12;

        const sliderX = this.x + panelWidth - sliderWidth - rightMargin;

        const progress = clamp((mouseX - sliderX) / sliderWidth, 0, 1);

        let rawValue = this.min + this.getRangeSpan() * progress;
        let steppedValue = Math.round(rawValue / this.step) * this.step;
        let finalValue = Number.parseFloat(clamp(steppedValue, this.min, this.max).toFixed(this.precision));

        if (this.isRange) {
            if (this.draggingHandle === 'low') {
                this.value.low = Math.min(finalValue, this.value.high);
            } else if (this.draggingHandle === 'high') {
                this.value.high = Math.max(finalValue, this.value.low);
            }
        } else {
            this.value = finalValue;
        }

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

            if (this.isRange) {
                const progress = clamp((mouseX - sliderX) / sliderWidth, 0, 1);
                const val = this.min + this.getRangeSpan() * progress;
                const distLow = Math.abs(val - this.value.low);
                const distHigh = Math.abs(val - this.value.high);

                if (distLow < distHigh) {
                    this.value.low = clamp(Number.parseFloat((this.value.low + step).toFixed(this.precision)), this.min, this.value.high);
                } else {
                    this.value.high = clamp(Number.parseFloat((this.value.high + step).toFixed(this.precision)), this.value.low, this.max);
                }
            } else {
                let newValue = this.value + step;
                newValue = Number.parseFloat(newValue.toFixed(this.precision));
                this.value = clamp(newValue, this.min, this.max);
            }

            if (this.callback) {
                this.callback(this.value);
            }
            return true;
        }
        return false;
    }

    getStepFromPrecision(values) {
        const collectNumbers = (input, out) => {
            if (Array.isArray(input)) {
                input.forEach((entry) => collectNumbers(entry, out));
                return;
            }
            if (input && typeof input === 'object') {
                if (Object.prototype.hasOwnProperty.call(input, 'low')) collectNumbers(input.low, out);
                if (Object.prototype.hasOwnProperty.call(input, 'high')) collectNumbers(input.high, out);
                return;
            }
            const parsed = Number.parseFloat(input);
            if (!Number.isNaN(parsed)) out.push(parsed);
        };

        const numbers = [];
        collectNumbers(values, numbers);
        if (numbers.length === 0) return 1;

        let maxPrecision = 0;
        numbers.forEach((num) => {
            const fixed = num.toString();
            if (fixed.includes('e') || fixed.includes('E')) {
                const normalized = num.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
                const decimalIndex = normalized.indexOf('.');
                if (decimalIndex !== -1) maxPrecision = Math.max(maxPrecision, normalized.length - decimalIndex - 1);
                return;
            }
            const decimalIndex = fixed.indexOf('.');
            if (decimalIndex !== -1) {
                maxPrecision = Math.max(maxPrecision, fixed.length - decimalIndex - 1);
            }
        });

        if (maxPrecision <= 0) return 1;
        return Math.pow(10, -maxPrecision);
    }
}
