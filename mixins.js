const horizontalConnectingBlockMixin = new Mixin(
  "net.minecraft.block.HorizontalConnectingBlock"
);

export const horizontalConnectingBlock_modifyPaneHitbox =
  horizontalConnectingBlockMixin.inject({
    method: "getOutlineShape",
    at: new At({ value: "HEAD" }),
    cancellable: true,
  });

//const seaPickleBlockMixin = new Mixin("net.minecraft.block.SeaPickleBlock");

//export const fullPickle = seaPickleBlockMixin.inject({
//  method: "getOutlineShape",
//  at: new At({ value: "HEAD" }),
//  cancellable: true,
//});

//const seaGrassMixin = new Mixin("net.minecraft.block.SeagrassBlock");

//export const emptyGrass = seaGrassMixin.inject({
///  method: "getOutlineShape",
//  at: new At({ value: "HEAD" }),
//  cancellable: true,
//});

const partBlockMixin = new Mixin("net.minecraft.block.AbstractPlantPartBlock");

export const emptyKelp = partBlockMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});

//const plantBlockMixin = new Mixin("net.minecraft.block.PlantBlock");

//export const emptyPlants = plantBlockMixin.inject({
//  method: "getOutlineShape",
//  at: new At({ value: "HEAD" }),
//  cancellable: true,
//});
