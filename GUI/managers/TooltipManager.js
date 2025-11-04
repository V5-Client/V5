import { THEME } from '../utils/theme';
import { drawRoundedRectangle } from '../utils/drawing';

export class TooltipManager {
    constructor() {
        this.tooltipToDraw = null;
        this.tooltipHoverTime = 0;
        this.currentTooltipText = null;
        this.isHoveringTooltipSource = false;
    }

    reset() {
        this.isHoveringTooltipSource = false;
    }

    update() {
        if (!this.isHoveringTooltipSource) {
            this.currentTooltipText = null;
            this.tooltipToDraw = null;
        }
    }

    setTooltip(text) {
        this.isHoveringTooltipSource = true;
        if (text !== this.currentTooltipText) {
            this.currentTooltipText = text;
            this.tooltipHoverTime = Date.now();
            this.tooltipToDraw = null;
        } else if (Date.now() - this.tooltipHoverTime > 400) {
            this.tooltipToDraw = text;
        }
    }

    draw(mouseX, mouseY) {
        if (!this.tooltipToDraw) return;

        const lines = this.tooltipToDraw.split('\n');
        const PADDING = 5;
        const MOUSE_OFFSET_X = 10;
        const MOUSE_OFFSET_Y = 0;
        let tooltipWidth = 0;

        lines.forEach((line) => {
            const lineWidth = Renderer.getStringWidth(line);
            if (lineWidth > tooltipWidth) {
                tooltipWidth = lineWidth;
            }
        });

        tooltipWidth += PADDING * 2;
        const tooltipHeight = lines.length * 9 + PADDING * 2;

        let tooltipX = mouseX + MOUSE_OFFSET_X;
        let tooltipY = mouseY + MOUSE_OFFSET_Y;

        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

        if (tooltipX + tooltipWidth > screenWidth) tooltipX = mouseX - tooltipWidth - MOUSE_OFFSET_X;
        if (tooltipY + tooltipHeight > screenHeight) tooltipY = screenHeight - tooltipHeight;
        if (tooltipY < 0) tooltipY = 0;
        if (tooltipX < 0) tooltipX = 0;

        drawRoundedRectangle({
            x: tooltipX,
            y: tooltipY,
            width: tooltipWidth,
            height: tooltipHeight,
            radius: 3,
            color: THEME.TOOLTIP_BACKGROUND,
        });

        lines.forEach((line, index) => {
            Renderer.drawString(line, tooltipX + PADDING, tooltipY + PADDING + index * 9, THEME.TOOLTIP_TEXT, true);
        });
    }
}

// Set up global for "backward compatibility" (cope)
global.GuiTooltip = new TooltipManager();
global.setTooltip = (text) => global.GuiTooltip.setTooltip(text);
