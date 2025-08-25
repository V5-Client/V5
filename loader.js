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
import "./Macro/MiningBot.js";
//import "./QOL/PinglessMining.js";
//import "./Macro/FishingMacro.js";

/* Mixins */
import {
  fullStainedGlassPane,
  fullPickle,
  emptyKelp,
  emptyGrass,
  emptyTallGrass,
} from "./mixins.js";
import { Rotations } from "./Utility/Rotations.js";

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

//console.log(`https://client.rdbt.top/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${global.APIKEY_DO_NOT_SHARE}`)
// im using this, dont remove please - zur
