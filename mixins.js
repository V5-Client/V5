const horizontalConnectingBlockMixin = new Mixin(
  "net.minecraft.block.HorizontalConnectingBlock"
);

export const horizontalConnectingBlock_modifyPaneHitbox =
  horizontalConnectingBlockMixin.inject({
    method: "getOutlineShape",
    at: new At({ value: "HEAD" }),
    cancellable: true,
  });
