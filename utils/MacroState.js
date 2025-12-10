import { Chat } from "./Chat";

class MacroState {
    constructor() {
        this.running = false;
        this.runningMacro = null;
        this.EXCLUDED_MODULES = [
            "Mob Hider",
            "Xray",
            "Visual",
            "GIF",
            "Discord RPC",
            "Fast Place",
            "Auto Terminals",
            "Failsafes"
        ];
    }

    isMacroRunning() {
        return this.running;
    }

    setMacroRunning(value) {
        Chat.debugMessage("Setting macro state to: " + value);
        this.running = value;
    }

    checkMacroState() {
        if (!global.Categories) return false;

        let modulesCategory = global.Categories.categories.find(c => c.name === "Modules");
        if (!modulesCategory) return false;

        for (let item of modulesCategory.items) {
            if (item.type === "separator") {
                for (let subItem of item.items) {
                    if (this.EXCLUDED_MODULES.includes(subItem.title)) continue;
                    
                    const enabledToggle = subItem.components?.find(c => c.title === "Enabled");
                    if (enabledToggle && enabledToggle.enabled) {
                        this.runningMacro = subItem.title;
                        return true;
                    }
                }
            } else {
                if (this.EXCLUDED_MODULES.includes(item.title)) continue;
                
                const enabledToggle = item.components?.find(c => c.title === "Enabled");
                if (enabledToggle && enabledToggle.enabled) {
                    this.runningMacro = item.title;
                    return true;
                }
            }
        }

        return false;
    }
}

if (!global.MacroState) {
    global.MacroState = new MacroState();
}

export default global.MacroState;