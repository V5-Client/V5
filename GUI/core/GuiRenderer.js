import { ANIMATION_DURATION } from './GuiState';
import { drawRoundedRectangleWithBorder, clamp, PADDING } from '../Utils';

export const drawGUI = (mouseX, mouseY) => {
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

    Object.assign(
        global.GuiState.animatedTopPanel,
        global.GuiRectangles.TopPanel,
        {
            x: global.GuiState.animatedBackground.x + PADDING,
            y: global.GuiState.animatedBackground.y + PADDING,
            width: (targetBackground.width - PADDING * 2) * progress,
            height: global.GuiRectangles.TopPanel.height * progress,
        }
    );

    Object.assign(
        global.GuiState.animatedLeftPanel,
        global.GuiRectangles.LeftPanel,
        {
            x: global.GuiState.animatedBackground.x + PADDING,
            y:
                global.GuiState.animatedTopPanel.y +
                global.GuiState.animatedTopPanel.height +
                PADDING,
            width: global.GuiRectangles.LeftPanel.width * progress,
            height:
                (targetBackground.height -
                    PADDING * 3 -
                    global.GuiRectangles.TopPanel.height) *
                progress,
        }
    );

    Object.assign(
        global.GuiState.animatedRightPanel,
        global.GuiRectangles.RightPanel,
        {
            x:
                global.GuiState.animatedLeftPanel.x +
                global.GuiState.animatedLeftPanel.width +
                PADDING,
            y:
                global.GuiState.animatedTopPanel.y +
                global.GuiState.animatedTopPanel.height +
                PADDING,
            width:
                (targetBackground.width -
                    PADDING * 3 -
                    global.GuiRectangles.LeftPanel.width) *
                progress,
            height:
                (targetBackground.height -
                    PADDING * 3 -
                    global.GuiRectangles.TopPanel.height) *
                progress,
        }
    );

    Client.getMinecraft().gameRenderer.renderBlur();

    const scale = Renderer.screen.getScale();
    GL11.glEnable(GL11.GL_SCISSOR_TEST);
    GL11.glScissor(
        Math.floor(global.GuiState.animatedBackground.x * scale),
        Math.floor(
            (Renderer.screen.getHeight() -
                (global.GuiState.animatedBackground.y +
                    global.GuiState.animatedBackground.height)) *
                scale
        ),
        Math.floor(global.GuiState.animatedBackground.width * scale),
        Math.floor(global.GuiState.animatedBackground.height * scale)
    );

    drawRoundedRectangleWithBorder(global.GuiState.animatedBackground);
    drawRoundedRectangleWithBorder(global.GuiState.animatedTopPanel);
    drawRoundedRectangleWithBorder(global.GuiState.animatedLeftPanel);
    drawRoundedRectangleWithBorder(global.GuiState.animatedRightPanel);

    if (progress >= 0.99) {
        global.categoryManager?.draw(mouseX, mouseY);
    }

    GL11.glDisable(GL11.GL_SCISSOR_TEST);

    global.GuiTooltip.update();
    global.GuiTooltip.draw(mouseX, mouseY);
};
