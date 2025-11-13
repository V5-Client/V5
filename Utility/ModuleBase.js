import { Utils } from './Utils';

export class ModuleBase {
    // options object: { name, subcategory, description?, tooltip?, showEnabledToggle?, autoDisableOnWorldUnload? }
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
            this._conditionalChecker = this.trackRegister(
                register('step', () => {
                    this._conditionalRegisters.forEach((item) => this._checkConditional(item));
                }).setFps(1)
            );
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

    // Toggle logic: call hooks and register/unregister tracked registers
    // If value is undefined, invert current state
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

        this._toggleKeyBind = new KeyBind(keybindDescription, savedKeycode, 'V5');
        this._toggleKeyBind.registerKeyPress(() => this.toggle());

        register('gameUnload', () => this._saveKey(keybindDescription, this._toggleKeyBind.getKeyCode()));

        return this;
    }

    // helpers for gui stuff
    addToggle(title, callback, description = null) {
        global.Categories.addToggle('Modules', this.name, title, callback, description);
    }
    addSlider(title, min, max, def, callback, description = null) {
        global.Categories.addSlider('Modules', this.name, title, min, max, def, callback, description);
    }
    addMultiToggle(title, options, singleSelect, callback, description = null) {
        global.Categories.addMultiToggle('Modules', this.name, title, options, !!singleSelect, callback, description);
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
