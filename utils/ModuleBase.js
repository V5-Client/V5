import { notificationManager } from '../gui/NotificationManager';
import { OverlayManager } from '../gui/OverlayUtils';
import { Categories } from '../gui/categories/CategorySystem';
import { Chat } from './Chat';
import { KeyBindUtils } from './Constants';
import { MacroState } from './MacroState';
import { Mixin } from './MixinManager';
import { manager } from './SkyblockEvents';
import { Utils } from './Utils';

export class ModuleBase {
    static conditions = [];
    static conditionChecker = null;

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
        this.hexCode = null;
        this.hideInModules = opts.hideInModules === true;
        this.showEnabledToggle = opts.showEnabledToggle !== false;

        this.isParentManaged = false;

        this.isMacro = opts.isMacro === true;

        MacroState.registerModule(this);

        this._registers = [];

        // add to gui
        if (!this.hideInModules) {
            Categories.addCategoryItem(this.subcategory, this.name, this.description, this.tooltip);
        }

        if (opts.autoDisableOnWorldUnload) {
            register('worldUnload', () => this.toggle(false));
        }

        if (opts.isMacro) {
            manager.subscribe('limbo', () => {
                if (!this.enabled) return;
                this.toggle(false);
                Chat.message('&cYou were spawned in limbo! Active macro was disabled.');
            });
        }

        ModuleBase.setupConditionChecker();
    }

    static setupConditionChecker() {
        if (ModuleBase.conditionChecker) return;

        ModuleBase.conditionChecker = register('tick', () => {
            for (let i = 0; i < ModuleBase.conditions.length; i++) {
                const item = ModuleBase.conditions[i];

                const shouldBeActive = !!item.condition();

                if (shouldBeActive && !item.isRegistered) {
                    item.action.register();
                    item.isRegistered = true;
                } else if (!shouldBeActive && item.isRegistered) {
                    item.action.unregister();
                    item.isRegistered = false;
                }
            }
        });
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

        ModuleBase.conditions.push({
            parent: this,
            condition: condition,
            action: actionRegister,
            isRegistered: false,
        });
    }

    /**
     * Toggle the module on/off
     * @param {boolean} [value] - Optional: force specific state (true/false). If undefined, toggles current state.
     * @param {boolean} [parentManaged=false] - If true, this enable was triggered by another module. Hides overlay and prevents double-state recording.
     * @param {string} [toggleContext='user'] - Source of the toggle event (user, scheduler).
     */
    toggle(value, parentManaged = false, toggleContext = 'user') {
        const newVal = typeof value === 'boolean' ? value : !this.enabled;

        if (this.enabled === newVal) {
            if (newVal) this.isParentManaged = parentManaged;
            return;
        }

        this.enabled = newVal;

        if (newVal) {
            this.isParentManaged = parentManaged;

            if (this.isMacro) {
                Mixin.set('macroEnabled', true);
                MacroState.onModuleEnabled(this.name, toggleContext);
            }

            if (this.oid && !this.isParentManaged) {
                OverlayManager.startTime(this.oid, this.isMacro);
            }

            try {
                this.onEnable();
            } catch (e) {
                console.error(`Error in ${this.name}.onEnable():`);
                console.error('V5 Caught error' + e + e.stack);
            }
            this._registers.forEach((h) => h.register());
        } else {
            if (this.isMacro) {
                MacroState.onModuleDisabled(this.name, toggleContext);
                Mixin.set('macroEnabled', MacroState.isMacroRunning());
            }

            if (this.oid) {
                if (this.isMacro) {
                    OverlayManager.pauseTime(this.oid);
                } else {
                    OverlayManager.resetTime(this.oid);
                }
            }

            this._registers.forEach((h) => h.unregister());
            try {
                this.onDisable();
            } catch (e) {
                console.error(`Error in ${this.name}.onDisable():`);
                console.error('V5 Caught error' + e + e.stack);
            }

            this.isParentManaged = false;
        }
    }

    setTheme(hexCode) {
        this.hexCode = `&${hexCode}`;
    }

    message(message) {
        if (!this.name || !this.hexCode) return Chat.message('&cModule message error!');
        Chat.message(`${this.hexCode}${this.name}: &f${message}`);
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

        this._wrappedKey.onKeyPress(() => {
            this.requestToggleFromUser();
        });

        register('gameUnload', () => {
            this._saveKey(title, this._wrappedKey.keyBinding.boundKey.code);
        });
        return this;
    }

    /**
     * Toggle initiated by user input (keybind/gui button).
     * Preserves scheduler cancel and parent-managed safeguards.
     * @returns {boolean} True when this action enabled the module.
     */
    requestToggleFromUser() {
        if (this.isMacro && !this.enabled) {
            const scheduler = MacroState.getModule('Scheduler');
            if (scheduler && typeof scheduler.cancelScheduledMacro === 'function') {
                if (scheduler.cancelScheduledMacro(this.name)) return false;
            }
        }

        if (this.enabled && this.isParentManaged) {
            notificationManager.add('Cannot toggle module', `${this.name} is being managed by another macro. Toggle the parent macro.`, 'ERROR', '5000');
            return false;
        }

        const wasEnabled = this.enabled;
        this.toggle();
        return !wasEnabled && this.enabled;
    }

    createOverlay(args, options = {}) {
        this.oid = this.name;
        OverlayManager.createID(this.oid, args, options);
    }

    createSchedulerOverlay(args) {
        this.oid = this.name;
        OverlayManager.createSchedulerID(this.oid, args);
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
     * Add a toggle directly to the Settings page
     * @param {string} title - The title of the toggle
     * @param {function} callback - Callback function when toggle state changes
     * @param {string} [description=null] - Description/tooltip for the toggle
     * @param {boolean} [defaultValue=false] - Optional: Default value for the toggle
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectToggle(title, callback, description = null, defaultValue = false, sectionName = null) {
        Categories.addSettingsToggle(title, callback, description, defaultValue, sectionName, 'Settings');
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
     * Add a slider directly to the Settings page
     * @param {string} title - The title of the slider
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} def - Default value
     * @param {function} callback - Callback function when slider value changes
     * @param {string} [description=null] - Description/tooltip for the slider
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectSlider(title, min, max, def, callback, description = null, sectionName = null) {
        Categories.addSettingsSlider(title, min, max, def, callback, description, sectionName, 'Settings');
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
     * Add a range slider directly to the Settings page
     * @param {string} title - The title of the slider
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {object} def - Default values {low, high}
     * @param {function} callback - Callback function when slider value changes
     * @param {string} [description=null] - Description/tooltip for the slider
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectRangeSlider(title, min, max, def, callback, description = null, sectionName = null) {
        Categories.addSettingsRangeSlider(title, min, max, def, callback, description, sectionName, 'Settings');
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
        return Categories.addMultiToggle('Modules', this.name, title, options, !!singleSelect, callback, description, defaultValue);
    }

    /**
     * Add a multi-toggle directly to the Settings page
     * @param {string} title - The title of the multi-toggle
     * @param {Array} options - Array of option names
     * @param {boolean} [singleSelect=false] - Whether only one option can be selected at a time
     * @param {function} callback - Callback function when selection changes
     * @param {string} [description=null] - Description/tooltip for the multi-toggle
     * @param {string} [defaultValue=false] - Optional: Default selected option name
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectMultiToggle(title, options, singleSelect, callback, description = null, defaultValue = false, sectionName = null) {
        return Categories.addSettingsMultiToggle(title, options, !!singleSelect, callback, description, defaultValue, sectionName, 'Settings');
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

    /**
     * Add a color picker directly to the Settings page
     * @param {string} title - The title of the color picker
     * @param {object} defaultColor - Default color (java.awt.Color)
     * @param {function} callback - Callback function when color changes
     * @param {string} [description=null] - Description/tooltip for the color picker
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectColorPicker(title, defaultColor, callback, description = null, sectionName = null) {
        Categories.addSettingsColorPicker(title, defaultColor, callback, description, sectionName, 'Settings');
    }

    /**
     * Add a text input to the module's GUI
     * @param {string} title - The title of the text input
     * @param {string} defaultValue - Default text
     * @param {function} callback - Callback function when text changes
     * @param {string} [description=null] - Description/tooltip
     */
    addTextInput(title, defaultValue, callback, description = null) {
        Categories.addTextInput('Modules', this.name, title, defaultValue, callback, description);
    }

    /**
     * Add a text input directly to the Settings page
     * @param {string} title - The title of the text input
     * @param {string} defaultValue - Default text
     * @param {function} callback - Callback function when text changes
     * @param {string} [description=null] - Description/tooltip
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectTextInput(title, defaultValue, callback, description = null, sectionName = null) {
        Categories.addSettingsTextInput(title, defaultValue, callback, description, sectionName, 'Settings');
    }

    /**
     * Add a button to the module's GUI
     * @param {string} title - The title of the button
     * @param {function} callback - Callback function when button is pressed
     * @param {string} [description=null] - Description/tooltip
     */
    addButton(title, callback, description = null) {
        Categories.addButton('Modules', this.name, title, callback, description);
    }

    /**
     * Add a button directly to the Settings page
     * @param {string} title - The title of the button
     * @param {function} callback - Callback function when button is pressed
     * @param {string} [description=null] - Description/tooltip
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectButton(title, callback, description = null, sectionName = null) {
        Categories.addSettingsButton(title, callback, description, sectionName, 'Settings');
    }

    /**
     * Add a popup to the module's GUI
     * @param {string} title - The title of the popup
     * @param {function} callback - Callback function when popup opens/closes
     * @param {string} [description=null] - Description/tooltip
     */
    addPopup(title, callback, description = null) {
        return Categories.addPopup('Modules', this.name, title, callback, description);
    }

    /**
     * Add a popup directly to the Settings page
     * @param {string} title - The title of the popup
     * @param {function} callback - Callback function when popup opens/closes
     * @param {string} [description=null] - Description/tooltip
     * @param {string} [sectionName=null] - Optional: Section header within Settings
     */
    addDirectPopup(title, callback, description = null, sectionName = null) {
        Categories.addSettingsPopup(title, callback, description, sectionName, 'Settings');
    }

    /**
     * Add a separator to the module's GUI
     * @param {string} title - The title of the separator
     * @param {boolean} [fullWidth=false] - Whether the separator spans the full panel width
     */
    addSeparator(title, fullWidth = false) {
        Categories.addSeparator('Modules', this.name, title, fullWidth);
    }

    /**
     * Add a separator directly to the Settings page
     * @param {string} title - The title of the separator
     */
    addDirectSeparator(title) {
        Categories.addSettingsSeparator(title, 'Settings');
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
