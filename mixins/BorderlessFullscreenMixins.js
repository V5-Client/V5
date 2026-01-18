const Window = new Mixin('net.minecraft.client.util.Window');

export const WindowInjection = Window.inject({
    method: 'updateFullscreen',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});
