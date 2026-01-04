import { playClickSound, drawRoundedRectangle, drawRoundedRectangleWithBorder, THEME, isInside, easeOutCubic, PADDING, drawText, FontSizes } from '../Utils';
import { setTooltip } from '../core/GuiTooltip';

export class ToggleButton {
    constructor(title, x, y, width = 10, height = 10, callback = null, defaultValue = false) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.enabled = defaultValue;
        this.optionPanelWidth = 0;
        this.optionPanelHeight = 0;
        this.callback = callback;
        this.description = null;

        this.animationProgress = this.enabled ? 1 : 0;
        this.animationStart = 0;
        this.animationDuration = 200;
    }

    updateAnimation() {
        if (this.animationStart === 0) {
            this.animationProgress = this.enabled ? 1 : 0;
            return;
        }

        const elapsed = Date.now() - this.animationStart;
        const t = Math.min(elapsed / this.animationDuration, 1);
        const target = this.enabled ? 1 : 0;

        this.animationProgress = this.animationProgress + (target - this.animationProgress) * easeOutCubic(t);

        if (t >= 1) {
            this.animationProgress = target;
            this.animationStart = 0;
        }
    }

    draw(mouseX, mouseY) {
        this.updateAnimation();

        const componentHeight = 48;
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;

        drawRoundedRectangleWithBorder({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
            radius: 10,
            color: THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });

        drawText(this.title, this.x + 12, this.y + componentHeight / 2, FontSizes.REGULAR, THEME.TEXT);

        const switchWidth = 36;
        const switchHeight = 20;
        const rightMargin = 12;

        const switchX = this.x + panelWidth - switchWidth - rightMargin;
        const switchY = this.y + componentHeight / 2 - switchHeight / 2;

        const trackColor = this.interpolateColor(THEME.SWITCH_OFF, THEME.ACCENT, this.animationProgress);

        drawRoundedRectangle({
            x: switchX,
            y: switchY,
            width: switchWidth,
            height: switchHeight,
            radius: switchHeight / 2,
            color: trackColor,
        });

        const knobSize = 14;
        const knobPadding = 3;
        const knobX = switchX + knobPadding + (switchWidth - knobSize - knobPadding * 2) * this.animationProgress;
        const knobY = switchY + switchHeight / 2 - knobSize / 2;

        drawRoundedRectangle({
            x: knobX,
            y: knobY,
            width: knobSize,
            height: knobSize,
            radius: knobSize / 2,
            color: THEME.KNOB,
        });

        const componentRect = {
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            setTooltip(this.description);
        }
    }

    interpolateColor(color1, color2, t) {
        const r = color1.getRed() / 255 + (color2.getRed() / 255 - color1.getRed() / 255) * t;
        const g = color1.getGreen() / 255 + (color2.getGreen() / 255 - color1.getGreen() / 255) * t;
        const b = color1.getBlue() / 255 + (color2.getBlue() / 255 - color1.getBlue() / 255) * t;
        const a = color1.getAlpha() / 255 + (color2.getAlpha() / 255 - color1.getAlpha() / 255) * t;
        return new java.awt.Color(r, g, b, a);
    }

    handleClick(mouseX, mouseY) {
        const componentHeight = 48;
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;

        const componentRect = {
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: componentHeight,
        };

        if (isInside(mouseX, mouseY, componentRect)) {
            this.enabled = !this.enabled;
            this.animationStart = Date.now();
            playClickSound();
            if (this.callback) {
                this.callback(this.enabled);
            }
            return true;
        }

        return false;
    }
}
