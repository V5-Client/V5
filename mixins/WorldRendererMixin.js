import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.render.WorldRenderer')
    .inject({
        method: 'renderMain(Lnet/minecraft/client/render/FrameGraphBuilder;Lnet/minecraft/client/render/Frustum;Lorg/joml/Matrix4f;Lcom/mojang/blaze3d/buffers/GpuBufferSlice;ZLnet/minecraft/client/render/state/WorldRenderState;Lnet/minecraft/client/render/RenderTickCounter;Lnet/minecraft/util/profiler/Profiler;)V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const macroEnabled = Mixin.get('macroEnabled', false);
        const renderLimiter = Mixin.get('renderLimiter', 'Off');

        if (macroEnabled && renderLimiter === 'No Render') {
            cir.cancel();
        }
    });
