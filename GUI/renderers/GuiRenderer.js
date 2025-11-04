import { drawRoundedRectangleWithBorder } from '../utils/drawing';
import { clamp } from '../utils/helpers';
import { PADDING } from '../utils/constants';

const ANIMATION_DURATION = 250;

export class GuiRenderer {
    constructor(guiState, categoryManager) {
        this.guiState = guiState;
        this.categoryManager = categoryManager;
    }

    draw(mouseX, mouseY) {
        if (global.GuiTooltip) global.GuiTooltip.reset();

        const elapsed = Date.now() - this.guiState.openStartTime;
        const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

        this.updateAnimatedRectangles(progress);

        Client.getMinecraft().gameRenderer.renderBlur();

        const scale = Renderer.screen.getScale();
        GL11.glEnable(GL11.GL_SCISSOR_TEST);
        GL11.glScissor(
            Math.floor(this.guiState.animated.background.x * scale),
            Math.floor((Renderer.screen.getHeight() - (this.guiState.animated.background.y + this.guiState.animated.background.height)) * scale),
            Math.floor(this.guiState.animated.background.width * scale),
            Math.floor(this.guiState.animated.background.height * scale)
        );

        drawRoundedRectangleWithBorder(this.guiState.animated.background);
        drawRoundedRectangleWithBorder(this.guiState.animated.topPanel);
        drawRoundedRectangleWithBorder(this.guiState.animated.leftPanel);
        drawRoundedRectangleWithBorder(this.guiState.animated.rightPanel);

        if (progress >= 0.99) {
            this.categoryManager.draw(mouseX, mouseY, this.guiState.rectangles);
        }

        GL11.glDisable(GL11.GL_SCISSOR_TEST);

        if (global.GuiTooltip) {
            global.GuiTooltip.update();
            global.GuiTooltip.draw(mouseX, mouseY);
        }
    }

    updateAnimatedRectangles(progress) {
        const targetBackground = this.guiState.rectangles.background;
        const startX = targetBackground.x + targetBackground.width / 2;
        const startY = targetBackground.y + targetBackground.height / 2;

        const currentWidth = targetBackground.width * progress;
        const currentHeight = targetBackground.height * progress;

        Object.assign(this.guiState.animated.background, targetBackground, {
            x: startX - currentWidth / 2,
            y: startY - currentHeight / 2,
            width: currentWidth,
            height: currentHeight,
        });

        const topPanel = this.guiState.rectangles.topPanel;
        Object.assign(this.guiState.animated.topPanel, topPanel, {
            x: this.guiState.animated.background.x + PADDING,
            y: this.guiState.animated.background.y + PADDING,
            width: (targetBackground.width - PADDING * 2) * progress,
            height: topPanel.height * progress,
        });

        const leftPanel = this.guiState.rectangles.leftPanel;
        Object.assign(this.guiState.animated.leftPanel, leftPanel, {
            x: this.guiState.animated.background.x + PADDING,
            y: this.guiState.animated.topPanel.y + this.guiState.animated.topPanel.height + PADDING,
            width: leftPanel.width * progress,
            height: (targetBackground.height - PADDING * 3 - topPanel.height) * progress,
        });

        const rightPanel = this.guiState.rectangles.rightPanel;
        Object.assign(this.guiState.animated.rightPanel, rightPanel, {
            x: this.guiState.animated.leftPanel.x + this.guiState.animated.leftPanel.width + PADDING,
            y: this.guiState.animated.topPanel.y + this.guiState.animated.topPanel.height + PADDING,
            width: (targetBackground.width - PADDING * 3 - leftPanel.width) * progress,
            height: (targetBackground.height - PADDING * 3 - topPanel.height) * progress,
        });
    }
}
