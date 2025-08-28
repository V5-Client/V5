import { ToggleButton } from "./Toggle";
import { Slider } from "./Slider";
import { MultiToggle } from "./Dropdown";

const File = java.io.File;

export const saveSettings = () => {
  const settings = {};
  global.Categories.categories.forEach((category) => {
    if (category.name === "Modules") {
      category.items.forEach((group) => {
        const itemsToSave = group.type === "separator" ? group.items : [group];
        itemsToSave.forEach((item) => {
          settings[item.title] = {};
          item.components.forEach((component) => {
            if (component instanceof ToggleButton) {
              settings[item.title][component.title] = component.enabled;
            } else if (component instanceof Slider) {
              settings[item.title][component.title] = component.value;
            } else if (component instanceof MultiToggle) {
              settings[item.title][component.title] = component.options;
            }
          });
        });
      });
    }
  });
  FileLib.write(
    "V5Config",
    "config.json",
    JSON.stringify(settings, null, 2),
    true
  );
};

export const loadSettings = () => {
  const settingsFile = new File(
    "config/ChatTriggers/modules/V5Config/config.json"
  );
  if (!settingsFile.exists()) return;

  try {
    const fileContent = FileLib.read("V5Config", "config.json");
    if (!fileContent) return;

    const settings = JSON.parse(fileContent);
    if (!settings) return;

    global.Settings = settings;

    global.Categories.categories.forEach((category) => {
      if (category.name === "Modules") {
        category.items.forEach((group) => {
          const itemsToLoad =
            group.type === "separator" ? group.items : [group];
          itemsToLoad.forEach((item) => {
            const savedItemSettings = settings[item.title];
            if (savedItemSettings) {
              item.components.forEach((component) => {
                const savedValue = savedItemSettings[component.title];
                if (typeof savedValue !== "undefined") {
                  if (component instanceof ToggleButton) {
                    component.enabled = savedValue;
                  } else if (component instanceof Slider) {
                    component.value = savedValue;
                  } else if (component instanceof MultiToggle) {
                    component.options.forEach((option, index) => {
                      if (
                        savedValue[index] &&
                        option.name === savedValue[index].name
                      ) {
                        option.enabled = savedValue[index].enabled;
                      }
                    });
                  }
                }
              });
            }
          });
        });
      }
    });
  } catch (e) {
    ChatLib.chat(`Error loading settings: ${e}`);
  }
};

export const getSetting = (
  moduleName,
  componentTitle,
  optionsToCheck = null
) => {
  if (global.Settings && global.Settings[moduleName]) {
    const value = global.Settings[moduleName][componentTitle];
    if (typeof value !== "undefined") {
      if (Array.isArray(value) && Array.isArray(optionsToCheck)) {
        const allEnabled = optionsToCheck.every((optionName) =>
          value.some(
            (componentOption) =>
              componentOption.name === optionName && componentOption.enabled
          )
        );
        return allEnabled;
      }
      return value;
    }
  }

  const category = global.Categories.categories.find(
    (cat) => cat.name === "Modules"
  );
  if (category) {
    for (const group of category.items) {
      const itemsToCheck = group.type === "separator" ? group.items : [group];
      for (const item of itemsToCheck) {
        if (item.title === moduleName) {
          for (const component of item.components) {
            if (component.title === componentTitle) {
              if (component.enabled !== undefined) {
                return component.enabled;
              }
              if (component.value !== undefined) {
                return component.value;
              }
              if (component.options !== undefined) {
                if (Array.isArray(optionsToCheck)) {
                  const allEnabled = optionsToCheck.every((optionName) =>
                    component.options.some(
                      (componentOption) =>
                        componentOption.name === optionName &&
                        componentOption.enabled
                    )
                  );
                  return allEnabled;
                }
                return component.options;
              }
            }
          }
        }
      }
    }
  }
  return null;
};
