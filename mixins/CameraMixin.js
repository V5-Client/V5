import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.render.Camera')
    .modifyReturnValue({
        method: 'getPos',
        at: new At({ value: 'RETURN' }),
    })
    .hook((manager, instance, originalPos) => {
        const overridePos = manager.get('cameraOverridePos', null);
        return overridePos ?? originalPos;
    });
