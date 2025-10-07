const { addToggle } = global.Categories;

class Module {
    constructor() {
        this.enabled = false;

        let mainLoop = register('step', () => {
            // Module code
        }).unregister();

        toggle(value);
        {
            this.enabled = value;
            if (value) mainLoop.register();
            else mainLoop.unregister();
        }

        addCategoryItem('Category', 'Module', 'Description', 'Tooltip');

        addToggle('Category', 'Module', 'Enabled', (value) => {
            this.toggle(value);
        });
    }
}

new Module();
