const horizontalConnectingBlockMixin = new Mixin(
    'net.minecraft.block.HorizontalConnectingBlock'
);
const seaPickleBlockMixin = new Mixin('net.minecraft.block.SeaPickleBlock');
const partBlockMixin = new Mixin('net.minecraft.block.AbstractPlantPartBlock');
const seaGrassMixin = new Mixin('net.minecraft.block.SeagrassBlock');
const tallSeaGrassMixin = new Mixin('net.minecraft.block.TallSeagrassBlock');
const cameraMixin = new Mixin('net.minecraft.client.render.Camera');
const entityMixin = new Mixin('net.minecraft.entity.Entity');
const mouseMixin = new Mixin('net.minecraft.client.Mouse');

export const unlockCursor = mouseMixin.inject({
    method: 'lockCursor()V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const setLocked = mouseMixin.inject({
    method: 'isCursorLocked()Z',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const stopMovement = mouseMixin.inject({
    method: 'onCursorPos(JDD)V',
    at: new At({ value: 'Head' }),
    cancellable: true,
});

export const fullStainedGlassPane = horizontalConnectingBlockMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const fullPickle = seaPickleBlockMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const emptyKelp = partBlockMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const emptyGrass = seaGrassMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const emptyTallGrass = tallSeaGrassMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const cameraUpdateMixin = cameraMixin.inject({
    method: 'update',
    at: new At({
        value: 'INVOKE',
        target: 'Lnet/minecraft/client/render/Camera;setRotation(FF)V',
        ordinal: 1,
        shift: At.AFTER,
    }),
});

export const changeLookDirectionMixin = entityMixin.inject({
    method: 'changeLookDirection',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});
