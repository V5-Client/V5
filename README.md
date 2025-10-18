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

        // Create a register and unregister it then track them
        const step = register('step', () => {
            // logic here
        }).unregister();
        this.trackRegister(step); // this will automatically handle enabling and disabling

        // You can also use this.on(registerType) to create and track a register in one line
        this.on('step', () => {
            // logic here
        });

        // Optional settings
        this.addToggle(
            'Some Feature',
            (value) => {
                // callback
            },
            'Description of the feature'
        );

        this.addSlider(
            'Speed',
            1,
            10,
            5,
            (value) => {
                // callback
            },
            'How fast to go'
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

- The `Enabled` toggle is added automatically and controls all handlers tracked via `trackHandler`.
- All GUI callbacks update the in-memory SettingsMap, and `setEnabled()` also syncs the UI component so saving persists your programmatic toggles.
- Settings are loaded in `loader.js` via `loadSettings()` which triggers callbacks to initialize modules.
