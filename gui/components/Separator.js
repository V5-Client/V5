import { FontSizes, PADDING, THEME, drawRoundedRectangle, drawText, getTextWidth } from '../Utils';

export class Separator {
    constructor(title, fullWidth = false) {
        this.title = title;
        this.fullWidth = fullWidth;
        this.items = [];
        this.type = 'separator';

        this.x = 0;
        this.y = 0;
        this.optionPanelWidth = 0;
        this.titleWidth = getTextWidth(title, FontSizes.REGULAR);
    }

    draw(mouseX, mouseY) {
        const width = this.optionPanelWidth - PADDING * 2 - (this.fullWidth ? 0 : 20);
        const titleX = this.x + 8;
        const lineX = titleX + this.titleWidth + 8;

        drawRoundedRectangle({
            x: lineX,
            y: this.y + 8,
            width: Math.max(0, this.x + width - lineX),
            height: 1,
            radius: 1,
            color: THEME.BG_INSET,
        });

        drawText(this.title, titleX, this.y + 8, FontSizes.REGULAR, THEME.TEXT);
    }
}
