import {
    FontSizes,
    PADDING,
    THEME,
    TypingState,
    clamp,
    createHighlight,
    drawRoundedRectangle,
    drawText,
    getTypedCharacter,
    getTextWidth,
    isInside,
    playClickSound,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';
import { GuiState } from '../core/GuiState';

const allSliders = [];

const wrapTitle = (title, maxWidth) =>
    title.split(' ').reduce(
        (lines, word) => {
            const line = lines[lines.length - 1];
            if (line && getTextWidth(`${line} ${word}`, FontSizes.REGULAR) > maxWidth) lines.push(word);
            else lines[lines.length - 1] = line ? `${line} ${word}` : word;
            return lines;
        },
        ['']
    );

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
        this.typingHandle = null;

        this.inputValue = String((this.isRange ? this.value.low : this.value).toFixed(this.precision));

        this.optionPanelWidth = 0;
        this.containerHeight = 26;
        this.callback = callback;
        this.description = null;
        this.valueRects = {};
        this.sliderRect = {};
        this.highlight = createHighlight();
        allSliders.push(this);

        register('guiKey', (char, keyCode) => {
            if (!GuiState.myGui.isOpen()) return;
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
        const textColor = THEME.TEXT;
        const panelWidth = this.optionPanelWidth - PADDING * 2;
        const sliderWidth = 105;
        const valueKeys = this.isRange ? ['low', 'high'] : ['value'];
        const displayValues = valueKeys.map((key) =>
            this.isTyping && this.typingHandle === key ? this.inputValue : (this.isRange ? this.value[key] : this.value).toFixed(this.precision)
        );
        const valuePadding = 8;
        const valueBoxHeight = 18;
        const valueBoxGap = 4;
        const valueBoxWidths = displayValues.map((displayValue) => Math.max(40, getTextWidth(displayValue, FontSizes.REGULAR) + valuePadding * 2));
        const valueBoxesWidth = valueBoxWidths.reduce((total, width) => total + width, 0) + valueBoxGap * (valueKeys.length - 1);
        const valueStringX = this.x + panelWidth - valueBoxesWidth;
        const sliderX = valueStringX - sliderWidth - 14;
        const titleLines = wrapTitle(this.title, sliderX - this.x - 12);
        const componentHeight = Math.max(this.containerHeight, titleLines.length * 12 + 12);
        this.layoutHeight = componentHeight;

        this.drawHighlight(panelWidth, componentHeight);
        titleLines.forEach((line, index) =>
            drawText(line, this.x, this.y + componentHeight / 2 - ((titleLines.length - 1) * 12) / 2 + index * 12, FontSizes.REGULAR, textColor)
        );

        const valueStringY = this.y + componentHeight / 2 - valueBoxHeight / 2;
        const sliderY = this.y + componentHeight / 2 - 3;
        const sliderHeight = 6;
        this.sliderRect = { x: sliderX, y: sliderY, width: sliderWidth, height: sliderHeight };
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

        const handleSize = 8;

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

        this.valueRects = {};
        let currentValueX = valueStringX;
        valueKeys.forEach((key, index) => {
            const displayValue = displayValues[index];
            const valueBoxWidth = valueBoxWidths[index];
            const isActive = this.isTyping && this.typingHandle === key;

            this.valueRects[key] = {
                x: currentValueX,
                y: valueStringY,
                width: valueBoxWidth,
                height: valueBoxHeight,
            };

            drawRoundedRectangle({
                x: currentValueX,
                y: valueStringY,
                width: valueBoxWidth,
                height: valueBoxHeight,
                radius: 6,
                color: isActive ? THEME.ACCENT : THEME.BG_INSET,
            });

            drawText(displayValue, currentValueX + valueBoxWidth / 2, valueStringY + valueBoxHeight / 2, FontSizes.REGULAR, THEME.TEXT_DIM, 18);

            currentValueX += valueBoxWidth + valueBoxGap;
        });

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
        const inputHandle = this.isRange
            ? isInside(mouseX, mouseY, this.valueRects.low)
                ? 'low'
                : isInside(mouseX, mouseY, this.valueRects.high)
                  ? 'high'
                  : null
            : isInside(mouseX, mouseY, this.valueRects.value)
              ? 'value'
              : null;

        if (inputHandle) {
            if (!this.isTyping || this.typingHandle !== inputHandle) {
                if (this.isTyping) this.handleInputFinish();
                this.isTyping = true;
                this.typingHandle = inputHandle;
                TypingState.isTyping = true;
                this.inputValue = String((this.isRange ? this.value[inputHandle] : this.value).toFixed(this.precision));
            }
            return true;
        }

        if (this.isTyping) {
            this.handleInputFinish();
            if (!this.checkSliderClick(mouseX, mouseY)) return true;
        }

        if (this.checkSliderClick(mouseX, mouseY)) {
            this.dragging = true;
            if (this.isRange) {
                const progress = clamp((mouseX - this.sliderRect.x) / this.sliderRect.width, 0, 1);
                const val = this.min + this.getRangeSpan() * progress;

                const distLow = Math.abs(val - this.value.low);
                const distHigh = Math.abs(val - this.value.high);
                this.draggingHandle = this.value.low === this.value.high ? null : distLow < distHigh ? 'low' : 'high';
            }
            this.updateValue(mouseX);
            playClickSound();
            return true;
        }

        return false;
    }

    checkSliderClick(mouseX, mouseY) {
        const { x, y, width, height } = this.sliderRect;
        return mouseX >= x && mouseX <= x + width && mouseY >= y - 5 && mouseY <= y + height + 5;
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
        if (!this.isTyping) return false;

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

        const typedChar = char ? getTypedCharacter(char) : char;
        if (/[0-9.\-]/.test(typedChar)) {
            let nextInputValue = this.inputValue + typedChar;

            if (typedChar === '.' && this.inputValue.includes('.')) return true;
            if (typedChar === '-' && this.inputValue.length > 0) return true;

            if (this.precision > 0 && typedChar !== '.') {
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

    handleInputFinish({ playSound = true } = {}) {
        if (!this.isTyping) return;

        let typedValue = Number.parseFloat(this.inputValue);

        if (Number.isNaN(typedValue)) {
            this.isTyping = false;
            this.typingHandle = null;
            TypingState.isTyping = false;
            return;
        }

        const min = this.isRange && this.typingHandle === 'high' ? this.value.low : this.min;
        const max = this.isRange && this.typingHandle === 'low' ? this.value.high : this.max;
        const finalValue = Number.parseFloat(clamp(typedValue, min, max).toFixed(this.precision));

        if (this.isRange) {
            this.value[this.typingHandle] = finalValue;
        } else {
            this.value = finalValue;
        }

        if (this.callback) {
            this.callback(this.value);
        }

        this.isTyping = false;
        this.typingHandle = null;
        TypingState.isTyping = false;
        if (playSound) playClickSound();
    }

    updateValue(mouseX) {
        const progress = clamp((mouseX - this.sliderRect.x) / this.sliderRect.width, 0, 1);

        const rawValue = this.min + this.getRangeSpan() * progress;
        const steppedValue = Math.round(rawValue / this.step) * this.step;
        const finalValue = Number.parseFloat(clamp(steppedValue, this.min, this.max).toFixed(this.precision));

        if (this.isRange) {
            if (this.draggingHandle === null) {
                if (finalValue < this.value.low) this.draggingHandle = 'low';
                if (finalValue > this.value.high) this.draggingHandle = 'high';
            }

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
        const { x, y, width, height } = this.sliderRect;

        if (mouseX >= x && mouseX <= x + width && mouseY >= y - 5 && mouseY <= y + height + 5) {
            const step = dir > 0 ? this.step : -this.step;

            if (this.isRange) {
                const progress = clamp((mouseX - x) / width, 0, 1);
                const val = this.min + this.getRangeSpan() * progress;
                const distLow = Math.abs(val - this.value.low);
                const distHigh = Math.abs(val - this.value.high);

                if (distLow < distHigh || (distLow === distHigh && step < 0)) {
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

    static finalizeAllTyping(options = undefined) {
        allSliders.forEach((slider) => {
            if (slider.isTyping) {
                slider.handleInputFinish(options);
            }
        });
    }

    static handleGlobalClick(mouseX, mouseY) {
        const activeSlider = allSliders.find((slider) => slider.isTyping);
        if (!activeSlider) return false;

        const inputRect = activeSlider.valueRects[activeSlider.typingHandle];
        if (inputRect && isInside(mouseX, mouseY, inputRect)) return false;

        Slider.finalizeAllTyping({ playSound: false });
        return true;
    }
}
