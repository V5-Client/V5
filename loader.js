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

import "./Utility/Misc.js";

/* GUI */
import "./GUI/GuiDraw.js";
import "./GUI/Registries.js";

/* QOL */
//import "./QOL/AutoHarp.js";
//import "./QOL/MobHider.js";
//import "./Pathfinding/Pathfinder.js"
import "./Pathfinding/test.js";
//import "./QOL/BeachBaller.js"

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
