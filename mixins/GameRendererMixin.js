import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.render.GameRenderer')
    .modifyExpressionValue({
        method: 'render',
        at: new At({
            value: 'FIELD',
            target: 'Lnet/minecraft/client/option/GameOptions;pauseOnLostFocus:Z',
        }),
    })
    .hook(() => false);
