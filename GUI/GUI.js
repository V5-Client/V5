import './core/GuiState';
import './core/GuiTooltip';
import './categories/CategorySystem';

import './GuiSave';
import './categories/CategoryManager';
import './NotificationManager';

import './core/GuiRenderer';
import './core/GuiEvents';

import {
    saveSettings as _saveSettings,
    loadSettings as _loadSettings,
    getSetting as _getSetting,
    updateSettingMap as _updateSettingMap,
    applySettings as _applySettings,
} from './GuiSave';

import { NVG } from './Utils';

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
        console.error(e);
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
    global.notificationManager.add(title, description, type, duration);
};

export const addCategoryItem = (subcategoryName, title, description, tooltip = null) => {
    global.Categories.addCategoryItem(subcategoryName, title, description, tooltip);
};

export const findItem = (categoryName, itemName) => {
    return global.Categories.findItem(categoryName, itemName);
};

export const addToggle = (categoryName, itemName, toggleTitle, callback = null, description = null) => {
    global.Categories.addToggle(categoryName, itemName, toggleTitle, callback, description);
};

export const addSlider = (categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) => {
    global.Categories.addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback, description);
};

export const addMultiToggle = (categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null) => {
    global.Categories.addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect, callback, description);
};

export const openGui = () => {
    const { loadSettings } = require('./GuiSave');
    global.GuiState.isOpening = true;
    global.GuiState.openStartTime = Date.now();
    loadSettings();
    global.categoryManager?.invalidateLayoutCache();
    global.GuiState.myGui.open();
};

export const closeGui = () => {
    global.GuiState.myGui.close();
};
