import { Utils } from './Utils';
import { KeyBindUtils } from './Constants';
import { OverlayManager } from '../gui/OverlayUtils';
import { Categories } from '../gui/categories/CategorySystem';
import { MacroState } from './MacroState';

export class ModuleBase {
    /**
     * Create a new module
     * @param {string|object} nameOrOpts - Module name or options object
     * @param {string} [subcategory] - Subcategory name (required if nameOrOpts is string)
     * @param {string} [description=''] - Module description (required if nameOrOpts is string)
     * @param {string} [tooltip=null] - Tooltip text (required if nameOrOpts is string)
     * @param {object} [opts] - Options object with properties: name, subcategory, description, tooltip, showEnabledToggle, autoDisableOnWorldUnload, isMacro
     */
    constructor(nameOrOpts, subcategory, description = '', tooltip = null) {
        const opts = typeof nameOrOpts === 'object' ? nameOrOpts : { name: nameOrOpts, subcategory, description, tooltip };

        this.name = opts.name;
        this.subcategory = opts.subcategory;
        this.description = opts.description || '';
        this.tooltip = opts.tooltip || null;
        this.enabled = false;
        this.oid = null;

        this.isMacro = opts.isMacro === true;

        this._registers = [];
        this._conditionalRegisters = [];
        this._conditionalChecker = null;

        // add to gui
        Categories.addCategoryItem(this.subcategory, this.name, this.description, this.tooltip);
        if (opts.showEnabledToggle !== false) {
            Categories.addToggle('Modules', this.name, 'Enabled', (value) => this.toggle(!!value), `Toggles ${this.name}`);
        }

        if (opts.autoDisableOnWorldUnload) {
            register('worldUnload', () => this.toggle(false));
        }
    }

    // automatically handle enabling/disabling of registers
    trackRegister(register) {
        if (register && register.register && register.unregister) {
            this._registers.push(register);
        }
        return register;
    }

    // create + track a register in one line
    on(registerName, callback) {
        const h = register(registerName, callback).unregister();
        return this.trackRegister(h);
    }

    // toggle register based on the condition
    when(condition, registerName, callback) {
        const actionRegister = register(registerName, callback).unregister();

        const conditionalItem = {
            condition: condition,
            actionRegister: actionRegister,
            isRegistered: false,
        };
        this._conditionalRegisters.push(conditionalItem);

        if (!this._conditionalChecker) {
            this._conditionalChecker = register('step', () => {
                this._conditionalRegisters.forEach((item) => {
                    const conditionValue = !!item.condition();

                    if (conditionValue && !item.isRegistered) {
                        item.actionRegister.register();
                        item.isRegistered = true;
                    } else if (!conditionValue && item.isRegistered) {
                        item.actionRegister.unregister();
                        item.isRegistered = false;
                    }
                });
            }).setFps(5);
        }
    }

    /**
     * Toggle the module on/off
     * @param {boolean} [value] - Optional: force specific state (true/false). If undefined, toggles current state.
     */
    toggle(value) {
        const newVal = typeof value === 'boolean' ? value : !this.enabled;
        if (this.enabled === newVal) return;
        this.enabled = newVal;

        if (newVal) {
            if (this.isMacro) {
                MacroState.onModuleEnabled(this.name);
            }

            if (this.oid) {
                OverlayManager.startTime(this.oid);
            }
            try {
                this.onEnable();
            } catch (e) {
                console.error(`Error in ${this.name}.onEnable():`, e);
            }
            this._registers.forEach((h) => h.register());
        } else {
            if (this.isMacro) {
                MacroState.onModuleDisabled(this.name);
            }

            if (this.oid) {
                OverlayManager.resetTime(this.oid);
            }
            this._registers.forEach((h) => h.unregister());
            try {
                this.onDisable();
            } catch (e) {
                console.error(`Error in ${this.name}.onDisable():`, e);
            }
        }
    }

    /**
     * Check if any macro is currently running
     * @returns {boolean}
     */
    isAnyMacroRunning() {
        return MacroState.isMacroRunning();
    }

    /**
     * Get the name of the currently active macro
     * @returns {string|null}
     */
    getActiveMacroName() {
        return MacroState.getActiveMacro();
    }

    /**
     * Get the start time of the current macro session
     * @returns {number}
     */
    getMacroStartTime() {
        return MacroState.getStartTime();
    }

    bindToggleKey(title = `Toggle ${this.name}`) {
        const existingKeybinds = Utils.getConfigFile('keybinds.json') || {};
        const savedKeycode = existingKeybinds[title] || Keyboard.KEY_NONE;
        const id = (this.name || 'module').toLowerCase().replace(/[^a-z0-9]/g, '_');
        this._wrappedKey = KeyBindUtils.create(id, title, savedKeycode);
        this._wrappedKey.onKeyPress(() => this.toggle());
        register('gameUnload', () => {
            this._saveKey(title, this._wrappedKey.keyBinding.boundKey.code);
        });
        return this;
    }

    createOverlay(args) {
        this.oid = this.name;
        OverlayManager.createID(this.oid, args);
    }

    /**
     * Add a toggle to the module's GUI
     * @param {string} title - The title of the toggle
     * @param {function} callback - Callback function when toggle state changes
     * @param {string} [description=null] - Description/tooltip for the toggle
     * @param {boolean} [defaultValue=false] - Optional: Default value for the toggle
     */
    addToggle(title, callback, description = null, defaultValue = false) {
        Categories.addToggle('Modules', this.name, title, callback, description, defaultValue);
    }

    /**
     * Add a slider control to the module's GUI
     * @param {string} title - The title of the slider
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} def - Default value
     * @param {function} callback - Callback function when slider value changes
     * @param {string} [description=null] - Description/tooltip for the slider
     */
    addSlider(title, min, max, def, callback, description = null) {
        Categories.addSlider('Modules', this.name, title, min, max, def, callback, description);
    }

    /**
     * Add a range slider control to the module's GUI
     * @param {string} title - The title of the slider
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {object} def - Default values {low, high}
     * @param {function} callback - Callback function when slider value changes
     * @param {string} [description=null] - Description/tooltip for the slider
     */
    addRangeSlider(title, min, max, def, callback, description = null) {
        Categories.addRangeSlider('Modules', this.name, title, min, max, def, callback, description);
    }

    /**
     * Add a multi-toggle control to the module's GUI
     * @param {string} title - The title of the multi-toggle
     * @param {Array} options - Array of option names
     * @param {boolean} [singleSelect=false] - Whether only one option can be selected at a time
     * @param {function} callback - Callback function when selection changes
     * @param {string} [description=null] - Description/tooltip for the multi-toggle
     * @param {string} [defaultValue=false] - Optional: Default selected option name
     */
    addMultiToggle(title, options, singleSelect, callback, description = null, defaultValue = false) {
        Categories.addMultiToggle('Modules', this.name, title, options, !!singleSelect, callback, description, defaultValue);
    }

    /**
     * Add a color picker to the module's GUI
     * @param {string} title - The title of the color picker
     * @param {object} defaultColor - Default color (java.awt.Color)
     * @param {function} callback - Callback function when color changes
     * @param {string} [description=null] - Description/tooltip for the color picker
     */
    addColorPicker(title, defaultColor, callback, description = null) {
        Categories.addColorPicker('Modules', this.name, title, defaultColor, callback, description);
    }

    // Allow for overriding onEnable and onDisable if you need more control
    // not required
    onEnable() {}
    onDisable() {}

    /**
     * @private
     * Saves a specific keybind description and keycode.
     */
    _saveKey(description, keycode) {
        let allKeybinds = Utils.getConfigFile('keybinds.json') || {};
        allKeybinds[description] = keycode;
        Utils.writeConfigFile('keybinds.json', allKeybinds);
    }
}
