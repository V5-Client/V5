/**  TODO
 * StencilUtils
 * Rotations
 * Webhook integration
 * Dependencies :(
 */

/* Client Version + Title */

global.Version = "1.0.0";
global.APIKEY_DO_NOT_SHARE = java.util.UUID.randomUUID()
  .toString()
  .replaceAll("-", "");

Client.getMinecraft()
  .getWindow()
  .setTitle("Client " + global.Version + ` - ${Player.getName()}`);

import "./Utility/Misc.js";
import "./Backend/IRC.js";
//import "./AutoReload.js";

// import "./Utility/Webhooks.js"; i honestly fucking hate the webhook load message so much, it just spams me.

/* GUI */
import "./GUI/GuiDraw.js";
import "./GUI/Registries.js";

/* QOL */
//import "./QOL/AutoHarp.js";
//import "./QOL/MobHider.js";
//import "./Pathfinding/Pathfinder.js"
import "./Pathfinding/test.js";
import "./QOL/BeachBaller.js";
import "./Macro/SeaLumieMacro.js";
import "./QOL/Nuker.js";
//import "./Macro/MiningBot.js";
//import "./QOL/PinglessMining.js";
//import "./Macro/FishingMacro.js";
//import "./QOL/Xray.js";

/* Mixins */
import {
  fullStainedGlassPane,
  fullPickle,
  emptyKelp,
  emptyGrass,
  emptyTallGrass,
} from "./mixins.js";

fullStainedGlassPane.attach((instance, cir) => {
  const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
  const StainedGlassPaneBlock = net.minecraft.block.StainedGlassPaneBlock;

  if (instance instanceof StainedGlassPaneBlock) {
    cir.setReturnValue(VoxelShapes.fullCube());
  }
});

fullPickle.attach((instance, cir) => {
  const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
  cir.setReturnValue(VoxelShapes.fullCube());
});

emptyKelp.attach((instance, cir) => {
  const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
  const KelpBlock = net.minecraft.block.KelpBlock;
  const KelpPlant = net.minecraft.block.KelpPlantBlock;

  if (instance instanceof KelpBlock || instance instanceof KelpPlant) {
    cir.setReturnValue(VoxelShapes.empty());
  }
});

emptyGrass.attach((instance, cir) => {
  const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
  cir.setReturnValue(VoxelShapes.empty());
});

emptyTallGrass.attach((instance, cir) => {
  const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
  cir.setReturnValue(VoxelShapes.empty());
});
