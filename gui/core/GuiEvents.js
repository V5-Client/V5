import { drawGUI } from './GuiRenderer';
import { isInside, clamp } from '../Utils';
import { saveSettings, loadSettings } from '../GuiSave';
import { GuiState, GuiRectangles } from './GuiState';
import { categoryManager } from '../categories/CategoryManager';
import { v5Command } from '../../utils/V5Commands';

const handleClick = (mouseX, mouseY) => {
    if (
        isInside(mouseX, mouseY, GuiRectangles.Background) &&
        !isInside(mouseX, mouseY, GuiRectangles.LeftPanel) &&
        !isInside(mouseX, mouseY, GuiRectangles.RightPanel)
    ) {
        GuiState.dragging = true;
        GuiRectangles.Background.dx = mouseX - GuiRectangles.Background.x;
        GuiRectangles.Background.dy = mouseY - GuiRectangles.Background.y;
    }

    categoryManager?.handleClick(mouseX, mouseY);
};

const handleMouseDrag = (mouseX, mouseY) => {
    if (GuiState.dragging) {
        let newX = mouseX - GuiRectangles.Background.dx;
        let newY = mouseY - GuiRectangles.Background.dy;

        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

        GuiRectangles.Background.x = clamp(newX, 0, screenWidth - GuiRectangles.Background.width);
        GuiRectangles.Background.y = clamp(newY, 0, screenHeight - GuiRectangles.Background.height);
        categoryManager?.invalidateLayoutCache();
    }
    categoryManager?.handleMouseDrag(mouseX, mouseY);
};

const handleScroll = (mouseX, mouseY, dir) => {
    categoryManager?.handleScroll(mouseX, mouseY, dir);
};

const handleMouseRelease = () => {
    GuiState.dragging = false;
    categoryManager?.handleMouseRelease();
};

const handleGuiClosed = () => {
    saveSettings();
    loadSettings();
};

GuiState.myGui.registerClicked((mouseX, mouseY, button) => {
    if (button === 0) handleClick(mouseX, mouseY);
});

GuiState.myGui.registerMouseDragged((mouseX, mouseY, button, _dt) => {
    if (button === 0) handleMouseDrag(mouseX, mouseY);
});

GuiState.myGui.registerMouseReleased(handleMouseRelease);
GuiState.myGui.registerClosed(handleGuiClosed);
GuiState.myGui.registerDraw(drawGUI);
GuiState.myGui.registerScrolled(handleScroll);

v5Command('gui', () => {
    GuiState.isOpening = true;
    GuiState.openStartTime = Date.now();
    loadSettings();
    categoryManager?.invalidateLayoutCache();
    categoryManager?.invalidateContentHeightCache();
    GuiState.myGui.open();
});
