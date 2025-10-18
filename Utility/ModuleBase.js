export class ModuleBase {
    // options object: { name, subcategory, description?, tooltip?, autoDisableOnWorldUnload? }
    constructor(nameOrOpts, subcategory, description = '', tooltip = null) {
        const opts =
            typeof nameOrOpts === 'object'
                ? nameOrOpts
                : { name: nameOrOpts, subcategory, description, tooltip };

        this.name = opts.name;
        this.subcategory = opts.subcategory;
        this.description = opts.description || '';
        this.tooltip = opts.tooltip || null;
        this.enabled = false;
        this._registers = [];

        // add to gui
        global.Categories.addCategoryItem(
            this.subcategory,
            this.name,
            this.description,
            this.tooltip
        );
        global.Categories.addToggle(
            'Modules',
            this.name,
            'Enabled',
            (value) => this.toggle(!!value),
            `Toggles ${this.name}`
        );

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

    // Toggle logic: call hooks and register/unregister tracked registers
    toggle(value) {
        const newVal = !!value;
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

    // helpers for gui stuff
    addToggle(title, callback, description = null) {
        global.Categories.addToggle(
            'Modules',
            this.name,
            title,
            callback,
            description
        );
    }
    addSlider(title, min, max, def, callback, description = null) {
        global.Categories.addSlider(
            'Modules',
            this.name,
            title,
            min,
            max,
            def,
            callback,
            description
        );
    }
    addMultiToggle(title, options, singleSelect, callback, description = null) {
        global.Categories.addMultiToggle(
            'Modules',
            this.name,
            title,
            options,
            !!singleSelect,
            callback,
            description
        );
    }

    // Allow for overriding onEnable and onDisable if you need more control
    // not required
    onEnable() {}
    onDisable() {}
}
