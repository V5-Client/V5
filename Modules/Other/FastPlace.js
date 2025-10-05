const { addToggle, addCategoryItem } = global.Categories;

class FastPlace {
    constructor() {
        this.enabled = false;

        const MinecraftClient = net.minecraft.client.MinecraftClient;
        const client = MinecraftClient.getInstance();

        const field = MinecraftClient.class.getDeclaredField('field_1752');
        field.setAccessible(true);

        let mainLoop = register('tick', () => {
            field.setInt(client, 0);
        }).unregister();

        this.toggle = (value) => {
            this.enabled = value;
            if (value) mainLoop.register();
            else mainLoop.unregister();
        };

        addCategoryItem(
            'Other',
            'FastPlace',
            'Instant placing blocks',
            'Sets itemUseCooldown to 0 (instant block placement)'
        );

        addToggle(
            'Modules',
            'FastPlace',
            'Enabled',
            (value) => {
                this.toggle(value);
            },
            'Toggles the FastPlace module'
        );
    }
}

new FastPlace();
