class MacroState {
    constructor() {
        this.running = false;
        this.runningMacro = null;
        this.activeMacro = null;
        this.EXCLUDED_MODULES = ['Mob Hider', 'Xray', 'Visual', 'GIF', 'Discord RPC', 'Fast Place', 'Auto Terminals', 'Failsafes', 'AutoConversation'];
    }

    isMacroRunning() {
        return this.running;
    }

    getActiveMacro() {
        return this.activeMacro;
    }

    setMacroRunning(value, macro) {
        this.running = value;
        this.activeMacro = macro;
    }

    checkMacroState() {
        if (!global.Categories) return false;

        let modulesCategory = global.Categories.categories.find((c) => c.name === 'Modules');
        if (!modulesCategory) return false;

        for (let item of modulesCategory.items) {
            if (item.type === 'separator') {
                for (let subItem of item.items) {
                    if (this.EXCLUDED_MODULES.includes(subItem.title)) continue;

                    const enabledToggle = subItem.components?.find((c) => c.title === 'Enabled');
                    if (enabledToggle && enabledToggle.enabled) {
                        this.runningMacro = subItem.title;
                        return true;
                    }
                }
            } else {
                if (this.EXCLUDED_MODULES.includes(item.title)) continue;

                const enabledToggle = item.components?.find((c) => c.title === 'Enabled');
                if (enabledToggle && enabledToggle.enabled) {
                    this.runningMacro = item.title;
                    return true;
                }
            }
        }

        return false;
    }

    getMacroRunning() {
        return this.runningMacro;
    }
}

if (!global.macrostate) {
    global.macrostate = new MacroState();
}
