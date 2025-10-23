example module format:

```javascript
import { ModuleBase } from './Utility/ModuleBase';

class ExampleModule extends ModuleBase {
    constructor() {
        super({
            name: 'Example Module',
            subcategory: 'Other',
            description: 'What it does',
            tooltip: 'Optional tooltip',
        });

        this.bindToggleKey();

        // Create a register and unregister it then track them
        const step = register('step', () => {
            // logic here
        }).unregister();
        this.trackRegister(step); // handlers tracked here only run while Enabled

        // You can also use this.on(registerType) to create and track a register in one line
        this.on('step', () => {
            // logic here
        });

        // Optional settings
        this.addToggle(
            'Some Feature', // title
            (value) => {
                // callback
            },
            'Description of the feature' // description
        );

        this.addSlider(
            'Speed', // title
            1, // min
            10, // max
            5, // default
            (value) => {
                // callback
            },
            'How fast to go' // description
        );
    }

    // Manually override onEnable and onDisable if you need more control
    // not required
    onEnable() {
        // Runs when Enabled toggle is turned on
    }

    onDisable() {
        // Runs when Enabled toggle is turned off
    }
}

new ExampleModule();
```

Notes:

-   The `Enabled` toggle is added automatically; hide it with `showEnabledToggle: false` in the constructor options for command/keybind modules.
-   Use `this.on(event, cb)` to create handlers that auto-register on enable and unregister on disable.
-   Use `this.trackRegister(reg)` if you build a handler first with `register(...).unregister()` and then want ModuleBase to manage it.
-   `this.bindToggleKey(title?)` adds a hotkey to toggle the module (works even when disabled).
