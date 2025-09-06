import {
    playClickSound,
    createGrey,
    drawRoundedRectangleWithBorder,
    GuiAccentColor,
} from './Utils';
import { Color, UIRoundedRectangle, Matrix } from '../Utility/Constants';

export class ToggleButton {
    constructor(title, x, y, width = 10, height = 10) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.enabled = false;
        this.optionPanelWidth = 0;
        this.optionPanelHeight = 0;
    }

    draw() {
        const componentHeight = 40;

        const backgroundColor = new Color(0.1935, 0.1931, 0.2092, 1);
        const accentColor = GuiAccentColor(0.75);
        const disabledBoxColor = new Color(0.3, 0.3, 0.3, 1);
        const textColor = new Color(1, 1, 1, 1);
        const panelWidth = this.optionPanelWidth - 20;

        drawRoundedRectangleWithBorder({
            x: this.x - 10,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 6,
            color: backgroundColor,
            borderWidth: 0.5,
            borderColor: createGrey(1, 0.2),
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
    }

    handleClick(mouseX, mouseY) {
        const componentHeight = 40;
        const panelWidth = this.optionPanelWidth - 35;
        const boxSize = 15;
        const rightMargin = 15;
        const boxX = this.x + panelWidth - boxSize - rightMargin;
        const boxY = this.y + componentHeight / 2 - boxSize / 2;

        if (
            mouseX >= boxX &&
            mouseX <= boxX + boxSize &&
            mouseY >= boxY &&
            mouseY <= boxY + boxSize
        ) {
            this.enabled = !this.enabled;
            playClickSound();
            return true;
        }

        return false;
    }
}
