import { Chat } from './Chat';
import { KeyBindUtils } from './Constants';
import { Utils } from './Utils';

class MacroStateClass {
    constructor() {
        this.running = false;
        this.activeMacro = null;
        this.startTime = 0;
        this.enabledMacros = new Set();

        this.modules = new Map();
        this.lastDisableMeta = new Map();
        this.lastActiveMacro = null;

        this.lastMacroToggleKey = null;
        this.hasBoundLastMacroToggleKey = false;
        this.lastMacroToggleTitle = 'Global Toggle Last Used Macro';
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

    isFailsafeMacroRunning() {
        for (const macroName of this.enabledMacros) {
            const module = this.getModule(macroName);
            if (!module?.isMacro) continue;
            if (module.ignoreFailsafes === true) continue;
            return true;
        }
        return false;
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

    setupLastMacroToggleKey() {
        if (this.hasBoundLastMacroToggleKey) return;
        this.hasBoundLastMacroToggleKey = true;

        const existingKeybinds = Utils.getConfigFile('keybinds.json') || {};
        const savedKeycode = existingKeybinds[this.lastMacroToggleTitle] || Keyboard.KEY_NONE;
        this.lastMacroToggleKey = KeyBindUtils.create('toggle_last_macro', this.lastMacroToggleTitle, savedKeycode);

        this.lastMacroToggleKey.onKeyPress(() => {
            this.toggleLastUsedMacroFromUser();
        });

        register('gameUnload', () => {
            const keycode = this.lastMacroToggleKey?.keyBinding?.boundKey?.code;
            if (typeof keycode !== 'number') return;

            const allKeybinds = Utils.getConfigFile('keybinds.json') || {};
            allKeybinds[this.lastMacroToggleTitle] = keycode;
            Utils.writeConfigFile('keybinds.json', allKeybinds);
        });
    }

    toggleLastUsedMacroFromUser() {
        const macroName = this.getLastActiveMacro();
        if (!macroName) {
            Chat.message('&eNo recently used macro to toggle.');
            return false;
        }

        const macroModule = this.getModule(macroName);
        if (!macroModule || !macroModule.isMacro || typeof macroModule.requestToggleFromUser !== 'function') {
            Chat.message(`&cUnable to toggle last macro: ${macroName}.`);
            return false;
        }

        macroModule.requestToggleFromUser();
        return true;
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
