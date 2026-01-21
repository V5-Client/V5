import {
    drawRoundedRectangleWithBorder,
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

const SEARCH_ICON = 'config/ChatTriggers/modules/V5/assets/search.svg';

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

        drawRoundedRectangleWithBorder({
            x: x,
            y: y,
            width: currentWidth,
            height: this.height,
            radius: 3,
            color: this.isFocused ? THEME.BG_INSET : THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: this.isFocused || hovered ? THEME.BORDER_ACCENT : THEME.BORDER,
        });

        const barRightEdge = panel.x + panel.width - PADDING;
        const iconX = barRightEdge - this.collapsedWidth / 2 - 8;
        const iconY = y + (this.height - 16) / 2;

        drawImage(SEARCH_ICON, iconX, iconY, 16, 16);

        if (this.animation > 0.4) {
            this.textX = x + 8;
            const textY = y + this.height / 2;

            if (this.query === '') {
                drawText('Search...', this.textX, textY, FontSizes.LARGE, Renderer.GRAY);
            } else {
                drawText(this.query, this.textX, textY, FontSizes.LARGE, THEME.TEXT);
            }

            if (this.isFocused && Date.now() % 1000 < 500) {
                const cursorOffset = getTextWidth(this.query.substring(0, this.cursorIndex), FontSizes.LARGE);
                const finalCursorX = this.textX + cursorOffset;

                drawRect({
                    x: finalCursorX,
                    y: textY - 6,
                    width: 1,
                    height: 10,
                    color: THEME.ACCENT,
                });
            }
        }
    },

    handleClick(mouseX, mouseY, panel, y) {
        if (!panel) return false;

        const currentWidth = this.collapsedWidth + (this.expandedWidth - this.collapsedWidth) * this.animation;
        const x = panel.x + panel.width - PADDING - currentWidth;
        const iconX = panel.x + panel.width - PADDING - 22;

        const iconRect = { x: iconX, y: y + 6, width: 16, height: 16 };
        const barRect = { x, y, width: currentWidth, height: this.height };

        if (isInside(mouseX, mouseY, iconRect)) {
            this.isExpanded = !this.isExpanded;
            this.isFocused = this.isExpanded;
            TypingState.isTyping = this.isFocused;
            if (this.isFocused) this.cursorIndex = this.query.length;
            playClickSound();
            return true;
        }

        if (this.isExpanded && isInside(mouseX, mouseY, barRect)) {
            if (!this.isFocused) {
                this.isFocused = true;
                TypingState.isTyping = true;
                playClickSound();
            }
            this.cursorIndex = this.getCursorIndexFromMouseX(mouseX);
            return true;
        }

        if (this.isExpanded || this.isFocused) {
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
        const LEFT_ARROW = 263;
        const RIGHT_ARROW = 262;

        if (keyCode === ESCAPE) {
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

        const charStr = String(char);
        if (charStr && charStr.length === 1) {
            const code = charStr.charCodeAt(0);
            if (code >= 32 && code <= 126) {
                const nextQuery = this.query.slice(0, this.cursorIndex) + charStr + this.query.slice(this.cursorIndex);
                const maxTextWidth = this.expandedWidth - 35;

                if (getTextWidth(nextQuery, FontSizes.LARGE) <= maxTextWidth) {
                    this.query = nextQuery;
                    this.cursorIndex++;
                }
                return true;
            }
        }
        return false;
    },

    getCursorIndexFromMouseX(mouseX) {
        if (!this.query) return 0;
        const relativeX = mouseX - this.textX;
        let prevWidth = 0;
        for (let i = 0; i < this.query.length; i++) {
            const charWidth = getTextWidth(this.query[i], FontSizes.LARGE);
            if (relativeX <= prevWidth + charWidth / 2) return i;
            prevWidth += charWidth;
        }
        return this.query.length;
    },

    getSearchQuery() {
        return this.query.toLowerCase().trim();
    },
};
