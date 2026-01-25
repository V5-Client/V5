import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.Mouse')
    .inject({
        method: 'isCursorLocked()Z',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.setReturnValue(false);
    })

    .inject({
        method: 'lockCursor()V',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.cancel();
    })

    .inject({
        method: 'updateMouse(D)V',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('ungrabbed', false);
        if (isUnlocked) cir.cancel();
    })

    .inject({
        method: 'onMouseScroll(JDD)V',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('inputLocked', false);
        if (isUnlocked) cir.cancel();
    });
