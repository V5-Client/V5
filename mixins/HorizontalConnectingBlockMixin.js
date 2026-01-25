import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.block.HorizontalConnectingBlock')
    .inject({
        method: 'getOutlineShape',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
        const StainedGlassPaneBlock = net.minecraft.block.StainedGlassPaneBlock;

        if (instance instanceof StainedGlassPaneBlock) {
            cir.setReturnValue(VoxelShapes.fullCube());
        }
    });
