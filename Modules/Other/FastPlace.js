import { ModuleBase } from '../../utils/ModuleBase';

class FastPlace extends ModuleBase {
    constructor() {
        super({
            name: 'FastPlace',
            subcategory: 'Other',
            description: 'Instant placing blocks',
            tooltip: 'Sets itemUseCooldown to 0 (instant block placement)',
        });

        const MinecraftClient = net.minecraft.client.MinecraftClient;
        const client = MinecraftClient.getInstance();
        const field = MinecraftClient.class.getDeclaredField('field_1752');
        field.setAccessible(true);

        this.on('tick', () => field.setInt(client, 0));
    }
}

new FastPlace();
