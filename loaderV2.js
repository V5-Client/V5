/**  TODO
 * StencilUtils
 * Rotations
 * Webhook integration
 * Dependencies :(
 */

/* Client Version + Title */

global.Version = "1.0.0";

Client.getMinecraft()
  .getWindow()
  .setTitle("Client " + global.Version + ` - ${Player.getName()}`);

import "./GUI/Gui.js";

/* Categories */
global.Categories.addCategory("Mining Macros");
//global.Categories.addCategory("Foraging");
global.Categories.addCategory("Other Macros");
global.Categories.addCategory("Player");
global.Categories.addCategory("World");
global.Categories.addCategory("Qol");
global.Categories.addCategory("Settings");

import "./QOL/AutoHarp.js";

/* Mixins */
import { horizontalConnectingBlock_modifyPaneHitbox } from "./mixins.js";

horizontalConnectingBlock_modifyPaneHitbox.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  const StainedGlassPaneBlock = Java.type(
    "net.minecraft.block.StainedGlassPaneBlock"
  );

  if (instance instanceof StainedGlassPaneBlock) {
    cir.setReturnValue(VoxelShapes.fullCube());
  }
});
