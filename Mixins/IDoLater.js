/*attachMixin(fullPickle, 'fullPickle', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.fullCube());
});

attachMixin(emptyKelp, 'emptyKelp', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    const KelpBlock = net.minecraft.block.KelpBlock;
    const KelpPlant = net.minecraft.block.KelpPlantBlock;

    if (instance instanceof KelpBlock || instance instanceof KelpPlant) {
        cir.setReturnValue(VoxelShapes.empty());
    }
});

attachMixin(emptyGrass, 'emptyGrass', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.empty());
});

attachMixin(emptyTallGrass, 'emptyTallGrass', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.empty());
});

const seaPickleBlockMixin = new Mixin('net.minecraft.block.SeaPickleBlock');
const partBlockMixin = new Mixin('net.minecraft.block.AbstractPlantPartBlock');
const seaGrassMixin = new Mixin('net.minecraft.block.SeagrassBlock');
const tallSeaGrassMixin = new Mixin('net.minecraft.block.TallSeagrassBlock');


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
*/
