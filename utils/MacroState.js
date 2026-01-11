class MacroStateClass {
    constructor() {
        this.running = false;
        this.activeMacro = null;
        this.startTime = 0;
        this.enabledMacros = new Set();
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
        const wasEmpty = this.enabledMacros.size === 0;
        this.enabledMacros.add(moduleName);

        if (wasEmpty) {
            this.startTime = Date.now();
        }

        this.running = true;
        this.activeMacro = moduleName;
    }

    onModuleDisabled(moduleName) {
        this.enabledMacros.delete(moduleName);

        if (this.enabledMacros.size === 0) {
            this.running = false;
            this.activeMacro = null;
        } else {
            const remaining = Array.from(this.enabledMacros);
            this.activeMacro = remaining[remaining.length - 1];
        }
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
