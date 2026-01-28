import {
    drawRoundedRectangleWithBorder,
    drawRoundedRectangle,
    colorWithAlpha,
    PADDING,
    drawText,
    FontSizes,
    THEME,
    drawImage,
    getTextWidth,
    drawRect,
    isInside,
    TypingState,
    playClickSound,
} from '../Utils';
import { Toolkit, DataFlavor } from '../../utils/Constants';

const ASSETS_PATHS = ['config/ChatTriggers/modules/V5/assets/', 'config/ChatTriggers/assets/V5/assets/'];

const getAssetPath = (filename) => {
    for (const basePath of ASSETS_PATHS) {
        const fullPath = basePath + filename;
        if (new java.io.File(fullPath).exists()) {
            return fullPath;
        }
    }
    return ASSETS_PATHS[0] + filename;
};

const SEARCH_ICON = getAssetPath('search.svg');

register('guiKey', (char, keyCode, gui, event) => {
    if (SearchBar.isFocused) {
        if (SearchBar.handleKeyType(char, keyCode)) {
            cancel(event);
        }
    }
});

export const SearchBar = {
    isExpanded: false,
    animation: 0,
    query: '',
    isFocused: false,
    cursorIndex: 0,
    collapsedWidth: 30,
    expandedWidth: 220,
    height: 28,
    lerpSpeed: 0.15,
    textX: 0,
    hoverBlockRect: null,
    hoverProgress: 0,
    hoverLastUpdate: Date.now(),

    draw(mouseX, mouseY, panel, y) {
        if (!panel) return;

        if (!this.isFocused && this.isExpanded && this.animation > 0.9 && this.query === '') {
            this.isExpanded = false;
        }

        const target = this.isExpanded ? 1 : 0;
        this.animation += (target - this.animation) * this.lerpSpeed;

        const currentWidth = this.collapsedWidth + (this.expandedWidth - this.collapsedWidth) * this.animation;
        const x = panel.x + panel.width - PADDING - currentWidth;

        const barRect = { x, y, width: currentWidth, height: this.height };
        const hovered = isInside(mouseX, mouseY, barRect);
        this.hoverBlockRect = barRect;

        const now = Date.now();
        const delta = (now - this.hoverLastUpdate) / 150;
        this.hoverLastUpdate = now;

        if (hovered) this.hoverProgress = Math.min(1, this.hoverProgress + delta);
        else this.hoverProgress = Math.max(0, this.hoverProgress - delta);

        const baseColor = this.isFocused ? THEME.BG_INSET : THEME.BG_COMPONENT;
        const borderColor = THEME.BORDER;

        drawRoundedRectangleWithBorder({
            x: x,
            y: y,
            width: currentWidth,
            height: this.height,
            radius: 8,
            color: baseColor,
            borderWidth: 1,
            borderColor: borderColor,
        });

        if (!this.isFocused && this.hoverProgress > 0) {
            drawRoundedRectangle({
                x: x,
                y: y,
                width: currentWidth,
                height: this.height,
                radius: 8,
                color: colorWithAlpha(THEME.BG_INSET, this.hoverProgress),
            });
        }

        const barRightEdge = panel.x + panel.width - PADDING;
        const iconX = barRightEdge - this.collapsedWidth / 2 - 8;
        const iconY = y + (this.height - 16) / 2;

        drawImage(SEARCH_ICON, iconX, iconY, 16, 16);

        if (this.animation > 0.4) {
            const fontSize = FontSizes.REGULAR;
            this.textX = x + 10;
            const textY = y + this.height / 2;

            if (this.query === '') {
                drawText('Search...', this.textX, textY, fontSize, THEME.TEXT_MUTED);
            } else {
                drawText(this.query, this.textX, textY, fontSize, THEME.TEXT);
            }

            if (this.isFocused && Date.now() % 1000 < 500) {
                const cursorOffset = getTextWidth(this.query.substring(0, this.cursorIndex), fontSize);
                const finalCursorX = this.textX + cursorOffset;

                drawRect({
                    x: finalCursorX,
                    y: textY - 4,
                    width: 1,
                    height: 9,
                    color: THEME.TEXT_DIM,
                });
            }
        }
    },

    handleClick(mouseX, mouseY, panel, y) {
        if (!panel) return false;

        const barRightEdge = panel.x + panel.width - PADDING;
        const iconX = barRightEdge - this.collapsedWidth;

        const iconRect = {
            x: iconX,
            y: y,
            width: this.collapsedWidth,
            height: this.height,
        };

        if (isInside(mouseX, mouseY, iconRect)) {
            this.isExpanded = !this.isExpanded;
            this.isFocused = this.isExpanded;
            TypingState.isTyping = this.isFocused;

            if (this.isFocused) {
                this.cursorIndex = this.query.length;
            }

            playClickSound();
            return true;
        }

        if (this.isExpanded) {
            const currentWidth = this.collapsedWidth + (this.expandedWidth - this.collapsedWidth) * this.animation;
            const barX = barRightEdge - currentWidth;
            const barRect = { x: barX, y, width: currentWidth, height: this.height };

            if (isInside(mouseX, mouseY, barRect)) {
                if (!this.isFocused) {
                    this.isFocused = true;
                    TypingState.isTyping = true;
                    playClickSound();
                }
                this.cursorIndex = this.getCursorIndexFromMouseX(mouseX);
                return true;
            }
        }

        if (this.isFocused || this.isExpanded) {
            this.isExpanded = false;
            this.isFocused = false;
            TypingState.isTyping = false;
        }

        return false;
    },

    handleKeyType(char, keyCode) {
        if (!this.isFocused) return false;

        const BACKSPACE = 259;
        const ESCAPE = 256;
        const ENTER = 257;
        const LEFT_ARROW = 263;
        const RIGHT_ARROW = 262;
        const SPACE = 32;
        const KEY_V = 86;

        if (keyCode === ESCAPE || keyCode === ENTER) {
            this.isExpanded = false;
            this.isFocused = false;
            TypingState.isTyping = false;
            playClickSound();
            return true;
        }

        if (keyCode === LEFT_ARROW) {
            if (this.cursorIndex > 0) this.cursorIndex--;
            return true;
        }
        if (keyCode === RIGHT_ARROW) {
            if (this.cursorIndex < this.query.length) this.cursorIndex++;
            return true;
        }

        if (keyCode === BACKSPACE) {
            if (this.cursorIndex > 0) {
                this.query = this.query.slice(0, this.cursorIndex - 1) + this.query.slice(this.cursorIndex);
                this.cursorIndex--;
            }
            return true;
        }

        const ctrlDown = Keyboard.isKeyDown(Keyboard.KEY_LCONTROL) || Keyboard.isKeyDown(Keyboard.KEY_RCONTROL);
        if (ctrlDown && keyCode === KEY_V) {
            try {
                const clipboard = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                if (clipboard !== null && clipboard !== undefined) {
                    const pasted = String(clipboard).replace(/[\r\n]+/g, ' ');
                    if (pasted.length > 0) {
                        this.insertText(pasted);
                    }
                }
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
            return true;
        }

        if (keyCode === SPACE) {
            this.insertText(' ');
            return true;
        }

        const charStr = char?.toString();
        if (charStr && charStr.length === 1) {
            const code = charStr.charCodeAt(0);
            if (code >= 33 && code <= 126) {
                let finalChar = charStr;
                if (code >= 97 && code <= 122) {
                    const shiftHeld = Keyboard.isKeyDown(Keyboard.KEY_LSHIFT) || Keyboard.isKeyDown(Keyboard.KEY_RSHIFT);
                    if (shiftHeld) {
                        finalChar = charStr.toUpperCase();
                    }
                }
                this.insertText(finalChar);
                return true;
            }
        }

        return false;
    },

    insertText(text) {
        if (!text) return false;
        const maxTextWidth = this.expandedWidth - 35;
        let accepted = '';

        for (let i = 0; i < text.length; i++) {
            const candidate = this.query.slice(0, this.cursorIndex) + accepted + text[i] + this.query.slice(this.cursorIndex);
            if (getTextWidth(candidate, FontSizes.REGULAR) > maxTextWidth) break;
            accepted += text[i];
        }

        if (accepted.length === 0) return false;
        this.query = this.query.slice(0, this.cursorIndex) + accepted + this.query.slice(this.cursorIndex);
        this.cursorIndex += accepted.length;
        return true;
    },

    updateHoverBlock(panel, y) {
        if (!panel) return;
        const currentWidth = this.collapsedWidth + (this.expandedWidth - this.collapsedWidth) * this.animation;
        const x = panel.x + panel.width - PADDING - currentWidth;
        this.hoverBlockRect = { x, y, width: currentWidth, height: this.height };
    },

    isHoverBlocked(mouseX, mouseY) {
        if (!this.hoverBlockRect) return false;
        return isInside(mouseX, mouseY, this.hoverBlockRect);
    },

    getCursorIndexFromMouseX(mouseX) {
        if (!this.query) return 0;
        const relativeX = mouseX - this.textX;
        let prevWidth = 0;
        for (let i = 0; i < this.query.length; i++) {
            const charWidth = getTextWidth(this.query[i], FontSizes.REGULAR);
            if (relativeX <= prevWidth + charWidth / 2) return i;
            prevWidth += charWidth;
        }
        return this.query.length;
    },

    resetSearch() {
        this.isExpanded = false;
        this.isFocused = false;
        this.cursorIndex = 0;
        this.query = '';
    },

    getSearchQuery() {
        return this.query.toLowerCase().trim();
    },
};
