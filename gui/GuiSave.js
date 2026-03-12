import { Chat } from '../utils/Chat';
import { Color } from '../utils/Constants';
import { MacroState } from '../utils/MacroState';
import { Utils } from '../utils/Utils';
import { Categories } from './categories/CategorySystem';
import { Button } from './components/Button';
import { ColorPicker } from './components/ColorPicker';
import { MultiToggle } from './components/Dropdown';
import { Popup } from './components/Popup';
import { Slider } from './components/Slider';
import { TextInput } from './components/TextInput';
import { ToggleButton } from './components/Toggle';

export const SettingsMap = new Map();

const getCategoryItems = (category) => category.items.reduce((acc, group) => acc.concat(group.type === 'separator' ? group.items : [group]), []);

const getDirectComponentParentName = (category, component) => {
    if (category.name === 'Settings' && component.sectionName) {
        return component.sectionName;
    }
    return category.name;
};

function buildSettingsMapFromComponents() {
    SettingsMap.clear();

    Categories.categories.forEach((category) => {
        getCategoryItems(category).forEach((item) => {
            item.components.forEach((component) => {
                const key = `${item.title}.${component.title}`;
                storeComponentValue(key, component);
            });

            if (category.name === 'Modules') {
                storeModuleEnabledValue(item.title);
            }
        });

        // SETTINGS PAGE
        if (category.directComponents) {
            category.directComponents.forEach((component) => {
                const parentName = getDirectComponentParentName(category, component);
                const key = `${parentName}.${component.title}`;
                storeComponentValue(key, component);
            });
        }
    });
}

function storeModuleEnabledValue(moduleName) {
    const module = MacroState.getModule(moduleName);
    if (!module || module.showEnabledToggle === false) return;
    SettingsMap.set(`${moduleName}.Enabled`, !!module.enabled);
}

function storeComponentValue(key, component) {
    if (component instanceof Button || component instanceof Popup) return;
    if (component instanceof ToggleButton) {
        SettingsMap.set(key, component.enabled);
    } else if (component instanceof Slider) {
        SettingsMap.set(key, component.value);
    } else if (component instanceof MultiToggle) {
        SettingsMap.set(key, component.options);
    } else if (component instanceof ColorPicker) {
        SettingsMap.set(key, component.color.getRGB());
    } else if (component instanceof TextInput) {
        SettingsMap.set(key, component.value);
    }
}

export const saveSettings = () => {
    buildSettingsMapFromComponents();

    const settings = {};
    for (const [key, value] of SettingsMap.entries()) {
        const [itemTitle, componentTitle] = key.split('.');
        if (!settings[itemTitle]) {
            settings[itemTitle] = {};
        }
        settings[itemTitle][componentTitle] = value;
    }

    Utils.writeConfigFile('config.json', settings);
};

export const applySettings = () => {
    Categories.categories.forEach((category) => {
        getCategoryItems(category).forEach((item) => {
            if (category.name === 'Modules') {
                const enabled = getSetting(item.title, 'Enabled');
                applyModuleEnabled(item.title, enabled);
            }

            item.components.forEach((component) => {
                triggerComponentCallback(item.title, component);
            });
        });

        if (category.directComponents) {
            category.directComponents.forEach((component) => {
                const parentName = getDirectComponentParentName(category, component);
                triggerComponentCallback(parentName, component);
            });
        }
    });
};

function applyModuleEnabled(moduleName, savedValue) {
    if (savedValue === undefined) return;

    const module = MacroState.getModule(moduleName);
    if (!module || module.showEnabledToggle === false) return;

    module.toggle(!!savedValue);
}

function triggerComponentCallback(parentName, component) {
    if (!component.callback) return;

    const value = getSetting(parentName, component.title);
    if (value === undefined) return;

    if (component instanceof ColorPicker) {
        component.callback(new Color(value, true));
    } else {
        component.callback(value);
    }
}

export const loadSettings = () => {
    const settings = Utils.getConfigFile('config.json');

    if (!settings || Object.keys(settings).length === 0) {
        buildSettingsMapFromComponents();
        return;
    }

    try {
        Categories.categories.forEach((category) => {
            getCategoryItems(category).forEach((item) => {
                const savedItemSettings = settings[item.title];
                if (savedItemSettings) {
                    item.components.forEach((component) => {
                        loadComponentValue(component, savedItemSettings[component.title]);
                    });
                }
            });

            if (category.directComponents) {
                category.directComponents.forEach((component) => {
                    const parentName = getDirectComponentParentName(category, component);
                    const savedCategorySettings = settings[parentName];
                    if (savedCategorySettings) {
                        loadComponentValue(component, savedCategorySettings[component.title]);
                    }
                });
            }
        });

        buildSettingsMapFromComponents();
        mergeSavedModuleEnabledStates(settings);
        applySettings();
    } catch (e) {
        Chat.message(`Error loading settings: ${e}`);
        console.error('V5 Caught error' + e + e.stack);
        buildSettingsMapFromComponents();
    }
};

function mergeSavedModuleEnabledStates(settings) {
    const modulesCategory = Categories.categories.find((category) => category.name === 'Modules');
    if (!modulesCategory || !settings) return;

    getCategoryItems(modulesCategory).forEach((item) => {
        const savedEnabled = settings[item.title]?.Enabled;
        if (savedEnabled === undefined) return;
        SettingsMap.set(`${item.title}.Enabled`, !!savedEnabled);
    });
}

function loadComponentValue(component, savedValue) {
    if (savedValue === undefined) return;
    if (component instanceof Button || component instanceof Popup) return;

    if (component instanceof ToggleButton) {
        component.enabled = savedValue;
    } else if (component instanceof Slider) {
        component.value = savedValue;
    } else if (component instanceof MultiToggle) {
        if (Array.isArray(savedValue)) {
            component.options.forEach((option) => {
                const savedOption = savedValue.find((o) => o.name === option.name);
                if (savedOption) {
                    option.enabled = savedOption.enabled;
                    option.animationProgress = savedOption.enabled ? 1 : 0;
                    option.animationStart = 0;
                }
            });
        }
    } else if (component instanceof ColorPicker) {
        component.color = new Color(savedValue, true);

        const r = component.color.getRed();
        const g = component.color.getGreen();
        const b = component.color.getBlue();
        const a = component.color.getAlpha();
        const hsv = java.awt.Color.RGBtoHSB(r, g, b, null);

        component.hue = hsv[0];
        component.sat = hsv[1];
        component.val = hsv[2];
        component.alpha = a / 255;
    } else if (component instanceof TextInput) {
        component.value = savedValue;
        component.text = String(savedValue);
        component.cursorIndex = component.text.length;
    }
}

export const getSetting = (moduleName, componentTitle, optionsToCheck = null) => {
    const key = `${moduleName}.${componentTitle}`;

    if (!SettingsMap.has(key)) {
        return optionsToCheck ? [] : undefined;
    }

    const value = SettingsMap.get(key);

    if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
        return value.filter((opt) => optionsToCheck.includes(opt.name) && opt.enabled).map((opt) => opt.name);
    }

    return value;
};

export const updateSettingMap = (moduleName, componentTitle, value) => {
    const key = `${moduleName}.${componentTitle}`;
    SettingsMap.set(key, value);
};
