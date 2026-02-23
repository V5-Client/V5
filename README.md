# 🌌 V5 | ModuleBase Developer Documentation (1.21.10)

This guide provides a full technical breakdown of the **V5** framework for Minecraft 1.21.10. It is designed to help developers implement custom logic using the `ModuleBase` utility class.

---

## 🏗️ The Module Lifecycle

The `ModuleBase` class manages the state, UI, and event listeners of your macro. By extending this class, your script gains access to automatic event cleanup and GUI integration.

### Core Architecture

1. **Constructor**: Define the module metadata and initialize UI elements (Sliders/Toggles).
2. **Auto-Registry**: Use `this.on()` to hook into game events. These are automatically unregistered when the module is toggled off to ensure zero background resource usage.

---

## 🛠️ Complete API Reference

### Constructor Options

| Option              | Type    | Description                                                                 |
| :------------------ | :------ | :-------------------------------------------------------------------------- |
| `name`              | String  | The display name in the V5 GUI.                                             |
| `subcategory`       | String  | Category grouping (e.g., 'Combat', 'Farming').                              |
| `description`       | String  | Brief summary of what the module does.                                      |
| `showEnabledToggle` | Boolean | If `false`, the "Enabled" switch is hidden (useful for command-only tools). |

### Event Methods

- `this.on(event, callback)`: The primary way to run code. Supports all standard events (tick, chat, renderWorld, packetReceived).
- `onEnable()`: Triggered once when the user toggles the module ON.
- `onDisable()`: Triggered once when the user toggles the module OFF.

### UI Injection Methods

- `this.addToggle(title, callback, description)`: Adds a boolean switch.
- `this.addSlider(title, min, max, default, callback, description)`: Adds a numerical slider.
- `this.bindToggleKey(title?)`: Adds a hotkey selector to the Minecraft keybind menu.

---

## 📜 Full Code Template

This is a complete, ready-to-use template including all common features.

```javascript
import { ModuleBase } from './utils/ModuleBase';

/**
 * V5 Macro Implementation
 * Targeted for Minecraft 1.21.10
 */
class Template extends ModuleBase {
    constructor() {
        // 1. Setup Module Identity
        super({
            name: 'Template',
            subcategory: 'Core',
            description: 'A template for 1.21.10 modules.',
            tooltip: 'A template for 1.21.10 modules.',
            showEnabledToggle: true,
        });

        // 2. Initial Variables
        this.boolean = false;
        this.number = 5;

        // 3. UI Implementation
        this.bindToggleKey('Macro Toggle Key');
        this.setTheme('#65a6f0'); // Used to change the color of this.message prefix

        this.addToggle(
            'Boolean',
            (val) => {
                this.boolean = val;
            },
            'A boolean value.'
        );

        this.addSlider(
            'Number',
            1,
            20,
            10,
            (val) => {
                this.number = val;
            },
            'A number value.'
        );

        // 4. Managed Event Listeners
        // These auto-register/unregister with the module toggle
        this.on('tick', () => {
            if (this.boolean) {
                // Perform movement checks here
            }
        });

        this.on('renderWorld', () => {
            // Visual logic here
        });
    }

    /**
     * Optional Overrides
     */
    onEnable() {
        this.message('Enabled');
    }

    onDisable() {
        this.message('Disabled');
    }
}

// Instantiate the module
new Template();
```
