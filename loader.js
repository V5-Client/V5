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
import "./Pathfinding/test.js"; // WHY DID YOU REMOVE THIS I NEED IT
//import "./AutoReload.js";

// import "./Utility/Webhooks.js"; i honestly fucking hate the webhook load message so much, it just spams me.

/* GUI */
import "./GUI/GuiDraw.js";
import "./GUI/Registries.js";
import "./GUI/NotificationManager.js";
import "./TestNotification.js"; //REMOVE BEFORE RELEASE
import "./Utility/Config.js";

/* FORAGING */

/* MINING */
//import "./Modules/Mining/MiningBot.js"
import "./Modules/Mining/PinglessMining.js";
import "./Modules/Mining/Nuker.js";

/* OTHER */
import "./Modules/Other/DiscordRPC.js";

/* SKILLS */
//import "./Modules/Skills/AutoHarp.js"
//import "./Modules/Skills/BeachBaller.js"
//import "./Modules/Skills/FishingMacro.js"

/* VISUALS */
//import "./Modules/Visuals/MobHider.js"; - This is depreceated cus it kills your fps by 10x !
import "./Modules/Visuals/Xray.js";

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






/* RAYTRACE TESTING */
import "./RAYTRACEDEBUG.js"; // REMOVE THIS BEFORE RELEASE