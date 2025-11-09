// If the mixin is persistent, call attatchMixin() in its file and import here, if its not import the injection and use attatchMixin() where needed

import { HandleInputEvents, OnMouseScroll } from './Mixins/SlotChangeMixin';
import { IsCursorLocked, LockCursor, OnCursorPos } from './Mixins/UngrabMixin';
import { PaneFix } from './Mixins/GlassPanesMixin';
import { DisablePauseOnLostFocus } from './Mixins/GameRendererMixin';

/* still needed?

const cameraMixin = new Mixin('net.minecraft.client.render.Camera');
const entityMixin = new Mixin('net.minecraft.entity.Entity');

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
}); */
