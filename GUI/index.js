import { CategoryManager } from './managers/CategoryManager';
import { NotificationManager } from './managers/NotificationManager';
import { SettingsManager } from './state/SettingsState';
import { GuiState } from './state/GuiState';
import { GuiRenderer } from './renderers/GuiRenderer';
import { GuiEventHandler } from './events/EventHandler';
import { returnDiscord } from './utils/network';
import './managers/TooltipManager';

const guiState = new GuiState();
const categoryManager = new CategoryManager();
const settingsManager = new SettingsManager();
const notificationManager = new NotificationManager();

const guiRenderer = new GuiRenderer(guiState, categoryManager);
const eventHandler = new GuiEventHandler(guiState, categoryManager, settingsManager);

// register events!
guiState.gui.registerClicked((mouseX, mouseY, button) => {
    if (button === 0) eventHandler.handleClick(mouseX, mouseY);
});

guiState.gui.registerMouseDragged((mouseX, mouseY, button) => {
    if (button === 0) eventHandler.handleMouseDrag(mouseX, mouseY);
});

guiState.gui.registerMouseReleased(() => eventHandler.handleMouseRelease());
guiState.gui.registerClosed(() => eventHandler.handleGuiClosed());
guiState.gui.registerDraw((mouseX, mouseY) => guiRenderer.draw(mouseX, mouseY));
guiState.gui.registerScrolled((mx, my, dir) => eventHandler.handleScroll(mx, my, dir));

export const showNotification = (title, description, type = 'SUCCESS', duration = 5000) => {
    notificationManager.add(title, description, type, duration);
};

export const addCategoryItem = (subcategoryName, title, description, tooltip = null) => {
    categoryManager.addItem(subcategoryName, title, description, tooltip);
};

export const addToggle = (categoryName, itemName, toggleTitle, callback = null, description = null) => {
    categoryManager.addToggle(categoryName, itemName, toggleTitle, callback, description);
};

export const addSlider = (categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) => {
    categoryManager.addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback, description);
};

export const addMultiToggle = (categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null) => {
    categoryManager.addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect, callback, description);
};

export const saveSettings = () => settingsManager.save(categoryManager);
export const loadSettings = () => settingsManager.load(categoryManager);
export const getSetting = (moduleName, componentTitle, optionsToCheck = null) => settingsManager.getSetting(moduleName, componentTitle, optionsToCheck);
export const updateSettingMap = (moduleName, componentTitle, value) => settingsManager.updateSetting(moduleName, componentTitle, value);

export const openGui = () => {
    guiState.isOpening = true;
    guiState.openStartTime = Date.now();
    loadSettings();
    categoryManager.invalidateLayout();
    guiState.open();
};

export const closeGui = () => guiState.close();
export { returnDiscord } from './utils/network';

// Backward compatibility stuff or smth
global.showNotification = showNotification;
global.categoryManager = categoryManager;

// backward compatibility (cope)
global.Categories = {
    addCategoryItem: (subcategoryName, title, description, tooltip = null) => {
        categoryManager.addItem(subcategoryName, title, description, tooltip);
    },
    addToggle: (categoryName, itemName, toggleTitle, callback = null, description = null) => {
        categoryManager.addToggle(categoryName, itemName, toggleTitle, callback, description);
    },
    addSlider: (categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) => {
        categoryManager.addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback, description);
    },
    addMultiToggle: (categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null) => {
        categoryManager.addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect, callback, description);
    },
    findItem: (categoryName, itemName) => {
        return categoryManager.findItem(categoryName, itemName);
    },
    get categories() {
        return categoryManager.state.categories;
    },
    get selected() {
        return categoryManager.state.selected;
    },
    get selectedItem() {
        return categoryManager.state.selectedItem;
    },
    get currentPage() {
        return categoryManager.state.currentPage;
    },
};
