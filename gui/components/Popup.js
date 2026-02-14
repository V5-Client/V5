import { NVG } from '../../utils/Constants';
import {
    clamp,
    colorWithAlpha,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawShadow,
    drawText,
    easeInBack,
    easeOutBack,
    FontSizes,
    getTextWidth,
    isInside,
    playClickSound,
    THEME,
} from '../Utils';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { MultiToggle } from './Dropdown';
import { Separator } from './Separator';

const CLOSE_TEXT = '×';
const ANIMATION_DURATION = 350;

export class Popup {
    constructor(title, x, y, openText = 'Open', closeText = 'Close', callback = null) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.openText = openText;
        this.closeText = closeText;
        this.callback = callback;

        this.optionPanelWidth = 0;
        this.containerHeight = 48;
        this.description = null;
        this.statusText = null;

        this.animationState = 'closed';
        this.animationStart = 0;
        this.dimScreen = true;

        this.components = [];
        this.contentScrollY = 0;

        this.windowPadding = 20;
        this.headerHeight = 44;
        this.closeSize = 24;
        this.windowRect = {};
        this.closeRect = {};

        this.closeHoverProgress = 0;

        this.button = new Button(title, x, y, openText, () => this.toggleOpen(undefined, false));
    }

    setStatus(text) {
        const next = text !== null && text !== undefined ? String(text) : null;
        this.statusText = next && next.trim().length > 0 ? next : null;
    }

    addComponent(component) {
        this.components.push(component);
        return component;
    }

    setButtonText(openText, closeText) {
        if (openText) this.openText = openText;
        if (closeText) this.closeText = closeText;
        const isOpen = this.animationState === 'open' || this.animationState === 'opening';
        this.button.setButtonText(isOpen ? this.closeText : this.openText);
    }

    startHighlight() {
        if (typeof this.button.startHighlight === 'function') {
            this.button.startHighlight();
        }
    }

    get isOpen() {
        return this.animationState !== 'closed';
    }

    getWindowHeight() {
        const contentHeight = this.getContentHeight();
        const maxHeight = Math.max(150, Renderer.screen.getHeight() * 0.8);
        return Math.min(maxHeight, this.headerHeight + this.windowPadding * 2 + contentHeight);
    }

    getContentHeight() {
        let height = 0;
        if (this.statusText) height += 20; // Significantly reduced from 40 to 20
        this.components.forEach((component) => {
            let compHeight = component instanceof Separator ? 26 : 48 + 6;
            if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    compHeight += component.getExpandedHeight() * component.animationProgress;
                }
            }
            height += compHeight;
        });
        height += 10;
        return height;
    }

    getWindowRect() {
        const screenW = Renderer.screen.getWidth();
        const screenH = Renderer.screen.getHeight();
        const baseWidth = Math.min(540, screenW * 0.7);
        const height = this.getWindowHeight();
        return {
            x: Math.round((screenW - baseWidth) / 2),
            y: Math.round((screenH - height) / 2),
            width: Math.round(baseWidth),
            height: Math.round(height),
        };
    }

    toggleOpen(force, playSound = true) {
        const currentState = this.isOpen;
        const nextState = typeof force === 'boolean' ? force : !currentState;

        if (nextState) {
            this.animationState = 'opening';
            this.animationStart = Date.now();
        } else {
            this.animationState = 'closing';
            this.animationStart = Date.now();
        }

        this.button.setButtonText(nextState ? this.closeText : this.openText);
        if (this.callback) this.callback(nextState);
        if (playSound) playClickSound();
    }

    updateCloseHoverPress(isHovered) {
        this.closeHoverProgress = isHovered ? 1 : 0;
    }

    drawButton(mouseX, mouseY) {
        this.button.x = this.x;
        this.button.y = this.y;
        this.button.optionPanelWidth = this.optionPanelWidth;
        this.button.optionPanelHeight = this.optionPanelHeight;
        this.button.description = this.description;
        this.button.draw(mouseX, mouseY);
    }

    drawOverlay(mouseX, mouseY) {
        if (this.animationState === 'closed') return;

        const elapsed = Date.now() - this.animationStart;
        let progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

        if (this.animationState === 'opening' && progress >= 1) {
            this.animationState = 'open';
        } else if (this.animationState === 'closing' && progress >= 1) {
            this.animationState = 'closed';
            return;
        }

        let animValue = 1;
        if (this.animationState === 'opening') {
            animValue = easeOutBack(progress);
        } else if (this.animationState === 'closing') {
            animValue = 1 - easeInBack(progress);
        }

        const windowRect = this.getWindowRect();
        this.windowRect = windowRect;

        if (this.dimScreen) {
            const screenW = Renderer.screen.getWidth();
            const screenH = Renderer.screen.getHeight();
            const bgAlpha = Math.min(0.4, 0.4 * (this.animationState === 'closing' ? 1 - progress : progress));
            drawRoundedRectangle({
                x: 0,
                y: 0,
                width: screenW,
                height: screenH,
                radius: 0,
                color: new java.awt.Color(0, 0, 0, bgAlpha),
            });
        }

        const centerX = windowRect.x + windowRect.width / 2;
        const centerY = windowRect.y + windowRect.height / 2;

        NVG.save();
        NVG.translate(centerX, centerY);
        NVG.scale(animValue, animValue);
        NVG.translate(-centerX, -centerY);

        drawShadow(windowRect.x, windowRect.y, windowRect.width, windowRect.height, 20, 0.5);

        drawRoundedRectangleWithBorder({
            x: windowRect.x,
            y: windowRect.y,
            width: windowRect.width,
            height: windowRect.height,
            radius: 14,
            color: THEME.BG_WINDOW,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });

        drawRoundedRectangle({
            x: windowRect.x,
            y: windowRect.y + this.headerHeight,
            width: windowRect.width,
            height: 1,
            radius: 0,
            color: THEME.BORDER,
        });

        const titleX = windowRect.x + this.windowPadding + 4;
        const titleY = windowRect.y + this.headerHeight / 2 + 3;
        drawText(this.title, titleX, titleY, FontSizes.HEADER, THEME.TEXT);

        const closeX = windowRect.x + windowRect.width - this.windowPadding - this.closeSize;
        const closeY = windowRect.y + (this.headerHeight - this.closeSize) / 2;
        this.closeRect = { x: closeX, y: closeY, width: this.closeSize, height: this.closeSize };

        drawRoundedRectangle({
            x: closeX,
            y: closeY,
            width: this.closeSize,
            height: this.closeSize,
            radius: 6,
            color: THEME.BG_INSET,
        });
        const closeTextWidth = getTextWidth(CLOSE_TEXT, FontSizes.LARGE);
        const closeTextX = closeX + this.closeSize / 2 - closeTextWidth / 2;
        const closeTextY = closeY + this.closeSize / 2;
        drawText(CLOSE_TEXT, closeTextX, closeTextY, FontSizes.LARGE, THEME.TEXT);

        const contentX = windowRect.x + this.windowPadding;
        const contentY = windowRect.y + this.headerHeight + this.windowPadding - this.contentScrollY;
        const contentWidth = windowRect.width - this.windowPadding * 2;
        const contentHeight = windowRect.height - this.headerHeight - this.windowPadding * 2;

        NVG.scissor(windowRect.x, windowRect.y + this.headerHeight + 1, windowRect.width, contentHeight + this.windowPadding);

        const maxScroll = Math.max(0, this.getContentHeight() - contentHeight - this.windowPadding);
        this.contentScrollY = Math.max(0, Math.min(this.contentScrollY, maxScroll));

        let currentY = contentY;
        if (this.statusText) {
            drawText(this.statusText, contentX, currentY + 6, FontSizes.REGULAR, THEME.TEXT_MUTED);
            currentY += 20;
        }

        this.components.forEach((component) => {
            if (typeof component.draw !== 'function') return;

            if (component instanceof Button && component.title === component.buttonText) {
                const btnHeight = 36;
                const btnWidth = contentWidth;

                component.buttonRect = {
                    x: contentX,
                    y: currentY,
                    width: btnWidth,
                    height: btnHeight,
                };

                if (typeof component.updateHoverPress === 'function') {
                    component.updateHoverPress();
                }

                drawRoundedRectangle({
                    x: contentX,
                    y: currentY,
                    width: btnWidth,
                    height: btnHeight,
                    radius: 8,
                    color: THEME.BG_INSET,
                });
                const pressProgress = component.pressProgress || 0;
                if (pressProgress > 0) {
                    drawRoundedRectangle({
                        x: contentX,
                        y: currentY,
                        width: btnWidth,
                        height: btnHeight,
                        radius: 8,
                        color: colorWithAlpha(THEME.BG_INSET, 0.45 * pressProgress),
                    });
                }

                const txtW = getTextWidth(component.buttonText, FontSizes.REGULAR);
                drawText(
                    component.buttonText,
                    contentX + btnWidth / 2 - txtW / 2,
                    currentY + btnHeight / 2 + (pressProgress > 0 ? 1 : 0),
                    FontSizes.REGULAR,
                    THEME.TEXT
                );

                currentY += btnHeight + 10;
                return;
            }

            const isSeparator = component instanceof Separator;
            component.x = contentX;
            component.y = currentY;
            component.optionPanelWidth = contentWidth + this.windowPadding * 2;
            component.optionPanelHeight = contentHeight;
            component.draw(mouseX, mouseY);

            let componentHeight = isSeparator ? 26 : 48 + 6;
            if (!isSeparator && (component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    componentHeight += component.getExpandedHeight() * component.animationProgress;
                }
            }
            currentY += componentHeight;
        });

        NVG.resetScissor();
        NVG.restore();
    }

    handleButtonClick(mouseX, mouseY) {
        return this.button.handleClick(mouseX, mouseY);
    }

    handleOverlayClick(mouseX, mouseY) {
        if (this.animationState !== 'open') return false;

        if (isInside(mouseX, mouseY, this.closeRect)) {
            this.toggleOpen(false);
            return true;
        }

        if (!isInside(mouseX, mouseY, this.windowRect)) {
            this.toggleOpen(false);
            return true;
        }

        const contentX = this.windowRect.x + this.windowPadding;
        const contentY = this.windowRect.y + this.headerHeight + this.windowPadding - this.contentScrollY;
        const contentWidth = this.windowRect.width - this.windowPadding * 2;

        if (mouseY < this.windowRect.y + this.headerHeight) return true;

        let currentY = contentY;
        if (this.statusText) currentY += 20;

        for (let i = 0; i < this.components.length; i++) {
            const component = this.components[i];

            if (component instanceof Button && component.title === component.buttonText) {
                const btnHeight = 36;
                const btnWidth = contentWidth;

                const clickableArea = {
                    x: contentX,
                    y: currentY,
                    width: btnWidth,
                    height: btnHeight,
                };

                const visibleTop = this.windowRect.y + this.headerHeight;
                const visibleBottom = this.windowRect.y + this.windowRect.height - this.windowPadding;

                if (currentY + btnHeight > visibleTop && currentY < visibleBottom) {
                    if (isInside(mouseX, mouseY, clickableArea)) {
                        if (typeof component.triggerPressFeedback === 'function') {
                            component.triggerPressFeedback();
                        }
                        playClickSound();
                        if (component.callback) component.callback();
                        return true;
                    }
                }
                currentY += btnHeight + 10;
                continue;
            }

            if (typeof component.handleClick !== 'function') {
                currentY += 54;
                continue;
            }

            let componentHeight = 48;
            let expansionHeight = 0;
            if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
                expansionHeight = component.getExpandedHeight() * component.animationProgress;
            }
            componentHeight += expansionHeight;

            const clickableArea = {
                x: contentX,
                y: currentY,
                width: contentWidth,
                height: componentHeight,
            };

            const visibleTop = this.windowRect.y + this.headerHeight;
            const visibleBottom = this.windowRect.y + this.windowRect.height - this.windowPadding;

            if (currentY + componentHeight > visibleTop && currentY < visibleBottom) {
                if (isInside(mouseX, mouseY, clickableArea)) {
                    component.x = contentX;
                    component.y = currentY;
                    component.optionPanelWidth = contentWidth + this.windowPadding * 2;
                    component.optionPanelHeight = this.windowRect.height;

                    if (component.handleClick(mouseX, mouseY)) return true;
                }
            }

            currentY += componentHeight + 6;
        }

        return true;
    }

    handleScroll(mouseX, mouseY, dir) {
        if (this.animationState !== 'open') return false;
        if (!isInside(mouseX, mouseY, this.windowRect)) return false;

        const contentHeight = this.windowRect.height - this.headerHeight - this.windowPadding * 2;
        const maxScroll = Math.max(0, this.getContentHeight() - contentHeight - this.windowPadding);
        const scrollSpeed = 25;

        this.contentScrollY = Math.max(0, Math.min(this.contentScrollY + (dir > 0 ? -1 : 1) * scrollSpeed, maxScroll));
        return true;
    }

    handleMouseDrag(mouseX, mouseY) {
        if (this.animationState !== 'open') return false;

        const contentX = this.windowRect.x + this.windowPadding;
        const contentY = this.windowRect.y + this.headerHeight + this.windowPadding - this.contentScrollY;
        const contentWidth = this.windowRect.width - this.windowPadding * 2;

        let currentY = contentY;
        if (this.statusText) currentY += 20;

        this.components.forEach((component) => {
            if (component instanceof Button && component.title === component.buttonText) {
                currentY += 36 + 10;
                return;
            }

            if (typeof component.handleMouseDrag !== 'function') {
                currentY += 54;
                return;
            }

            component.x = contentX;
            component.y = currentY;
            component.optionPanelWidth = contentWidth + this.windowPadding * 2;

            let componentHeight = 48;
            let expansionHeight = 0;
            if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
                expansionHeight = component.getExpandedHeight() * component.animationProgress;
            }
            componentHeight += expansionHeight;
            currentY += componentHeight + 6;

            component.handleMouseDrag(mouseX, mouseY);
        });
        return true;
    }

    handleMouseRelease() {
        if (this.animationState !== 'open') return false;
        this.components.forEach((component) => {
            if (typeof component.handleMouseRelease === 'function') {
                component.handleMouseRelease();
            }
        });
        return true;
    }
}
