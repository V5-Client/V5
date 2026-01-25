import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.render.entity.EntityRenderer')
    .inject({
        method: 'getDisplayName',
        at: new At({ value: 'RETURN' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const originalText = cir.getReturnValue();
        if (!originalText) return;

        const processor = manager.getMethod('nameProcessor');
        const modified = processor(originalText);

        if (modified !== undefined && modified !== originalText) {
            cir.setReturnValue(modified);
        }
    });
