import { attachMixin } from '../utils/AttachMixin';

const gameRendererMixin = new Mixin('net.minecraft.client.render.GameRenderer');

const Render = gameRendererMixin.modifyExpressionValue({
    method: 'render',
    at: new At({
        value: 'FIELD',
        target: 'Lnet/minecraft/client/option/GameOptions;pauseOnLostFocus:Z',
    }),
});

export const DisablePauseOnLostFocus = attachMixin(Render, 'GameRenderer', () => false);
