import { getConfigFile, writeConfigFile } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { categoryManager } from '../categories/CategoryManager';
import { SearchBar } from '../categories/CategorySearchBar';
import { Slider } from '../components/Slider';
import { TextInput } from '../components/TextInput';
import { loadSettings, saveSettings } from '../GuiSave';
import { clamp, isInside } from '../Utils';
import { drawGUI } from './GuiRenderer';
import { GuiRectangles, GuiState } from './GuiState';
import { macroToggleGui } from '../MacroToggleGui';

const handleClick = (mouseX, mouseY) => {
    if (GuiState.isOpening) return;
    ({ x: mouseX, y: mouseY } = GuiState.toGuiCoordinates(mouseX, mouseY));
    if (GuiState.macroToggleOpen) return macroToggleGui.handleClick(mouseX, mouseY);
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
    if (GuiState.isOpening) return;
    ({ x: mouseX, y: mouseY } = GuiState.toGuiCoordinates(mouseX, mouseY));
    if (GuiState.macroToggleOpen) return;
    if (GuiState.dragging) {
        const newX = mouseX - GuiRectangles.Background.dx;
        const newY = mouseY - GuiRectangles.Background.dy;

        const screenWidth = GuiState.getGuiWidth();
        const screenHeight = GuiState.getGuiHeight();

        GuiRectangles.Background.x = clamp(newX, 0, screenWidth - GuiRectangles.Background.width);
        GuiRectangles.Background.y = clamp(newY, 0, screenHeight - GuiRectangles.Background.height);
        categoryManager?.invalidateLayoutCache();
    }
    categoryManager?.handleMouseDrag(mouseX, mouseY);
};

const handleScroll = (mouseX, mouseY, dir) => {
    if (GuiState.isOpening) return;
    ({ x: mouseX, y: mouseY } = GuiState.toGuiCoordinates(mouseX, mouseY));
    if (GuiState.macroToggleOpen) return macroToggleGui.handleScroll(mouseX, mouseY, dir);
    categoryManager?.handleScroll(mouseX, mouseY, dir);
};

const handleMouseRelease = () => {
    GuiState.dragging = false;
    categoryManager?.handleMouseRelease();
    GuiState.applyPendingGuiScale();
};

let renderRegistration = null;

const handleGuiClosed = () => {
    if (renderRegistration) {
        Render2D.unregisterV5Render(renderRegistration);
        renderRegistration = null;
    }
    GuiState.dragging = false;
    categoryManager?.handleMouseRelease();
    TextInput.finalizeAllTyping({ playSound: false });
    Slider.finalizeAllTyping();
    SearchBar.resetSearch();
    macroToggleGui.reset();
    saveSettings();
};

const openGui = () => {
    GuiState.isOpening = true;
    GuiState.openStartTime = Date.now();
    loadSettings();
    categoryManager?.invalidateLayoutCache();
    categoryManager?.invalidateContentHeightCache();
    GuiState.myGui.open();
};

GuiState.myGui.registerClicked((mouseX, mouseY, button) => {
    if (button === 0) handleClick(mouseX, mouseY);
});

GuiState.myGui.registerMouseDragged((mouseX, mouseY, button) => {
    if (button === 0) handleMouseDrag(mouseX, mouseY);
});

GuiState.myGui.registerMouseReleased(handleMouseRelease);
GuiState.myGui.registerClosed(handleGuiClosed);
GuiState.myGui.registerScrolled(handleScroll);

const renderGui = () => {
    const { x: mouseX, y: mouseY } = GuiState.toGuiCoordinates(Client.getMouseX(), Client.getMouseY());
    drawGUI(mouseX, mouseY);
};
GuiState.myGui.registerOpened(() => {
    if (!renderRegistration) renderRegistration = Render2D.registerV5Render(renderGui);
});

const handleKeybind = () => {
    const keyName = 'GUI';
    const existingKeybinds = getConfigFile('keybinds.json') || {};
    let savedKeycode = existingKeybinds[keyName];

    if (savedKeycode === undefined || savedKeycode === 0 || savedKeycode === -1) savedKeycode = Keyboard.KEY_NONE;

    const GUIKeyBind = new KeyBind(keyName, savedKeycode, 'v5_core');

    register('gameUnload', () => {
        const allKeybinds = getConfigFile('keybinds.json') || {};
        allKeybinds[keyName] = GUIKeyBind.getKeyCode();
        writeConfigFile('keybinds.json', allKeybinds);
    });

    GUIKeyBind.registerKeyPress(() => {
        openGui();
    });
};

v5Command('gui', openGui);

Client.getMinecraft().execute(() => {
    handleKeybind();
});
