import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.Mouse')
    .inject({
        method: 'isCursorLocked()Z',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.setReturnValue(true);
    })

    .inject({
        method: 'lockCursor()V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.cancel();
    })

    .inject({
        method: 'updateMouse(D)V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.cancel();
    })

    .inject({
        method: 'onMouseScroll(JDD)V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('inputLocked', false);
        if (isUnlocked && Client.getMinecraft().currentScreen == null) cir.cancel();
    });
