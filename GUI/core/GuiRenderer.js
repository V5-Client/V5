import { ANIMATION_DURATION } from './GuiState';
import { drawRoundedRectangleWithBorder, clamp, PADDING, NVG, scissor, resetScissor } from '../Utils';
import { drawLeftPanelBackgrounds, drawLeftPanelIcons } from '../categories/CategoryRenderer';

export const drawGUI = (mouseX, mouseY) => {
    NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());

    global.GuiTooltip.reset();

    const elapsed = Date.now() - global.GuiState.openStartTime;
    const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

    const targetBackground = global.GuiRectangles.Background;
    const startX = targetBackground.x + targetBackground.width / 2;
    const startY = targetBackground.y + targetBackground.height / 2;

    const currentWidth = targetBackground.width * progress;
    const currentHeight = targetBackground.height * progress;

    Object.assign(global.GuiState.animatedBackground, targetBackground, {
        x: startX - currentWidth / 2,
        y: startY - currentHeight / 2,
        width: currentWidth,
        height: currentHeight,
    });

    Object.assign(global.GuiState.animatedLeftPanel, global.GuiRectangles.LeftPanel, {
        x: global.GuiState.animatedBackground.x + PADDING,
        y: global.GuiState.animatedBackground.y + PADDING,
        width: global.GuiRectangles.LeftPanel.width * progress,
        height: (targetBackground.height - PADDING * 2) * progress,
    });

    Object.assign(global.GuiState.animatedRightPanel, global.GuiRectangles.RightPanel, {
        x: global.GuiState.animatedLeftPanel.x + global.GuiState.animatedLeftPanel.width + PADDING,
        y: global.GuiState.animatedBackground.y + PADDING,
        width: (targetBackground.width - PADDING * 3 - global.GuiRectangles.LeftPanel.width) * progress,
        height: (targetBackground.height - PADDING * 2) * progress,
    });

    Client.getMinecraft().gameRenderer.renderBlur();

    drawRoundedRectangleWithBorder(global.GuiState.animatedBackground);
    drawRoundedRectangleWithBorder(global.GuiState.animatedLeftPanel);
    drawRoundedRectangleWithBorder(global.GuiState.animatedRightPanel);

    if (progress >= 0.99) {
        drawLeftPanelBackgrounds(mouseX, mouseY);
        drawLeftPanelIcons(mouseX, mouseY);

        const panel = global.GuiRectangles.RightPanel;
        scissor(panel.x, panel.y, panel.width, panel.height);
        global.categoryManager?.draw(mouseX, mouseY);
        resetScissor();
    }

    global.GuiTooltip.update();
    global.GuiTooltip.draw(mouseX, mouseY);

    NVG.endFrame();
};
