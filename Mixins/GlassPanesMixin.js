import { attachMixin } from '../Utility/AttachMixin';

const horizontalConnectingBlockMixin = new Mixin('net.minecraft.block.HorizontalConnectingBlock');

const FullStainedGlassPane = horizontalConnectingBlockMixin.inject({
    method: 'getOutlineShape',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const PaneFix = attachMixin(FullStainedGlassPane, 'FullStainedGlassPane', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    const StainedGlassPaneBlock = net.minecraft.block.StainedGlassPaneBlock;

    if (instance instanceof StainedGlassPaneBlock) {
        cir.setReturnValue(VoxelShapes.fullCube());
    }
});
