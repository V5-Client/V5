const mouseMixin = new Mixin('net.minecraft.client.Mouse');

export const LockCursor = mouseMixin.inject({
    method: 'lockCursor()V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const IsCursorLocked = mouseMixin.inject({
    method: 'isCursorLocked()Z',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const OnCursorPos = mouseMixin.inject({
    method: 'onCursorPos(JDD)V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});
