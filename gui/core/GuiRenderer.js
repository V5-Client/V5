import { NVG } from '../../utils/Constants';
import { categoryManager } from '../categories/CategoryManager';
import { drawLeftPanelBackgrounds, drawLeftPanelIcons } from '../categories/CategoryRenderer';
import { clamp, drawRoundedRectangleWithBorder, easeOutBack, resetScissor, scissor } from '../Utils';
import { ANIMATION_DURATION, GuiRectangles, GuiState } from './GuiState';
import { GuiTooltip } from './GuiTooltip';

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
        categoryManager?.drawPopups?.(mouseX, mouseY);

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
