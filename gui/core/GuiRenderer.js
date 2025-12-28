import { ANIMATION_DURATION } from './GuiState';
import { drawRoundedRectangleWithBorder, clamp, PADDING, NVG, scissor, resetScissor, easeOutBack } from '../Utils';
import { drawLeftPanelBackgrounds, drawLeftPanelIcons } from '../categories/CategoryRenderer';

export const drawGUI = (mouseX, mouseY) => {
    const elapsed = Date.now() - global.GuiState.openStartTime;
    const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);
    const ease = easeOutBack(progress);

    const targetBackground = global.GuiRectangles.Background;
    const centerX = targetBackground.x + targetBackground.width / 2;
    const centerY = targetBackground.y + targetBackground.height / 2;

    Client.getMinecraft().gameRenderer.renderBlur();

    try {
        NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
        NVG.save();

        NVG.translate(centerX, centerY);
        NVG.scale(ease, ease);
        NVG.translate(-centerX, -centerY);

        global.GuiTooltip.reset();

        drawRoundedRectangleWithBorder(global.GuiRectangles.Background);
        drawRoundedRectangleWithBorder(global.GuiRectangles.LeftPanel);
        drawRoundedRectangleWithBorder(global.GuiRectangles.RightPanel);

        drawLeftPanelBackgrounds(mouseX, mouseY);
        drawLeftPanelIcons(mouseX, mouseY);

        const panel = global.GuiRectangles.RightPanel;
        scissor(panel.x, panel.y, panel.width, panel.height);
        global.categoryManager?.draw(mouseX, mouseY);
        resetScissor();

        global.GuiTooltip.update();
        global.GuiTooltip.draw(mouseX, mouseY);

        NVG.restore();
    } catch (e) {
        console.error('V5 GUI Error: ' + e);
    } finally {
        try {
            NVG.endFrame();
        } catch (e) {}
    }
};
