import { THEME, drawRoundedRectangleWithBorder, drawText, getTextWidth } from '../Utils';

global.GuiTooltip = {
    tooltipToDraw: null,
    tooltipHoverTime: 0,
    currentTooltipText: null,
    isHoveringTooltipSource: false,

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

        const lines = this.tooltipToDraw.split('\n');
        const PADDING = 8;
        const MOUSE_OFFSET_X = 12;
        const MOUSE_OFFSET_Y = 12;
        const fontSize = 7;
        let tooltipWidth = 0;

        lines.forEach((line) => {
            const lineWidth = getTextWidth(line, fontSize);
            if (lineWidth > tooltipWidth) {
                tooltipWidth = lineWidth;
            }
        });

        tooltipWidth += PADDING * 2;
        const tooltipHeight = lines.length * (fontSize + 2) + PADDING * 2;

        let tooltipX = mouseX + MOUSE_OFFSET_X;
        let tooltipY = mouseY + MOUSE_OFFSET_Y;

        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

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
            color: THEME.TOOLTIP_BACKGROUND,
            borderWidth: 1,
            borderColor: THEME.TOOLTIP_BORDER,
        });

        lines.forEach((line, index) => {
            drawText(line, tooltipX + PADDING, tooltipY + PADDING + index * (fontSize + 2), fontSize, THEME.TOOLTIP_TEXT, 9);
        });
    },
};

global.setTooltip = (text) => {
    global.GuiTooltip.isHoveringTooltipSource = true;
    if (text !== global.GuiTooltip.currentTooltipText) {
        global.GuiTooltip.currentTooltipText = text;
        global.GuiTooltip.tooltipHoverTime = Date.now();
        global.GuiTooltip.tooltipToDraw = null;
    } else if (Date.now() - global.GuiTooltip.tooltipHoverTime > 400) {
        global.GuiTooltip.tooltipToDraw = text;
    }
};
