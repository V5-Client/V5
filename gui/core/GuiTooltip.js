import { FontSizes, THEME, drawRoundedRectangleWithBorder, drawText, getTextWidth } from '../Utils';
import { GuiState } from './GuiState';

export const GuiTooltip = {
    tooltipToDraw: null,
    tooltipHoverTime: 0,
    currentTooltipText: null,
    isHoveringTooltipSource: false,
    layout: null,

    reset() {
        this.isHoveringTooltipSource = false;
    },

    update() {
        if (!this.isHoveringTooltipSource) {
            this.currentTooltipText = null;
            this.tooltipToDraw = null;
        }
    },

    draw(mouseX, mouseY) {
        if (!this.tooltipToDraw) return;

        const PADDING = 8;
        const MOUSE_OFFSET_X = 12;
        const MOUSE_OFFSET_Y = 12;
        const fontSize = FontSizes.SMALL;
        if (!this.layout || this.layout.text !== this.tooltipToDraw) {
            const lines = this.tooltipToDraw.split('\n');
            this.layout = {
                text: this.tooltipToDraw,
                lines,
                width: Math.max(...lines.map((line) => getTextWidth(line, fontSize))) + PADDING * 2,
                height: lines.length * (fontSize + 2) + PADDING * 2,
            };
        }
        const { lines, width: tooltipWidth, height: tooltipHeight } = this.layout;

        let tooltipX = mouseX + MOUSE_OFFSET_X;
        let tooltipY = mouseY + MOUSE_OFFSET_Y;

        const screenWidth = GuiState.getGuiWidth();
        const screenHeight = GuiState.getGuiHeight();

        if (tooltipX + tooltipWidth > screenWidth) tooltipX = mouseX - tooltipWidth - MOUSE_OFFSET_X;

        if (tooltipY + tooltipHeight > screenHeight) tooltipY = screenHeight - tooltipHeight;

        if (tooltipY < 0) tooltipY = 0;
        if (tooltipX < 0) tooltipX = 0;

        drawRoundedRectangleWithBorder({
            x: tooltipX,
            y: tooltipY,
            width: tooltipWidth,
            height: tooltipHeight,
            radius: 8,
            color: THEME.TOOLTIP_BG,
            borderWidth: 1,
            borderColor: THEME.TOOLTIP_BORDER,
        });

        lines.forEach((line, index) => {
            drawText(line, tooltipX + PADDING, tooltipY + PADDING + index * (fontSize + 2), fontSize, THEME.TOOLTIP_TEXT, 9);
        });
    },
};

export const setTooltip = (text) => {
    GuiTooltip.isHoveringTooltipSource = true;
    if (text !== GuiTooltip.currentTooltipText) {
        GuiTooltip.currentTooltipText = text;
        GuiTooltip.tooltipHoverTime = Date.now();
        GuiTooltip.tooltipToDraw = null;
    } else if (Date.now() - GuiTooltip.tooltipHoverTime > 400) {
        GuiTooltip.tooltipToDraw = text;
    }
};
