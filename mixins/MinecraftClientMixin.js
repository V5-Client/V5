import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.MinecraftClient')
    .inject({
        method: 'handleInputEvents()V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('inputLocked', false);
        if (!isUnlocked) return;

        instance.options.hotbarKeys.forEach((key) => {
            if (key.wasPressed()) key.setPressed(false);
        });
    });
