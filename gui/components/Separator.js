import {
    PADDING,
    THEME,
    drawRoundedRectangle,
    drawText,
    getTextWidth,
    FontSizes,
    playClickSound,
    isInside,
    easeInOutQuad,
    pushScissor,
    popScissor,
} from '../Utils';

export class Separator {
    constructor(title, fullWidth = false) {
        this.title = title;
        this.fullWidth = fullWidth;
        this.items = [];
        this.type = 'separator';
        this.collapsed = false;
        this.headerRect = null;

        this.animStart = 0;
        this.animFrom = 1;
        this.animTo = 1;
        this.animDuration = 220;
        this.animationProgress = this.collapsed ? 0 : 1;

        this.x = 0;
        this.y = 0;
        this.optionPanelWidth = 0;
    }

    getWidth() {
        if (this.fullWidth) {
            return this.optionPanelWidth - PADDING * 2;
        }
        return this.optionPanelWidth - PADDING * 2 - 20;
    }

    getHeaderRect() {
        const width = this.getWidth();
        return { x: this.x, y: this.y, width: width, height: 16 };
    }

    setCollapsed(value) {
        this.collapsed = !!value;
        this.animationProgress = this.collapsed ? 0 : 1;
        this.animStart = 0;
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

    toggleCollapsed() {
        const nextCollapsed = !this.collapsed;
        this.collapsed = nextCollapsed;
        this.startAnimation(!nextCollapsed);
    }

    handleClick(mouseX, mouseY) {
        const rect = this.getHeaderRect();
        if (isInside(mouseX, mouseY, rect)) {
            this.toggleCollapsed();
            playClickSound();
            return true;
        }
        return false;
    }

    draw(mouseX, mouseY) {
        this.updateAnimation();

        const width = this.getWidth();
        const separatorY = this.y;
        this.headerRect = { x: this.x, y: separatorY, width: width, height: 16 };

        const contentHeight = this.items.length > 0 ? 48 : 0;
        const animatedContentHeight = contentHeight * this.animationProgress;
        const scissorHeight = 16 + animatedContentHeight;
        const scissorPadding = 2;

        pushScissor(this.x - scissorPadding, separatorY - scissorPadding, width + scissorPadding * 2, scissorHeight + scissorPadding * 2);

        drawRoundedRectangle({
            x: this.x,
            y: separatorY + 8,
            width: width,
            height: 1,
            radius: 1,
            color: THEME.BG_INSET,
        });

        const textWidth = getTextWidth(this.title, FontSizes.REGULAR);
        const bgWidth = textWidth + 16;

        drawRoundedRectangle({
            x: this.x,
            y: separatorY,
            width: bgWidth,
            height: 16,
            radius: 6,
            color: THEME.BG_WINDOW,
        });

        drawText(this.title, this.x + 8, separatorY + 8, FontSizes.REGULAR, THEME.TEXT);

        const arrowSize = 16;
        const rightMargin = 16;
        const arrowX = this.x + width - arrowSize - rightMargin;
        const arrowY = separatorY;

        drawRoundedRectangle({
            x: arrowX,
            y: arrowY,
            width: arrowSize,
            height: arrowSize,
            radius: 4,
            color: THEME.BG_INSET,
        });

        const arrow = this.animationProgress > 0.5 ? '▼' : '▶';
        const arrowFontSize = FontSizes.SMALL;
        const arrowWidth = getTextWidth(arrow, arrowFontSize);
        const centeredArrowX = arrowX + (arrowSize - arrowWidth) / 2;
        const centeredArrowY = arrowY + arrowSize / 2 + arrowFontSize / 2 - 3;

        drawText(arrow, centeredArrowX, centeredArrowY, arrowFontSize, THEME.TEXT);

        popScissor();
    }
}
