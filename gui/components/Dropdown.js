import {
    FontSizes,
    PADDING,
    THEME,
    createHighlight,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawText,
    easeInOutQuad,
    easeOutCubic,
    getTextWidth,
    isInside,
    playClickSound,
} from '../Utils';
import { setTooltip } from '../core/GuiTooltip';

export class MultiToggle {
    constructor(title, x, y, options = [], singleSelect = false, callback = null, defaultValue = false) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.options = options.map((option) => ({
            name: option,
            enabled: false,
            animationProgress: 0,
            animationStart: 0,
        }));
        this.singleSelect = singleSelect;

        const normalizeDefaultNames = (value) => {
            if (!Array.isArray(value)) return null;

            const names = [];
            for (const entry of value) {
                if (typeof entry === 'string') {
                    names.push(entry);
                    continue;
                }

                if (entry && typeof entry.name === 'string' && entry.enabled !== false) {
                    names.push(entry.name);
                }
            }

            return names;
        };

        const defaultNames = normalizeDefaultNames(defaultValue);

        if (Array.isArray(defaultValue)) {
            const defaultSet = new Set(defaultNames || []);
            this.options.forEach((option) => {
                if (defaultSet.has(option.name)) {
                    option.enabled = true;
                    option.animationProgress = 1;
                }
            });
        } else if (defaultValue) {
            const defaultIndex = options.indexOf(defaultValue);
            if (defaultIndex !== -1) {
                this.options[defaultIndex].enabled = true;
                this.options[defaultIndex].animationProgress = 1;
            }
        }

        if (this.singleSelect) {
            let firstEnabledIndex = -1;
            this.options.forEach((option, index) => {
                if (!option.enabled) return;
                if (firstEnabledIndex === -1) {
                    firstEnabledIndex = index;
                    return;
                }

                option.enabled = false;
                option.animationProgress = 0;
            });
        }

        if (this.singleSelect && !this.options.some((option) => option.enabled) && this.options.length > 0) {
            this.options[0].enabled = true;
            this.options[0].animationProgress = 1;
        }
        this.expanded = false;
        this.optionHeight = 32;
        this.containerHeight = 48;
        this.callback = callback;
        this.optionPanelWidth = 0;
        this.dropdownPadding = 8;
        this.optionSpacing = 4;
        this.dropdownOuterPadding = 2;

        this.animStart = 0;
        this.animFrom = 0;
        this.animTo = 0;
        this.animDuration = 220;
        this.animationProgress = 0;
        this.description = null;
        this.highlight = createHighlight();
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

    startHighlight() {
        this.highlight.startHighlight();
    }

    drawHighlight(panelWidth, panelHeight) {
        this.highlight.draw({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: panelHeight,
            accentColor: THEME.ACCENT,
            accentFillColor: THEME.ACCENT_DIM,
        });
    }

    updateToggleAnimations() {
        this.options.forEach((option) => {
            if (option.animationStart === 0) {
                option.animationProgress = option.enabled ? 1 : 0;
                return;
            }

            const elapsed = Date.now() - option.animationStart;
            const t = Math.min(elapsed / this.animDuration, 1);
            const target = option.enabled ? 1 : 0;

            option.animationProgress = option.animationProgress + (target - option.animationProgress) * easeOutCubic(t);

            if (t >= 1) {
                option.animationProgress = target;
                option.animationStart = 0;
            }
        });
    }

    getExpandedContentHeight() {
        const gaps = Math.max(0, this.options.length - 1);
        return this.options.length * this.optionHeight + gaps * this.optionSpacing + this.dropdownPadding * 2;
    }

    getExpandedHeight() {
        return this.getExpandedContentHeight() + this.dropdownOuterPadding;
    }

    draw(mouseX, mouseY) {
        this.updateAnimation();
        this.updateToggleAnimations();

        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;
        const textColor = THEME.TEXT;
        const cornerRadius = 10;

        this.drawHighlight(panelWidth, this.containerHeight);

        drawRoundedRectangleWithBorder({
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: this.containerHeight,
            radius: cornerRadius,
            color: THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });

        drawText(this.title, this.x + 12, this.y + this.containerHeight / 2, FontSizes.REGULAR, textColor);

        const arrowSize = 16;
        const rightMargin = 16;
        const arrowX = this.x + panelWidth - arrowSize - rightMargin;
        const arrowY = this.y + (this.containerHeight - arrowSize) / 2;

        drawRoundedRectangle({
            x: arrowX,
            y: arrowY,
            width: arrowSize,
            height: arrowSize,
            radius: 4,
            color: THEME.BG_INSET,
        });

        const arrow = this.expanded ? '▼' : '▶';
        const arrowFontSize = FontSizes.SMALL;
        const arrowWidth = getTextWidth(arrow, arrowFontSize);

        const centeredArrowX = arrowX + (arrowSize - arrowWidth) / 2;
        const centeredArrowY = arrowY + arrowSize / 2 + arrowFontSize / 2 - 3;

        drawText(arrow, centeredArrowX, centeredArrowY, arrowFontSize, textColor);

        const componentRect = {
            x: this.x,
            y: this.y,
            width: panelWidth,
            height: this.containerHeight,
        };

        if (this.description && isInside(mouseX, mouseY, componentRect)) {
            setTooltip(this.description);
        }

        if (this.animationProgress > 0) {
            const fullDropdownHeight = this.getExpandedContentHeight();
            const animatedHeight = fullDropdownHeight * this.animationProgress;
            const dropdownX = this.x;
            const dropdownY = this.y + this.containerHeight + 4;

            drawRoundedRectangleWithBorder({
                x: dropdownX,
                y: dropdownY,
                width: panelWidth,
                height: animatedHeight,
                radius: cornerRadius,
                color: THEME.BG_ELEVATED,
                borderWidth: 1,
                borderColor: THEME.BORDER,
            });

            let currentY = dropdownY + this.dropdownPadding;
            for (let i = 0; i < this.options.length; i++) {
                const optionTop = currentY;
                if (optionTop >= dropdownY + animatedHeight) break;
                const option = this.options[i];
                const optionX = this.x + 12;

                const isOptionHovered = isInside(mouseX, mouseY, {
                    x: dropdownX,
                    y: optionTop,
                    width: panelWidth,
                    height: this.optionHeight,
                });

                if (isOptionHovered) {
                    drawRoundedRectangle({
                        x: dropdownX + 4,
                        y: optionTop,
                        width: panelWidth - 8,
                        height: this.optionHeight,
                        radius: 6,
                        color: THEME.BG_INSET,
                    });
                }

                const switchWidth = 36;
                const switchHeight = 20;
                const switchX = this.x + panelWidth - switchWidth - 12;
                const switchY = optionTop + (this.optionHeight - switchHeight) / 2;

                const trackColor = this.interpolateColor(THEME.SWITCH_OFF, THEME.ACCENT, option.animationProgress);

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
                const knobX = switchX + knobPadding + (switchWidth - knobSize - knobPadding * 2) * option.animationProgress;
                const knobY = switchY + switchHeight / 2 - knobSize / 2;

                drawRoundedRectangle({
                    x: knobX,
                    y: knobY,
                    width: knobSize,
                    height: knobSize,
                    radius: knobSize / 2,
                    color: THEME.KNOB,
                });

                drawText(option.name, optionX, optionTop + this.optionHeight / 2, FontSizes.REGULAR, textColor);

                currentY += this.optionHeight;
                if (i < this.options.length - 1) {
                    currentY += this.optionSpacing;
                }
            }
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
        const panelWidth = this.optionPanelWidth - PADDING * 2 - 20;

        if (mouseX >= this.x && mouseX <= this.x + panelWidth && mouseY >= this.y && mouseY <= this.y + this.containerHeight) {
            this.expanded = !this.expanded;
            this.startAnimation(this.expanded);
            playClickSound();
            return true;
        }

        if (this.expanded) {
            const dropdownY = this.y + this.containerHeight + 4;
            const fullDropdownHeight = this.getExpandedContentHeight();

            if (mouseX >= this.x && mouseX <= this.x + panelWidth && mouseY >= dropdownY && mouseY <= dropdownY + fullDropdownHeight) {
                let currentY = dropdownY + this.dropdownPadding;
                for (let i = 0; i < this.options.length; i++) {
                    const optionTop = currentY;
                    const optionBottom = optionTop + this.optionHeight;
                    if (mouseY >= optionTop && mouseY <= optionBottom) {
                        if (this.singleSelect) {
                            const isEnabled = this.options[i].enabled;
                            if (isEnabled) {
                                playClickSound();
                                if (this.callback) this.callback(this.options);
                                return true;
                            }
                            this.options.forEach((opt, index) => {
                                const newState = index === i;
                                if (opt.enabled !== newState) {
                                    opt.enabled = newState;
                                    opt.animationStart = Date.now();
                                }
                            });
                        } else {
                            this.options[i].enabled = !this.options[i].enabled;
                            this.options[i].animationStart = Date.now();
                        }
                        playClickSound();
                        if (this.callback) this.callback(this.options);
                        return true;
                    }
                    currentY += this.optionHeight;
                    if (i < this.options.length - 1) {
                        currentY += this.optionSpacing;
                    }
                }
            }
        }
        return false;
    }
}
