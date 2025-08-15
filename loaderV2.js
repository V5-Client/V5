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

/* Dependencies */
import { Vector3 } from "./Dependencies/BloomCore/Vector3.js";
import { raytraceBlocks } from "./Dependencies/BloomCore/RaytraceBlocks.js";

/* Utility */
import "./Utility/Config.js";
import { Flowstate } from "./Utility/Flowstate.js";
import { Guis } from "./Utility/Inventory";
import { MathUtils } from "./Utility/Math.js";
import { MiningUtils } from "./Utility/MiningUtils.js";
import "./Utility/Misc.js";
import { Keybind } from "./Utility/Keybinding.js";
import { Popup } from "./Utility/PopUpMenu";
import { Prefix } from "./Utility/Prefix";
import { RayTrace } from "./Utility/Raytrace.js";
import { Rotations } from "./Utility/Rotations.js";
import { registerEventSB } from "./Utility/SkyblockEvents.js";
import { Conversions } from "./Utility/TimeConversion";
import { Timers } from "./Utility/Timing";
import { Mouse } from "./Utility/Ungrab";
import { Utils } from "./Utility/Utils.js";
import { Webhook } from "./Utility/Webhooks.js";
// do raytrace

/* DataClasses */
import { ItemObject } from "./Utility/DataClasses/ItemObject.js";
import { Vector } from "./Utility/DataClasses/Vec.js";

/* GUI */
import "./GUI/Gui.js";

/* Macros */

/* QOL */

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
