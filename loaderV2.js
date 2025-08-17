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

import "./GUI/GuiDraw.js";

/* Categories */
global.Categories.addCategory("Modules");

/* DataClasses */
import { ItemObject } from "./Utility/DataClasses/ItemObject.js";
import { Vector } from "./Utility/DataClasses/Vec.js";

/* GUI */
import "./GUI/Gui.js";

/* Macros */

/* QOL */
import "./qol/AutoBeg.js";
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
