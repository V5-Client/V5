import { ToggleButton } from './Toggle';
import { Slider } from './Slider';
import { MultiToggle } from './Dropdown';
import { File } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';

global.SettingsMap = new Map();

const getModuleItems = (category) =>
    category.items.reduce(
        (acc, group) =>
            acc.concat(group.type === 'separator' ? group.items : [group]),
        []
    );

function buildSettingsMapFromComponents() {
    global.SettingsMap.clear();
    global.Categories.categories
        .filter((c) => c.name === 'Modules')
        .forEach((category) => {
            getModuleItems(category).forEach((item) => {
                item.components.forEach((component) => {
                    const key = `${item.title}.${component.title}`;
                    if (component instanceof ToggleButton)
                        global.SettingsMap.set(key, component.enabled);
                    else if (component instanceof Slider)
                        global.SettingsMap.set(key, component.value);
                    else if (component instanceof MultiToggle)
                        global.SettingsMap.set(key, component.options);
                });
            });
        });
}

export const saveSettings = () => {
    // Update the map first
    buildSettingsMapFromComponents();

    // Build the file content FROM the map.
    const settings = {};
    for (const [key, value] of global.SettingsMap.entries()) {
        const [itemTitle, componentTitle] = key.split('.');
        if (!settings[itemTitle]) {
            settings[itemTitle] = {};
        }
        settings[itemTitle][componentTitle] = value;
    }

    FileLib.write(
        'V5Config',
        'config.json',
        JSON.stringify(settings, null, 2),
        true
    );
};

export const loadSettings = () => {
    const fileContent = FileLib.read('V5Config', 'config.json');
    if (!fileContent) {
        buildSettingsMapFromComponents();
        if (global.Categories?.applySettings) global.Categories.applySettings();
        return;
    }

    try {
        const settings = JSON.parse(fileContent);
        if (!settings) {
            buildSettingsMapFromComponents();
            if (global.Categories?.applySettings)
                global.Categories.applySettings();
            return;
        }

        global.Categories.categories
            .filter((c) => c.name === 'Modules')
            .forEach((category) => {
                getModuleItems(category).forEach((item) => {
                    const savedItemSettings = settings[item.title];
                    if (!savedItemSettings) return;
                    item.components.forEach((component) => {
                        const savedValue = savedItemSettings[component.title];
                        if (savedValue === undefined) return;
                        if (component instanceof ToggleButton)
                            component.enabled = savedValue;
                        else if (component instanceof Slider)
                            component.value = savedValue;
                        else if (component instanceof MultiToggle) {
                            component.options.forEach((option, index) => {
                                if (
                                    savedValue[index] &&
                                    option.name === savedValue[index].name
                                )
                                    option.enabled = savedValue[index].enabled;
                            });
                        }
                    });
                });
            });

        buildSettingsMapFromComponents();
        if (global.Categories?.applySettings) global.Categories.applySettings();
    } catch (e) {
        Chat.Message(`Error loading settings: ${e}`);
        buildSettingsMapFromComponents();
        if (global.Categories?.applySettings) global.Categories.applySettings();
    }
};

export const getSetting = (
    moduleName,
    componentTitle,
    optionsToCheck = null
) => {
    const key = `${moduleName}.${componentTitle}`;

    if (!global.SettingsMap.has(key)) {
        return optionsToCheck ? [] : undefined;
    }

    const value = global.SettingsMap.get(key);

    if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
        return value
            .filter((opt) => optionsToCheck.includes(opt.name) && opt.enabled)
            .map((opt) => opt.name);
    }

    return value;
};

export const updateSettingMap = (moduleName, componentTitle, value) => {
    const key = `${moduleName}.${componentTitle}`;
    global.SettingsMap.set(key, value);
};
