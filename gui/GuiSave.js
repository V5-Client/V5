import { ToggleButton } from './components/Toggle';
import { Slider } from './components/Slider';
import { MultiToggle } from './components/Dropdown';
import { Chat } from '../utils/Chat';
import { Utils } from '../utils/Utils';
import { Categories } from './categories/CategorySystem';

export const SettingsMap = new Map();

const getModuleItems = (category) => category.items.reduce((acc, group) => acc.concat(group.type === 'separator' ? group.items : [group]), []);

function buildSettingsMapFromComponents() {
    SettingsMap.clear();
    Categories.categories
        .filter((c) => c.name === 'Modules')
        .forEach((category) => {
            getModuleItems(category).forEach((item) => {
                item.components.forEach((component) => {
                    const key = `${item.title}.${component.title}`;
                    if (component instanceof ToggleButton) SettingsMap.set(key, component.enabled);
                    else if (component instanceof Slider) SettingsMap.set(key, component.value);
                    else if (component instanceof MultiToggle) SettingsMap.set(key, component.options);
                });
            });
        });
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
    Categories.categories
        .filter((c) => c.name === 'Modules')
        .forEach((category) => {
            getModuleItems(category).forEach((item) => {
                item.components.forEach((component) => {
                    if (component.callback) {
                        const value = getSetting(item.title, component.title);
                        if (value !== undefined) {
                            component.callback(value);
                        }
                    }
                });
            });
        });
};

export const loadSettings = () => {
    const settings = Utils.getConfigFile('config.json');

    if (!settings || Object.keys(settings).length === 0) {
        buildSettingsMapFromComponents();
        applySettings();
        return;
    }

    try {
        if (!settings) {
            buildSettingsMapFromComponents();
            applySettings();
            return;
        }

        Categories.categories
            .filter((c) => c.name === 'Modules')
            .forEach((category) => {
                getModuleItems(category).forEach((item) => {
                    const savedItemSettings = settings[item.title];
                    if (!savedItemSettings) return;
                    item.components.forEach((component) => {
                        const savedValue = savedItemSettings[component.title];
                        if (savedValue === undefined) return;
                        if (component instanceof ToggleButton) component.enabled = savedValue;
                        else if (component instanceof Slider) component.value = savedValue;
                        else if (component instanceof MultiToggle) {
                            component.options.forEach((option, index) => {
                                if (savedValue[index] && option.name === savedValue[index].name) option.enabled = savedValue[index].enabled;
                            });
                        }
                    });
                });
            });

        buildSettingsMapFromComponents();
        applySettings();
    } catch (e) {
        Chat.message(`Error loading settings: ${e}`);
        buildSettingsMapFromComponents();
        applySettings();
    }
};

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
