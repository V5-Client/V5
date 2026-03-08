class MacroStateClass {
    constructor() {
        this.running = false;
        this.activeMacro = null;
        this.startTime = 0;
        this.enabledMacros = new Set();

        this.modules = new Map();
        this.lastDisableMeta = new Map();
        this.lastActiveMacro = null;
    }

    getLastActiveMacro() {
        return this.lastActiveMacro;
    }

    registerModule(module) {
        if (module.name) {
            this.modules.set(module.name, module);
        }
    }

    getModule(name) {
        return this.modules.get(name);
    }

    getMacroNames() {
        const names = [];
        this.modules.forEach((module, name) => {
            if (module.isMacro) names.push(name);
        });
        return names;
    }

    isMacroRunning() {
        return this.running;
    }

    getActiveMacro() {
        return this.activeMacro;
    }

    getStartTime() {
        return this.startTime;
    }

    getEnabledMacros() {
        return Array.from(this.enabledMacros);
    }

    onModuleEnabled(moduleName) {
        if (!moduleName) return;
        const module = this.getModule(moduleName);
        if (!module || !module.isMacro) return;

        const wasEmpty = this.enabledMacros.size === 0;
        this.enabledMacros.add(moduleName);

        if (wasEmpty) {
            this.startTime = Date.now();
        }

        this.running = true;
        this.activeMacro = moduleName;
        this.lastActiveMacro = moduleName;
    }

    onModuleDisabled(moduleName, context = 'user') {
        if (!moduleName) return;
        if (!this.enabledMacros.has(moduleName)) return;

        this.lastDisableMeta.set(moduleName, this.captureDisableMeta(moduleName, context));
        this.enabledMacros.delete(moduleName);

        if (this.enabledMacros.size === 0) {
            this.running = false;
            this.activeMacro = null;
            this.startTime = 0;
        } else {
            const remaining = Array.from(this.enabledMacros);
            this.activeMacro = remaining[remaining.length - 1];
        }
    }

    getLastDisableMeta(moduleName) {
        if (!moduleName) return null;
        return this.lastDisableMeta.get(moduleName) || null;
    }

    captureDisableMeta(moduleName, context = 'user') {
        return {
            context: context || 'user',
            timestamp: Date.now(),
        };
    }

    // unused, just use 'isMacro: true' in module constructor instead.
    setMacroRunning(value, macro) {
        if (value) {
            this.onModuleEnabled(macro);
        } else if (macro) {
            this.onModuleDisabled(macro);
        }
    }
}

export const MacroState = new MacroStateClass();
