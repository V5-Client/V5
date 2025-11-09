const mouseMixin = new Mixin('net.minecraft.client.Mouse');

export const IsCursorLocked = mouseMixin.inject({
    method: 'isCursorLocked()Z',
    at: new At({ value: 'Head' }),
    cancellable: true,
});