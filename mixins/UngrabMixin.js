const mouseMixin = new Mixin('net.minecraft.client.Mouse');

export const IsCursorLocked = mouseMixin.inject({
    method: 'isCursorLocked()Z',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const LockCursor = mouseMixin.inject({
    method: 'lockCursor()V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const UpdateMouse = mouseMixin.inject({
    method: 'updateMouse(D)V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});
