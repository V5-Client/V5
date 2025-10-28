const MinecraftClient = new Mixin('net.minecraft.client.MinecraftClient');
const mouseMixin = new Mixin('net.minecraft.client.Mouse');

export const HandleInputEvents = MinecraftClient.inject({
    method: 'handleInputEvents()V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const OnMouseScroll = mouseMixin.inject({
    method: 'onMouseScroll(JDD)V',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});
