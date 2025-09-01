import { ToggleButton } from './Toggle';
import { Slider } from './Slider';
import { MultiToggle } from './Dropdown';
import { File } from '../Utility/Constants';

global.SettingsMap = new Map();
global.ComponentsMap = new Map();

const buildSettingsMaps = () => {
    global.SettingsMap.clear();
    global.ComponentsMap.clear();

    global.Categories.categories.forEach((category) => {
        if (category.name === 'Modules') {
            category.items.forEach((group) => {
                const itemsToProcess =
                    group.type === 'separator' ? group.items : [group];

                itemsToProcess.forEach((item) => {
                    item.components.forEach((component) => {
                        const key = `${item.title}.${component.title}`;

                        global.ComponentsMap.set(key, component);

                        if (component instanceof ToggleButton) {
                            global.SettingsMap.set(key, component.enabled);
                        } else if (component instanceof Slider) {
                            global.SettingsMap.set(key, component.value);
                        } else if (component instanceof MultiToggle) {
                            global.SettingsMap.set(key, component.options);
                        }
                    });
                });
            });
        }
    });
};

export const saveSettings = () => {
    const settings = {};

    global.Categories.categories.forEach((category) => {
        if (category.name === 'Modules') {
            category.items.forEach((group) => {
                const itemsToSave =
                    group.type === 'separator' ? group.items : [group];

                itemsToSave.forEach((item) => {
                    settings[item.title] = {};
                    item.components.forEach((component) => {
                        if (component instanceof ToggleButton) {
                            settings[item.title][component.title] =
                                component.enabled;
                        } else if (component instanceof Slider) {
                            settings[item.title][component.title] =
                                component.value;
                        } else if (component instanceof MultiToggle) {
                            settings[item.title][component.title] =
                                component.options;
                        }
                    });
                });
            });
        }
    });

    global.Settings = settings;

    buildSettingsMaps();

    FileLib.write(
        'V5Config',
        'config.json',
        JSON.stringify(settings, null, 2),
        true
    );
};

export const loadSettings = () => {
    const settingsFile = new File(
        'config/ChatTriggers/modules/V5Config/config.json'
    );
    if (!settingsFile.exists()) {
        // Build maps even if no settings file exists
        buildSettingsMaps();
        return;
    }

    try {
        const fileContent = FileLib.read('V5Config', 'config.json');
        if (!fileContent) {
            buildSettingsMaps();
            return;
        }

        const settings = JSON.parse(fileContent);
        if (!settings) {
            buildSettingsMaps();
            return;
        }

        global.Settings = settings;

        global.Categories.categories.forEach((category) => {
            if (category.name === 'Modules') {
                category.items.forEach((group) => {
                    const itemsToLoad =
                        group.type === 'separator' ? group.items : [group];

                    itemsToLoad.forEach((item) => {
                        const savedItemSettings = settings[item.title];
                        if (savedItemSettings) {
                            item.components.forEach((component) => {
                                const savedValue =
                                    savedItemSettings[component.title];
                                if (typeof savedValue !== 'undefined') {
                                    if (component instanceof ToggleButton) {
                                        component.enabled = savedValue;
                                    } else if (component instanceof Slider) {
                                        component.value = savedValue;
                                    } else if (
                                        component instanceof MultiToggle
                                    ) {
                                        component.options.forEach(
                                            (option, index) => {
                                                if (
                                                    savedValue[index] &&
                                                    option.name ===
                                                        savedValue[index].name
                                                ) {
                                                    option.enabled =
                                                        savedValue[
                                                            index
                                                        ].enabled;
                                                }
                                            }
                                        );
                                    }
                                }
                            });
                        }
                    });
                });
            }
        });

        buildSettingsMaps();
    } catch (e) {
        ChatLib.chat(`Error loading settings: ${e}`);
        buildSettingsMaps();
    }
};

/**
 * Get a setting value with O(1) lookup time
 * @param {string} moduleName - The module name
 * @param {string} componentTitle - The component title
 * @param {Array|null} optionsToCheck - Options to filter for MultiToggle components
 * @returns {*} The setting value or empty array if not found
 */
export const getSetting = (
    moduleName,
    componentTitle,
    optionsToCheck = null
) => {
    const key = `${moduleName}.${componentTitle}`;

    if (global.SettingsMap.has(key)) {
        const value = global.SettingsMap.get(key);

        if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
            return value
                .filter(
                    (componentOption) =>
                        optionsToCheck.includes(componentOption.name) &&
                        componentOption.enabled
                )
                .map((componentOption) => componentOption.name);
        }

        return value;
    }

    if (global.Settings && global.Settings[moduleName]) {
        const value = global.Settings[moduleName][componentTitle];
        if (typeof value !== 'undefined') {
            if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
                return value
                    .filter(
                        (componentOption) =>
                            optionsToCheck.includes(componentOption.name) &&
                            componentOption.enabled
                    )
                    .map((componentOption) => componentOption.name);
            }
            return value;
        }
    }

    if (global.SettingsMap.size === 0) {
        buildSettingsMaps();
        if (global.SettingsMap.has(key)) {
            const value = global.SettingsMap.get(key);

            if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
                return value
                    .filter(
                        (componentOption) =>
                            optionsToCheck.includes(componentOption.name) &&
                            componentOption.enabled
                    )
                    .map((componentOption) => componentOption.name);
            }

            return value;
        }
    }

    return [];
};

/**
 * Update a specific setting in the maps (useful for real-time updates)
 * @param {string} moduleName - The module name
 * @param {string} componentTitle - The component title
 * @param {*} value - The new value
 */
export const updateSettingMap = (moduleName, componentTitle, value) => {
    const key = `${moduleName}.${componentTitle}`;
    global.SettingsMap.set(key, value);

    if (global.Settings) {
        if (!global.Settings[moduleName]) {
            global.Settings[moduleName] = {};
        }
        global.Settings[moduleName][componentTitle] = value;
    }
};
