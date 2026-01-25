import { attachMixin } from '../utils/AttachMixin';

const Window = new Mixin('net.minecraft.client.util.Window');

const FocusChanged = Window.inject({
    method: 'onWindowFocusChanged',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const PauseFix = attachMixin(FocusChanged, 'onWindowFocusChanged', (instance, cir) => {
    cir.cancel();
});
