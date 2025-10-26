import {
    playClickSound,
    drawRoundedRectangleWithBorder,
    THEME,
    isInside,
} from '../Utils';
import { UIRoundedRectangle, Matrix } from '../../Utility/Constants';

export class ToggleButton {
    constructor(title, x, y, width = 10, height = 10, callback = null) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.enabled = false;
        this.optionPanelWidth = 0;
        this.optionPanelHeight = 0;
        this.callback = callback;
        this.description = null;
    }

    draw(mouseX, mouseY) {
        const componentHeight = 40;

        const backgroundColor = THEME.TOGGLE_BACKGROUND;
        const accentColor = THEME.TOGGLE_ACCENT;
        const disabledBoxColor = THEME.TOGGLE_DISABLED_BOX;
        const textColor = THEME.TOGGLE_TEXT;
        const panelWidth = this.optionPanelWidth - 20;

        drawRoundedRectangleWithBorder({
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 6,
            color: backgroundColor,
            borderWidth: 0.5,
            borderColor: THEME.TOGGLE_BORDER,
        });

        Renderer.drawString(
            this.title,
            this.x,
            this.y + componentHeight / 2 - 4,
            textColor.getRGB(),
            false
        );

        const boxSize = 15;
        const rightMargin = 15;

        const boxX = this.x + panelWidth - boxSize - rightMargin - 10;
        const boxY = this.y + componentHeight / 2 - boxSize / 2;
        const boxColor = this.enabled ? accentColor : disabledBoxColor;

        UIRoundedRectangle.Companion.drawRoundedRectangle(
            Matrix,
            boxX,
            boxY,
            boxX + boxSize,
            boxY + boxSize,
            4,
            boxColor
        );

        const componentRect = {
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            global.setTooltip(this.description);
        }
    }

    handleClick(mouseX, mouseY) {
        const componentHeight = 40;
        const panelWidth = this.optionPanelWidth - 20;

        const componentRect = {
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (isInside(mouseX, mouseY, componentRect)) {
            this.enabled = !this.enabled;
            playClickSound();
            if (this.callback) {
                this.callback(this.enabled);
            }
            return true;
        }

        return false;
    }
}
