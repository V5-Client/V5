import {
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    THEME,
    isInside,
    PADDING,
    drawText,
    getTextWidth,
    FontSizes,
    drawRect,
    playClickSound,
    TypingState,
    createHighlight,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';
import { Toolkit, DataFlavor } from '../../utils/Constants';

export class TextInput {
    constructor(title, x, y, width, height, defaultValue = '', callback = null) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.value = defaultValue;
        this.callback = callback;

        this.isTyping = false;
        this.text = String(defaultValue);
        this.cursorIndex = this.text.length;
        this.textX = 0;
        this.textWidth = 0;

        this.optionPanelWidth = 0;
        this.containerHeight = 48;
        this.description = null;
        this.highlight = createHighlight();

        this.inputRect = {};

        register('guiKey', (char, keyCode) => {
            if (this.isTyping) this.handleKeyType(char, keyCode);
        });
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

        const displayText = this.text;
        const textWidth = getTextWidth(displayText, FontSizes.REGULAR);
        const valuePadding = 8;
        const boxHeight = 20;

        const minBoxWidth = 100;
        const boxWidth = Math.max(minBoxWidth, textWidth + valuePadding * 2 + 10);

        const rightMargin = 12;
        const boxX = this.x + panelWidth - boxWidth - rightMargin;
        const boxY = this.y + componentHeight / 2 - boxHeight / 2;

        this.inputRect = {
            x: boxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
        };

        drawRoundedRectangle({
            x: boxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            radius: 6,
            color: this.isTyping ? THEME.ACCENT : THEME.BG_INSET,
        });

        const textX = boxX + boxWidth / 2 - textWidth / 2;
        const textY = boxY + boxHeight / 2;

        this.textX = textX;
        this.textWidth = textWidth;

        drawText(displayText, textX, textY, FontSizes.REGULAR, THEME.TEXT_DIM);

        if (this.isTyping) {
            const time = Date.now();
            if (time % 1000 < 500) {
                const safeCursorIndex = Math.max(0, Math.min(this.cursorIndex, displayText.length));
                const cursorOffset = getTextWidth(displayText.slice(0, safeCursorIndex), FontSizes.REGULAR);
                const cursorX = textX + cursorOffset + 1;
                const cursorY = textY - 4;
                const cursorHeight = 9;

                drawRect({
                    x: cursorX,
                    y: cursorY,
                    width: 1,
                    height: cursorHeight,
                    color: THEME.TEXT_DIM,
                });
            }
        }

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

    getCursorIndexFromMouseX(mouseX) {
        if (!this.text || this.text.length === 0) return 0;

        const relativeX = Math.max(0, mouseX - this.textX);
        let prevWidth = 0;

        for (let i = 0; i < this.text.length; i++) {
            const nextWidth = getTextWidth(this.text.slice(0, i + 1), FontSizes.REGULAR);
            const charWidth = nextWidth - prevWidth;
            if (relativeX <= prevWidth + charWidth / 2) {
                return i;
            }
            prevWidth = nextWidth;
        }

        return this.text.length;
    }

    handleClick(mouseX, mouseY) {
        if (isInside(mouseX, mouseY, this.inputRect)) {
            if (!this.isTyping) {
                this.isTyping = true;
                TypingState.isTyping = true;
                playClickSound();
            }
            this.cursorIndex = this.getCursorIndexFromMouseX(mouseX);
            return true;
        }

        if (this.isTyping) {
            this.handleInputFinish();
            return true;
        }

        return false;
    }

    handleKeyType(char, keyCode) {
        if (!this.isTyping) return false;

        const BACKSPACE = 259;
        const ENTER = 257;
        const ESCAPE = 256;
        const SPACE = 32;
        const LEFT_ARROW = 263;
        const RIGHT_ARROW = 262;
        const KEY_V = 86;

        if (keyCode === ENTER || keyCode === ESCAPE) {
            this.handleInputFinish();
            return true;
        }

        const ctrlDown = Keyboard.isKeyDown(Keyboard.KEY_LCONTROL) || Keyboard.isKeyDown(Keyboard.KEY_RCONTROL);

        if (ctrlDown && keyCode === KEY_V) {
            try {
                const clipboard = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                if (clipboard !== null && clipboard !== undefined) {
                    const pasted = String(clipboard).replace(/[\r\n]+/g, ' ');
                    if (pasted.length > 0) {
                        this.text = this.text.slice(0, this.cursorIndex) + pasted + this.text.slice(this.cursorIndex);
                        this.cursorIndex += pasted.length;
                    }
                }
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
            return true;
        }

        if (keyCode === LEFT_ARROW) {
            if (this.cursorIndex > 0) {
                this.cursorIndex -= 1;
            }
            return true;
        }

        if (keyCode === RIGHT_ARROW) {
            if (this.cursorIndex < this.text.length) {
                this.cursorIndex += 1;
            }
            return true;
        }

        if (keyCode === BACKSPACE) {
            if (this.cursorIndex > 0) {
                this.text = this.text.slice(0, this.cursorIndex - 1) + this.text.slice(this.cursorIndex);
                this.cursorIndex -= 1;
            }
            return true;
        }

        if (keyCode === SPACE) {
            this.text = this.text.slice(0, this.cursorIndex) + ' ' + this.text.slice(this.cursorIndex);
            this.cursorIndex += 1;
            return true;
        }

        if (char && char.length === 1) {
            const code = char.charCodeAt(0);

            if (code >= 33 && code <= 126) {
                let finalChar = char;

                if (code >= 97 && code <= 122) {
                    const shiftHeld = Keyboard.isKeyDown(Keyboard.KEY_LSHIFT) || Keyboard.isKeyDown(Keyboard.KEY_RSHIFT);
                    if (shiftHeld) {
                        finalChar = char.toUpperCase();
                    }
                }

                this.text = this.text.slice(0, this.cursorIndex) + finalChar + this.text.slice(this.cursorIndex);
                this.cursorIndex += 1;
                return true;
            }
        }

        return false;
    }

    handleInputFinish() {
        this.isTyping = false;
        TypingState.isTyping = false;

        this.value = this.text;

        if (this.callback) {
            this.callback(this.value);
        }
        playClickSound();
    }
}
