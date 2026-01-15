import { ANIMATION_DURATION, GuiState, GuiRectangles } from './GuiState';
import { drawRoundedRectangleWithBorder, clamp, scissor, resetScissor, easeOutBack } from '../Utils';
import { NVG } from '../../utils/Constants';
import { drawLeftPanelBackgrounds, drawLeftPanelIcons } from '../categories/CategoryRenderer';
import { GuiTooltip } from './GuiTooltip';
import { categoryManager } from '../categories/CategoryManager';

export const drawGUI = (mouseX, mouseY) => {
    const elapsed = Date.now() - GuiState.openStartTime;
    const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);
    const ease = easeOutBack(progress);

    const targetBackground = GuiRectangles.Background;
    const centerX = targetBackground.x + targetBackground.width / 2;
    const centerY = targetBackground.y + targetBackground.height / 2;

    Client.getMinecraft().gameRenderer.renderBlur();

    try {
        NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
        NVG.save();

        NVG.translate(centerX, centerY);
        NVG.scale(ease, ease);
        NVG.translate(-centerX, -centerY);

        GuiTooltip.reset();

        drawRoundedRectangleWithBorder(GuiRectangles.Background);
        drawRoundedRectangleWithBorder(GuiRectangles.LeftPanel);
        drawRoundedRectangleWithBorder(GuiRectangles.RightPanel);

        drawLeftPanelBackgrounds(mouseX, mouseY);
        drawLeftPanelIcons(mouseX, mouseY);

        const panel = GuiRectangles.RightPanel;
        scissor(panel.x, panel.y, panel.width, panel.height);
        categoryManager?.draw(mouseX, mouseY);
        resetScissor();

        GuiTooltip.update();
        GuiTooltip.draw(mouseX, mouseY);

        NVG.restore();
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
    } finally {
        try {
            NVG.endFrame();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }
};
