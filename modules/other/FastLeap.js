import { ModuleBase } from '../../utils/ModuleBase';

// Plan:
// Instantly open a custom leap gui on key press
// Automatically swap to leap item in hotbar and rightclick
// Take the users input from the custom gui and use that to automatically click in the leap menu
// Use camera mixin to update the players camera position instantly.
// Automatically swap back to previous item in hotbar after

class FastLeap extends ModuleBase {
    constructor() {
        super({
            name: 'FastLeap',
            subcategory: 'Other',
            description: 'Meow',
            tooltip: 'Meow',
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.on('tick', () => {});
    }
}

new FastLeap();
