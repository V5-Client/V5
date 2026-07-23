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
    }

    draw(mouseX, mouseY) {
        const width = this.optionPanelWidth - PADDING * 2 - (this.fullWidth ? 0 : 20);

        drawRoundedRectangle({
            x: this.x,
            y: this.y + 8,
            width,
            height: 1,
            radius: 1,
            color: THEME.BG_INSET,
        });

        const textWidth = getTextWidth(this.title, FontSizes.REGULAR);
        const bgWidth = textWidth + 16;

        drawRoundedRectangle({
            x: this.x,
            y: this.y,
            width: bgWidth,
            height: 16,
            radius: 6,
            color: THEME.BG_WINDOW,
        });

        drawText(this.title, this.x + 8, this.y + 8, FontSizes.REGULAR, THEME.TEXT);
    }
}
