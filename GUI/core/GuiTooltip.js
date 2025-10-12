import { THEME } from '../Utils';
import { drawRoundedRectangle } from '../Utils';

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
        const PADDING = 5;
        let tooltipWidth = 0;
        
        lines.forEach((line) => {
            const lineWidth = Renderer.getStringWidth(line);
            if (lineWidth > tooltipWidth) {
                tooltipWidth = lineWidth;
            }
        });
        
        tooltipWidth += PADDING * 2;
        const tooltipHeight = lines.length * 9 + PADDING * 2;
        const tooltipX = mouseX + 10;
        const tooltipY = mouseY;

        drawRoundedRectangle({
            x: tooltipX,
            y: tooltipY,
            width: tooltipWidth,
            height: tooltipHeight,
            radius: 3,
            color: THEME.TOOLTIP_BACKGROUND,
        });

        lines.forEach((line, index) => {
            Renderer.drawString(
                line,
                tooltipX + PADDING,
                tooltipY + PADDING + index * 9,
                THEME.TOOLTIP_TEXT,
                true
            );
        });
    }
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