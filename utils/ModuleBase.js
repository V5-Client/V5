import { Utils } from './Utils';

export class ModuleBase {
    /**
     * Create a new module
     * @param {string|object} nameOrOpts - Module name or options object
     * @param {string} [subcategory] - Subcategory name (required if nameOrOpts is string)
     * @param {string} [description=''] - Module description (required if nameOrOpts is string)
     * @param {string} [tooltip=null] - Tooltip text (required if nameOrOpts is string)
     * @param {object} [opts] - Options object with properties: name, subcategory, description, tooltip, showEnabledToggle, autoDisableOnWorldUnload
     */
    constructor(nameOrOpts, subcategory, description = '', tooltip = null) {
        const opts = typeof nameOrOpts === 'object' ? nameOrOpts : { name: nameOrOpts, subcategory, description, tooltip };

        this.name = opts.name;
        this.subcategory = opts.subcategory;
        this.description = opts.description || '';
        this.tooltip = opts.tooltip || null;
        this.enabled = false;
        this._registers = [];
        this._conditionalRegisters = [];
        this._conditionalChecker = null;

        // add to gui
        global.Categories.addCategoryItem(this.subcategory, this.name, this.description, this.tooltip);
        if (opts.showEnabledToggle !== false) {
            global.Categories.addToggle('Modules', this.name, 'Enabled', (value) => this.toggle(!!value), `Toggles ${this.name}`);
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
                this._conditionalRegisters.forEach((item) => this._checkConditional(item));
            }).setFps(1);
        }

        this._checkConditional(conditionalItem);
    }

    // check the item and (un)register
    _checkConditional(item) {
        const conditionValue = item.condition();

        if (conditionValue && !item.isRegistered) {
            item.actionRegister.register();
            item.isRegistered = true;
        } else if (!conditionValue && item.isRegistered) {
            item.actionRegister.unregister();
            item.isRegistered = false;
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
            try {
                this.onEnable();
            } catch (e) {}
            this._registers.forEach((h) => h.register());
        } else {
            this._registers.forEach((h) => h.unregister());
            try {
                this.onDisable();
            } catch (e) {}
        }
    }

    bindToggleKey(title = `Toggle ${this.name}`) {
        const keybindDescription = title;

        const existingKeybinds = Utils.getConfigFile('keybinds.json') || {};
        const savedKeycode = existingKeybinds[keybindDescription] || Keyboard.KEY_NONE;

        this._toggleKeyBind = new KeyBind(keybindDescription, savedKeycode, 'v5');

        this._toggleKeyBind.registerKeyPress(() => this.toggle());

        register('gameUnload', () => this._saveKey(keybindDescription, this._toggleKeyBind.getKeyCode()));

        return this;
    }

    /**
     * Add a toggle to the module's GUI
     * @param {string} title - The title of the toggle
     * @param {function} callback - Callback function when toggle state changes
     * @param {string} [description=null] - Description/tooltip for the toggle
     * @param {boolean} [defaultValue=false] - Optional: Default value for the toggle
     */
    addToggle(title, callback, description = null, defaultValue = false) {
        global.Categories.addToggle('Modules', this.name, title, callback, description, defaultValue);
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
        global.Categories.addSlider('Modules', this.name, title, min, max, def, callback, description);
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
        global.Categories.addMultiToggle('Modules', this.name, title, options, !!singleSelect, callback, description, defaultValue);
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
