example module format:

```javascript
// Imports

const { addToggle, addCategoryItem } = global.Categories;

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

        addToggle('Modules', 'Module', 'Enabled', (value) => {
            this.toggle(value);
        });
    }
}

new Module();
```
