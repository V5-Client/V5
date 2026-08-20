import { FontSizes, PADDING, THEME, drawRoundedRectangle, drawText, getTextWidth } from '../Utils';
import { t } from '../../utils/I18n';

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
        const displayTitle = this.getDisplayTitle?.() || t(this.title, {}, this.title);
        const titleWidth = getTextWidth(displayTitle, FontSizes.REGULAR);
        const lineX = titleX + titleWidth + 8;

        drawRoundedRectangle({
            x: lineX,
            y: this.y + 8,
            width: Math.max(0, this.x + width - lineX),
            height: 1,
            radius: 1,
            color: THEME.BG_INSET,
        });

        drawText(displayTitle, titleX, this.y + 8, FontSizes.REGULAR, THEME.TEXT);
    }
}
