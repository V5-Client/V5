import { categoryManager } from '../categories/CategoryManager';
import { Categories } from '../categories/CategorySystem';
import { SearchBar } from '../categories/CategorySearchBar';
import {
    drawLeftPanelBackgrounds,
    drawLeftPanelIcons,
    drawModuleNavBackground,
    drawSubcategoryButtons,
    getModuleNavRect,
} from '../categories/CategoryRenderer';
import { BORDER_WIDTH, PADDING, THEME, clamp, drawRect, drawRoundedRectangleWithBorder, easeOutBack, resetScissor, scissor } from '../Utils';
import { ANIMATION_DURATION, GuiRectangles, GuiState } from './GuiState';
import { GuiTooltip } from './GuiTooltip';
import { macroToggleGui } from '../MacroToggleGui';

export const drawGUI = (mouseX, mouseY) => {
    const elapsed = Date.now() - GuiState.openStartTime;
    const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);
    const ease = easeOutBack(progress);
    GuiState.isOpening = progress < 1;

    const targetBackground = GuiRectangles.Background;
    const centerX = targetBackground.x + targetBackground.width / 2;
    const centerY = targetBackground.y + targetBackground.height / 2;

    Render2D.blurBackground();

    try {
        Render2D.save();

        const guiScale = GuiState.getEffectiveGuiScale();
        Render2D.scale(guiScale, guiScale);

        drawRoundedRectangleWithBorder(targetBackground);

        GuiTooltip.reset();

        if (GuiState.macroToggleOpen) {
            Render2D.save();
            Render2D.translate(centerX, centerY);
            Render2D.scale(ease, ease);
            Render2D.translate(-centerX, -centerY);
            macroToggleGui.draw(mouseX, mouseY);
            Render2D.restore();
        } else {
            drawRoundedRectangleWithBorder(GuiRectangles.LeftPanel);
            drawRect({
                x: GuiRectangles.LeftPanel.x + GuiRectangles.LeftPanel.width - BORDER_WIDTH,
                y: GuiRectangles.LeftPanel.y,
                width: BORDER_WIDTH,
                height: GuiRectangles.LeftPanel.height,
                color: THEME.BORDER,
            });
            drawLeftPanelBackgrounds(mouseX, mouseY);
            drawLeftPanelIcons(mouseX, mouseY);

            SearchBar.draw(mouseX, mouseY, GuiRectangles.ModuleSearch, GuiRectangles.LeftPanel.y + PADDING, true);

            Render2D.save();
            Render2D.translate(centerX, centerY);
            Render2D.scale(ease, ease);
            Render2D.translate(-centerX, -centerY);

            const panel = GuiRectangles.RightPanel;
            const drawCategoryNav = (category, xOffset, drawBackground = true) => {
                if (category?.subcategories.length > 0) drawSubcategoryButtons(category, mouseX, mouseY, xOffset, drawBackground);
            };
            const previousCategory = Categories.categories.find((category) => category.name === Categories.previousSelected);
            const selectedCategory = Categories.categories.find((category) => category.name === Categories.selected);
            const navRect = getModuleNavRect();

            scissor(navRect.x - 1, navRect.y - 1, navRect.width + 2, navRect.height + 2);
            if (Categories.transitionDirection !== 0 && Categories.transitionType === 'category-swap') {
                const bothHaveSubcategories = selectedCategory?.subcategories.length > 0 && previousCategory?.subcategories.length > 0;
                if (bothHaveSubcategories) drawModuleNavBackground();
                const distance = panel.width * (1 - Categories.transitionProgress);
                drawCategoryNav(selectedCategory, Categories.transitionDirection === 1 ? distance : -distance, !bothHaveSubcategories);
                drawCategoryNav(
                    previousCategory,
                    Categories.transitionDirection === 1 ? -panel.width * Categories.transitionProgress : panel.width * Categories.transitionProgress,
                    !bothHaveSubcategories
                );
            } else if (Categories.transitionDirection !== 0 && Categories.transitionType === 'page') {
                const xOffset =
                    Categories.transitionDirection === 1 ? -panel.width * Categories.transitionProgress : -panel.width * (1 - Categories.transitionProgress);
                drawCategoryNav(selectedCategory, xOffset);
            } else if (Categories.currentPage === 'categories') {
                drawCategoryNav(selectedCategory, 0);
            }
            resetScissor();

            const contentY =
                Categories.currentPage === 'categories' && Categories.transitionDirection === 0 && selectedCategory?.subcategories.length > 0
                    ? navRect.y + navRect.height + 16
                    : panel.y;
            const contentClipY = contentY - BORDER_WIDTH;
            scissor(panel.x, contentClipY, panel.width, panel.height - (contentClipY - panel.y));
            categoryManager?.draw(mouseX, mouseY);
            resetScissor();
            categoryManager?.drawPopups?.(mouseX, mouseY);

            Render2D.restore();
        }

        GuiTooltip.update();
        GuiTooltip.draw(mouseX, mouseY);

        Render2D.restore();
    } catch (e) {
        console.error(e);
    }
};
