import {
    playClickSound,
    drawRoundedRectangleWithBorder,
    drawRoundedRectangle,
    drawText,
    FontSizes,
    PADDING,
    THEME,
    isInside,
    clamp,
    easeOutCubic,
    easeInOutQuad,
    getTextWidth,
} from '../Utils';
import { Color, NVG } from '../../utils/Constants';
import { setTooltip } from '../core/GuiTooltip';

let Gradient;
try {
    Gradient = Java.type('com.v5.render.Gradient');
} catch (e) {
    console.error('V5 Caught error' + e + e.stack);
    Gradient = {
        LeftToRight: 'LeftToRight',
        TopToBottom: 'TopToBottom',
    };
}

export class ColorPicker {
    constructor(title, x, y, defaultColor, callback) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.callback = callback;

        let safeDefault = defaultColor;
        if (typeof safeDefault === 'number') {
            safeDefault = safeDefault | 0;
        }

        this.color = safeDefault instanceof Color ? safeDefault : new Color(safeDefault);

        const hsv = java.awt.Color.RGBtoHSB(this.color.getRed(), this.color.getGreen(), this.color.getBlue(), null);
        this.hue = hsv[0];
        this.sat = hsv[1];
        this.val = hsv[2];
        this.alpha = this.color.getAlpha() / 255;

        this.expanded = false;
        this.height = 48;
        this.outerPadding = 2;
        this.expandedHeight = 193;
        this.optionPanelWidth = 0;
        this.panelPaddingY = 10;

        this.draggingHue = false;
        this.draggingSV = false;
        this.draggingAlpha = false;

        this.animStart = 0;
        this.animFrom = 0;
        this.animTo = 0;
        this.animDuration = 220;
        this.animationProgress = 0;
        this.description = null;
    }

    startAnimation(expanding) {
        this.animStart = Date.now();
        this.animFrom = this.animationProgress;
        this.animTo = expanding ? 1 : 0;
    }

    updateAnimation() {
        if (this.animStart === 0) return;
        const elapsed = Date.now() - this.animStart;
        const t = Math.min(elapsed / this.animDuration, 1);
        const eased = easeInOutQuad(t);
        this.animationProgress = this.animFrom + (this.animTo - this.animFrom) * eased;
        if (t >= 1) this.animStart = 0;
    }

    getExpandedHeight() {
        return this.expandedHeight + this.outerPadding;
    }

    hsvToRgb(h, s, v, a) {
        const rgb = java.awt.Color.HSBtoRGB(h, s, v);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;
        return new Color(r / 255, g / 255, b / 255, a);
    }

    updateColor() {
        this.color = this.hsvToRgb(this.hue, this.sat, this.val, this.alpha);
        if (this.callback) this.callback(this.color);
    }

    colorToHex(color) {
        const r = color.getRed().toString(16).padStart(2, '0');
        const g = color.getGreen().toString(16).padStart(2, '0');
        const b = color.getBlue().toString(16).padStart(2, '0');
        const a = color.getAlpha().toString(16).padStart(2, '0');
        return (r + g + b + (this.alpha < 1 ? a : '')).toUpperCase();
    }

    drawCheckerboard(x, y, width, height, radius, cellSize = 4) {
        NVG.drawCheckerboard(x, y, width, height, radius, cellSize);
    }

    drawHandle(x, y, size, isCircle = true) {
        // shadow!
        drawRoundedRectangle({
            x: x - size / 2 - 1,
            y: y - size / 2 + 1,
            width: size + 2,
            height: size + 2,
            radius: isCircle ? (size + 2) / 2 : 3,
            color: new Color(0, 0, 0, 0.4),
        });

        // border
        drawRoundedRectangle({
            x: x - size / 2 - 1,
            y: y - size / 2 - 1,
            width: size + 2,
            height: size + 2,
            radius: isCircle ? (size + 2) / 2 : 3,
            color: new Color(0.15, 0.15, 0.15, 1),
        });

        // middle white
        drawRoundedRectangle({
            x: x - size / 2,
            y: y - size / 2,
            width: size,
            height: size,
            radius: isCircle ? size / 2 : 2,
            color: new Color(1, 1, 1, 1),
        });
    }

    drawSliderHandle(x, y, width, height) {
        drawRoundedRectangle({
            x: x + 1,
            y: y + 1,
            width: width,
            height: height,
            radius: 3,
            color: new Color(0, 0, 0, 0.3),
        });

        drawRoundedRectangleWithBorder({
            x: x,
            y: y,
            width: width,
            height: height,
            radius: 3,
            color: new Color(1, 1, 1, 1),
            borderWidth: 1,
            borderColor: new Color(0.7, 0.7, 0.7, 1),
        });
    }

    draw(mouseX, mouseY) {
        this.updateAnimation();

        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const collapsedHeight = 48;

        drawRoundedRectangleWithBorder({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: collapsedHeight,
            radius: 10,
            color: THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });

        drawText(this.title, this.x + 12, this.y + collapsedHeight / 2, FontSizes.REGULAR, THEME.TEXT);

        const previewSize = 26;
        const previewX = this.x + panelWidth - previewSize - 12;
        const previewY = this.y + (collapsedHeight - previewSize) / 2;

        this.drawCheckerboard(previewX, previewY, previewSize, previewSize, 6, 4);

        drawRoundedRectangle({
            x: previewX,
            y: previewY,
            width: previewSize,
            height: previewSize,
            radius: 6,
            color: this.color,
        });
        NVG.drawHollowRect(previewX, previewY, previewSize, previewSize, 2, THEME.BORDER.getRGB(), 6);

        const arrowSize = 16;
        const arrowX = previewX - arrowSize - 10;
        const arrowY = this.y + (collapsedHeight - arrowSize) / 2;

        const isArrowHovered = isInside(mouseX, mouseY, { x: arrowX, y: arrowY, width: arrowSize, height: arrowSize });

        drawRoundedRectangle({
            x: arrowX,
            y: arrowY,
            width: arrowSize,
            height: arrowSize,
            radius: 4,
            color: isArrowHovered ? THEME.HOVER : THEME.BG_INSET,
        });

        const arrow = this.expanded ? '▲' : '▼';
        const arrowFontSize = FontSizes.SMALL;
        const arrowWidth = getTextWidth(arrow, arrowFontSize);

        const centeredArrowX = arrowX + (arrowSize - arrowWidth) / 2;
        const centeredArrowY = arrowY + arrowSize / 2 + arrowFontSize / 3;

        drawText(arrow, centeredArrowX, centeredArrowY, arrowFontSize, THEME.TEXT);

        const componentRect = { x: this.x, y: this.y, width: panelWidth, height: collapsedHeight };
        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            setTooltip(this.description);
        }

        if (this.animationProgress > 0) {
            const contentY = this.y + collapsedHeight + 4;
            const fullHeight = this.expandedHeight;
            const animatedHeight = fullHeight * this.animationProgress;

            drawRoundedRectangleWithBorder({
                x: this.x,
                y: contentY,
                width: panelWidth,
                height: animatedHeight,
                radius: 10,
                color: THEME.BG_COMPONENT,
                borderWidth: 1,
                borderColor: THEME.BORDER,
            });

            if (this.animationProgress > 0.3) {
                const pickerPadding = 12;
                const innerWidth = panelWidth - pickerPadding * 2;
                const svHeight = 95;
                const svY = contentY + this.panelPaddingY;
                const svX = this.x + pickerPadding;

                const hueColorInt = java.awt.Color.HSBtoRGB(this.hue, 1, 1) | 0;
                const whiteColorInt = new Color(1, 1, 1, 1).getRGB() | 0;
                NVG.drawGradientRect(svX, svY, innerWidth, svHeight, whiteColorInt, hueColorInt, Gradient.LeftToRight, 6);

                const transparentInt = new Color(0, 0, 0, 0).getRGB() | 0;
                const blackInt = new Color(0, 0, 0, 1).getRGB() | 0;
                NVG.drawGradientRect(svX, svY, innerWidth, svHeight, transparentInt, blackInt, Gradient.TopToBottom, 6);

                NVG.drawHollowRect(svX - 1, svY - 1, innerWidth + 2, svHeight + 2, 1, THEME.BORDER.getRGB(), 7);

                const pickerX = svX + this.sat * innerWidth;
                const pickerY = svY + (1 - this.val) * svHeight;
                this.drawHandle(pickerX, pickerY, 12, true);

                const barHeight = 14;
                const barSpacing = 10;
                const hueY = svY + svHeight + barSpacing;

                NVG.drawHueBar(svX, hueY, innerWidth, barHeight, 5);
                NVG.drawHollowRect(svX - 1, hueY - 1, innerWidth + 2, barHeight + 2, 1, THEME.BORDER.getRGB(), 5);

                const hueSliderX = svX + this.hue * innerWidth;
                this.drawSliderHandle(hueSliderX - 3, hueY - 2, 6, barHeight + 4);

                const alphaY = hueY + barHeight + barSpacing;

                this.drawCheckerboard(svX, alphaY, innerWidth, barHeight, 5, 4);

                const cTransInt = new Color(this.color.getRed() / 255, this.color.getGreen() / 255, this.color.getBlue() / 255, 0).getRGB() | 0;
                const cSolidInt = new Color(this.color.getRed() / 255, this.color.getGreen() / 255, this.color.getBlue() / 255, 1).getRGB() | 0;
                NVG.drawGradientRect(svX, alphaY, innerWidth, barHeight, cTransInt, cSolidInt, Gradient.LeftToRight, 5);

                NVG.drawHollowRect(svX - 1, alphaY - 1, innerWidth + 2, barHeight + 2, 1, THEME.BORDER.getRGB(), 5);

                const alphaSliderX = svX + this.alpha * innerWidth;
                this.drawSliderHandle(alphaSliderX - 3, alphaY - 2, 6, barHeight + 4);

                const infoY = alphaY + barHeight + this.panelPaddingY;

                const hexColor = this.colorToHex(this.color);
                const hexText = `#${hexColor}`;
                const hexWidth = getTextWidth(hexText, FontSizes.REGULAR) + 16;

                drawRoundedRectangle({
                    x: svX,
                    y: infoY,
                    width: hexWidth,
                    height: 20,
                    radius: 4,
                    color: THEME.BG_INSET,
                });
                drawText(hexText, svX + 8, infoY + 10, FontSizes.REGULAR, THEME.TEXT);

                const alphaPercent = `${Math.round(this.alpha * 100)}%`;
                const alphaTextWidth = getTextWidth(alphaPercent, FontSizes.REGULAR);

                drawRoundedRectangle({
                    x: svX + innerWidth - alphaTextWidth - 16,
                    y: infoY,
                    width: alphaTextWidth + 16,
                    height: 20,
                    radius: 4,
                    color: THEME.BG_INSET,
                });
                drawText(alphaPercent, svX + innerWidth - alphaTextWidth - 8, infoY + 10, FontSizes.REGULAR, THEME.TEXT);
            }
        }
    }

    handleClick(mouseX, mouseY) {
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const collapsedHeight = 48;

        if (mouseX >= this.x && mouseX <= this.x + panelWidth && mouseY >= this.y && mouseY <= this.y + collapsedHeight) {
            this.expanded = !this.expanded;
            this.startAnimation(this.expanded);
            playClickSound();
            return true;
        }

        if (this.expanded && this.animationProgress > 0.5) {
            const pickerPadding = 12;
            const innerWidth = panelWidth - pickerPadding * 2;
            const svHeight = 95;
            const contentY = this.y + collapsedHeight + 4;
            const svY = contentY + this.panelPaddingY;
            const svX = this.x + pickerPadding;

            if (mouseX >= svX && mouseX <= svX + innerWidth && mouseY >= svY && mouseY <= svY + svHeight) {
                this.draggingSV = true;
                this.handleMouseDrag(mouseX, mouseY);
                return true;
            }

            const barHeight = 14;
            const barSpacing = 10;
            const hueY = svY + svHeight + barSpacing;

            if (mouseX >= svX && mouseX <= svX + innerWidth && mouseY >= hueY && mouseY <= hueY + barHeight) {
                this.draggingHue = true;
                this.handleMouseDrag(mouseX, mouseY);
                return true;
            }

            const alphaY = hueY + barHeight + barSpacing;

            if (mouseX >= svX && mouseX <= svX + innerWidth && mouseY >= alphaY && mouseY <= alphaY + barHeight) {
                this.draggingAlpha = true;
                this.handleMouseDrag(mouseX, mouseY);
                return true;
            }
        }
        return false;
    }

    handleMouseDrag(mouseX, mouseY) {
        if (!this.expanded) return;
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const pickerPadding = 12;
        const innerWidth = panelWidth - pickerPadding * 2;
        const svHeight = 95;
        const contentY = this.y + 48 + 4;
        const svY = contentY + this.panelPaddingY;
        const svX = this.x + pickerPadding;

        if (this.draggingSV) {
            this.sat = clamp((mouseX - svX) / innerWidth, 0, 1);
            this.val = clamp(1 - (mouseY - svY) / svHeight, 0, 1);
            this.updateColor();
        } else if (this.draggingHue) {
            this.hue = clamp((mouseX - svX) / innerWidth, 0, 0.9999);
            this.updateColor();
        } else if (this.draggingAlpha) {
            this.alpha = clamp((mouseX - svX) / innerWidth, 0, 1);
            this.updateColor();
        }
    }

    handleMouseRelease() {
        this.draggingHue = false;
        this.draggingSV = false;
        this.draggingAlpha = false;
    }
}
