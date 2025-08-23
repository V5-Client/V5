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
import "./QOL/BeachBaller.js";
//import "./Macro/SeaLumieMacro.js";
import "./QOL/Nuker.js";
import "./Utility/MiningUtils.js";

/* Mixins */
import {
  fullStainedGlassPane,
  fullPickle,
  emptyKelp,
  emptyGrass,
  emptyTallGrass,
} from "./mixins.js";

fullStainedGlassPane.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  const StainedGlassPaneBlock = Java.type(
    "net.minecraft.block.StainedGlassPaneBlock"
  );

  if (instance instanceof StainedGlassPaneBlock) {
    cir.setReturnValue(VoxelShapes.fullCube());
  }
});

fullPickle.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  cir.setReturnValue(VoxelShapes.fullCube());
});

emptyKelp.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  const KelpBlock = Java.type("net.minecraft.block.KelpBlock");
  const KelpPlant = Java.type("net.minecraft.block.KelpPlantBlock");

  if (instance instanceof KelpBlock || instance instanceof KelpPlant) {
    cir.setReturnValue(VoxelShapes.empty());
  }
});

emptyGrass.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  cir.setReturnValue(VoxelShapes.empty());
});

emptyTallGrass.attach((instance, cir) => {
  const VoxelShapes = Java.type("net.minecraft.util.shape.VoxelShapes");
  cir.setReturnValue(VoxelShapes.empty());
});
