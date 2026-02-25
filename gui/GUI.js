import { categoryManager } from './categories/CategoryManager';
import { Categories } from './categories/CategorySystem';
import './core/GuiEvents';
import { GuiState } from './core/GuiState';
import { showNotification as notify } from './NotificationManager';
import './ProfileSettings';
import './ThemeSettings';

import {
    applySettings as _applySettings,
    getSetting as _getSetting,
    loadSettings as _loadSettings,
    saveSettings as _saveSettings,
    updateSettingMap as _updateSettingMap,
} from './GuiSave';

import { NVG } from '../utils/Constants';

const warmupTrigger = register('renderOverlay', () => {
    try {
        const width = Renderer.screen.getWidth();
        const height = Renderer.screen.getHeight();
        if (width > 0 && height > 0) {
            NVG.beginFrame(width, height);
            NVG.endFrame();
        }
        warmupTrigger.unregister();
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
        warmupTrigger.unregister();
    }
});

export const saveSettings = _saveSettings;
export const loadSettings = _loadSettings;
export const getSetting = _getSetting;
export const updateSettingMap = _updateSettingMap;
export const applySettings = _applySettings;
// THIS ISN'T NEEDED PROBABLY, BUT IT WORKS SO WHATEVER LMFAO

export const showNotification = (title, description, type = 'SUCCESS', duration = 5000) => {
    notify(title, description, type, duration);
};

export const addCategoryItem = (subcategoryName, title, description, tooltip = null) => {
    Categories.addCategoryItem(subcategoryName, title, description, tooltip);
};

export const findItem = (categoryName, itemName) => {
    return Categories.findItem(categoryName, itemName);
};

export const addToggle = (categoryName, itemName, toggleTitle, callback = null, description = null) => {
    Categories.addToggle(categoryName, itemName, toggleTitle, callback, description);
};

export const addSlider = (categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) => {
    Categories.addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback, description);
};

export const addMultiToggle = (categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null) => {
    Categories.addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect, callback, description);
};

export const addTextInput = (categoryName, itemName, title, defaultValue, callback = null, description = null) => {
    Categories.addTextInput(categoryName, itemName, title, defaultValue, callback, description);
};

export const addButton = (categoryName, itemName, title, callback = null, description = null) => {
    Categories.addButton(categoryName, itemName, title, callback, description);
};

export const addPopup = (categoryName, itemName, title, callback = null, description = null) => {
    Categories.addPopup(categoryName, itemName, title, callback, description);
};

export const openGui = () => {
    const { loadSettings } = require('./GuiSave');
    GuiState.isOpening = true;
    GuiState.openStartTime = Date.now();
    loadSettings();
    categoryManager?.invalidateLayoutCache();
    categoryManager?.invalidateContentHeightCache();
    GuiState.myGui.open();
};

export const closeGui = () => {
    GuiState.myGui.close();
};
