/* Client Version + Title */

export const Version = " 1.0.0";

Client.getMinecraft()
  .getWindow()
  .setTitle("Zurviq" + Version);

/* Dependencies */

import "./test.js";

/* Utility */
import "./Utility/Config.js";
import { Flowstate } from "./Utility/Flowstate.js";
import { GuiRendering } from "./Utility/GuiRenders.js";
import { Clicking } from "./Utility/Inventory";
import { Invoking } from "./Utility/Invoking";
import { Utils } from "./Utility/Main.js";
import { Calcs } from "./Utility/Math.js";
import { Moving } from "./Utility/Movement";
import { Popup } from "./Utility/PopUpMenu";
import { Prefix } from "./Utility/Prefix";
import { registerEventSB } from "./Utility/SkyblockEvents.js";
import { TConversion } from "./Utility/TimeConversion";
import { Timers } from "./Utility/Timing";
import { Mouse } from "./Utility/Ungrab";
// do raytrace

/* Quality Of Life */

/* GUI */
import "./GUI/Gui.js";

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
