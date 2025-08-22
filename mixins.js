const horizontalConnectingBlockMixin = new Mixin("net.minecraft.block.HorizontalConnectingBlock");
const seaPickleBlockMixin = new Mixin("net.minecraft.block.SeaPickleBlock");
const partBlockMixin = new Mixin("net.minecraft.block.AbstractPlantPartBlock");
const seaGrassMixin = new Mixin("net.minecraft.block.SeagrassBlock");
const tallSeaGrassMixin = new Mixin("net.minecraft.block.TallSeagrassBlock");

export const fullStainedGlassPane = horizontalConnectingBlockMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});

export const fullPickle = seaPickleBlockMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});

export const emptyKelp = partBlockMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});

export const emptyGrass = seaGrassMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});

export const emptyTallGrass = tallSeaGrassMixin.inject({
  method: "getOutlineShape",
  at: new At({ value: "HEAD" }),
  cancellable: true,
});