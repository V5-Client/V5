import './GuiState';
import './GuiRenderer';
import { drawGUI } from './GuiRenderer';
import { isInside, clamp } from '../Utils';
import { saveSettings, loadSettings } from '../GuiSave';

const handleClick = (mouseX, mouseY) => {
    if (
        isInside(mouseX, mouseY, global.GuiRectangles.Background) &&
        !isInside(mouseX, mouseY, global.GuiRectangles.TopPanel) &&
        !isInside(mouseX, mouseY, global.GuiRectangles.LeftPanel) &&
        !isInside(mouseX, mouseY, global.GuiRectangles.RightPanel)
    ) {
        global.GuiState.dragging = true;
        global.GuiRectangles.Background.dx = mouseX - global.GuiRectangles.Background.x;
        global.GuiRectangles.Background.dy = mouseY - global.GuiRectangles.Background.y;
    }

    global.categoryManager?.handleClick(mouseX, mouseY);
};

const handleMouseDrag = (mouseX, mouseY) => {
    if (global.GuiState.dragging) {
        let newX = mouseX - global.GuiRectangles.Background.dx;
        let newY = mouseY - global.GuiRectangles.Background.dy;

        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

        global.GuiRectangles.Background.x = clamp(newX, 0, screenWidth - global.GuiRectangles.Background.width);
        global.GuiRectangles.Background.y = clamp(newY, 0, screenHeight - global.GuiRectangles.Background.height);
        global.categoryManager?.invalidateLayoutCache();
    }
    global.categoryManager?.handleMouseDrag(mouseX, mouseY);
};

const handleScroll = (mouseX, mouseY, dir) => {
    global.categoryManager?.handleScroll(mouseX, mouseY, dir);
};

const handleMouseRelease = () => {
    global.GuiState.dragging = false;
    global.categoryManager?.handleMouseRelease();
};

const handleGuiClosed = () => {
    saveSettings();
    loadSettings();
};

global.GuiState.myGui.registerClicked((mouseX, mouseY, button) => {
    if (button === 0) handleClick(mouseX, mouseY);
});

global.GuiState.myGui.registerMouseDragged((mouseX, mouseY, button, _dt) => {
    if (button === 0) handleMouseDrag(mouseX, mouseY);
});

global.GuiState.myGui.registerMouseReleased(handleMouseRelease);
global.GuiState.myGui.registerClosed(handleGuiClosed);
global.GuiState.myGui.registerDraw(drawGUI);
global.GuiState.myGui.registerScrolled(handleScroll);

register('command', () => {
    global.GuiState.isOpening = true;
    global.GuiState.openStartTime = Date.now();
    loadSettings();
    global.categoryManager?.invalidateLayoutCache();
    global.GuiState.myGui.open();
}).setName('gui');
