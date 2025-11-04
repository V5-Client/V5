import { ToggleButton } from '../components/Toggle';
import { Slider } from '../components/Slider';
import { MultiToggle } from '../components/Dropdown';

export class SettingsManager {
    constructor() {
        this.settingsMap = new Map();
    }

    save(categoryManager) {
        this.buildSettingsMap(categoryManager);

        const settings = {};
        for (const [key, value] of this.settingsMap.entries()) {
            const [itemTitle, componentTitle] = key.split('.');
            if (!settings[itemTitle]) {
                settings[itemTitle] = {};
            }
            settings[itemTitle][componentTitle] = value;
        }

        FileLib.write('V5Config', 'config.json', JSON.stringify(settings, null, 2), true);
    }

    load(categoryManager) {
        const fileContent = FileLib.read('V5Config', 'config.json');
        if (!fileContent) {
            this.buildSettingsMap(categoryManager);
            this.applySettings(categoryManager);
            return;
        }

        try {
            const settings = JSON.parse(fileContent);
            if (!settings) {
                this.buildSettingsMap(categoryManager);
                this.applySettings(categoryManager);
                return;
            }

            this.loadComponentValues(categoryManager, settings);
            this.buildSettingsMap(categoryManager);
            this.applySettings(categoryManager);
        } catch (e) {
            ChatLib.chat(`§cError loading settings: ${e}`);
            this.buildSettingsMap(categoryManager);
            this.applySettings(categoryManager);
        }
    }

    getSetting(moduleName, componentTitle, optionsToCheck = null) {
        const key = `${moduleName}.${componentTitle}`;

        if (!this.settingsMap.has(key)) {
            return optionsToCheck ? [] : undefined;
        }

        const value = this.settingsMap.get(key);

        if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
            return value.filter((opt) => optionsToCheck.includes(opt.name) && opt.enabled).map((opt) => opt.name);
        }

        return value;
    }

    updateSetting(moduleName, componentTitle, value) {
        const key = `${moduleName}.${componentTitle}`;
        this.settingsMap.set(key, value);
    }

    buildSettingsMap(categoryManager) {
        this.settingsMap.clear();

        const modulesCategory = categoryManager.state.getCategory('Modules');
        if (!modulesCategory) return;

        const items = this.getModuleItems(modulesCategory);
        items.forEach((item) => {
            item.components.forEach((component) => {
                const key = `${item.title}.${component.title}`;
                if (component instanceof ToggleButton) {
                    this.settingsMap.set(key, component.enabled);
                } else if (component instanceof Slider) {
                    this.settingsMap.set(key, component.value);
                } else if (component instanceof MultiToggle) {
                    this.settingsMap.set(key, component.options);
                }
            });
        });
    }

    loadComponentValues(categoryManager, settings) {
        const modulesCategory = categoryManager.state.getCategory('Modules');
        if (!modulesCategory) return;

        const items = this.getModuleItems(modulesCategory);
        items.forEach((item) => {
            const savedItemSettings = settings[item.title];
            if (!savedItemSettings) return;

            item.components.forEach((component) => {
                const savedValue = savedItemSettings[component.title];
                if (savedValue === undefined) return;

                if (component instanceof ToggleButton) {
                    component.enabled = savedValue;
                } else if (component instanceof Slider) {
                    component.value = savedValue;
                } else if (component instanceof MultiToggle) {
                    component.options.forEach((option, index) => {
                        if (savedValue[index] && option.name === savedValue[index].name) {
                            option.enabled = savedValue[index].enabled;
                        }
                    });
                }
            });
        });
    }

    applySettings(categoryManager) {
        const modulesCategory = categoryManager.state.getCategory('Modules');
        if (!modulesCategory) return;

        const items = this.getModuleItems(modulesCategory);
        items.forEach((item) => {
            item.components.forEach((component) => {
                if (component.callback) {
                    const value = this.getSetting(item.title, component.title);
                    if (value !== undefined) {
                        component.callback(value);
                    }
                }
            });
        });
    }

    getModuleItems(category) {
        return category.items.reduce((acc, group) => {
            return acc.concat(group.type === 'separator' ? group.items : [group]);
        }, []);
    }
}
