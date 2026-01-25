import { attachMixin } from '../utils/AttachMixin';
import { Mixin } from '../utils/MixinManager';

const gameRendererMixin = new Mixin('net.minecraft.client.render.GameRenderer');
const Window = new Mixin('net.minecraft.client.util.Window');

Mixin('net.minecraft.client.render.GameRenderer')
    .modifyExpressionValue({
        method: 'render',
        at: new At({
            value: 'FIELD',
            target: 'Lnet/minecraft/client/option/GameOptions;pauseOnLostFocus:Z',
        }),
    })
    .hook(() => false);
