// Globals
global = {};

//global.modules = []
//global.settingSelection = {}

// Dependencies

//BloomCore
import Vector3 from "./Utility/BloomCore/Vector3";
import "./Utility/BloomCore/RaytraceBlocks";

// Utility
import { Clicking } from "./Utility/Inventory";
import { Invoking } from "./Utility/Invoking";
import { Calculations } from "./Utility/Math";
import { Movement } from "./Utility/Movement";
import { Popup } from "./Utility/PopUpMenu";
import { Chat } from "./Utility/Prefix";
import RayTrace from "./Utility/Raytrace";
import { Numbers } from "./Utility/TimeConversion";
import { Time } from "./Utility/Timing";
import { Mouse } from "./Utility/Ungrab"; //kill yourself fucking gay ahh util holy shit spent 17 hours working on this single util???
import "./cool";

// Utils
import "./util/registerWhen";
import "./utils/dataclasses/Vec";
import "./utils/dataclasses/ItemObject";
import "./utils/Buffer";
//import "./utils/dataclasses/ServerPlayer"; maybe remove ?
//                       import "./utils/dataclasses/Routes"; // maybe removed ?
//import "./utils/BlockRenderer" optimization
//import "./utils/FileUtils"
//import "./module/ModuleManager"
//import "./utils/GuiUtils"
//import "./utils/Utils"
//import "./utils/MiningUtils"
import "./utils/webhookManager";
import "./utils/rotation/RotationsFork";
/*import "./utils/rotation/PowderRotations"
import "./utils/DevUtils"
import "./utils/FlowstateUtils"
import "./utils/RodSwap"
import "./utils/ScathaUtils"
import "./qol/QOL"

// GUI
import "./gui/NotificationHandler"
import "./gui/CategoryTitle"
import "./gui/CheckboxDropdown"
import "./gui/ImageButton"
import "./gui/ModuleButton"
import "./gui/ToggleButton"
import "./gui/EditableString"
import "./gui/ThemeEditor"
import "./gui/EditLocation"
import "./gui/ProgressOverlay"
import "./gui/SelectionDropdown"
import "./gui/MultiToggle"
import "./gui/ValueSlider"
import "./gui/Warning"
import "./gui/GUI"

// Modules
import "./module/ModuleLoader"

// Pathfinding
import "./pathfinding/Pathfinder"
import "./pathfinding/RdbtPathFinder"
import "./pathfinding/PathHelper"
import "./pathfinding/RouteWalkerV2"

// Failsafes
import "./failsafe/Failsafe"
import "./failsafe/ResponseBot"
import "./failsafe/TeleportFailsafe"
import "./failsafe/RotationFailsafe"
import "./failsafe/PlayerFailsafe"
import "./failsafe/ItemFailsafe"
import "./failsafe/BlockFailsafe"
import "./failsafe/VelocityFailsafe"
import "./failsafe/SmartFailsafe"
import "./failsafe/ServerFailsafe"
import "./failsafe/FailsafeManager"

// Macros
import "./macro/MiningBot"
import "./macro/GemstoneMacro"
import "./macro/OreMacro"
import "./macro/CommissionMacro"
import "./macro/GlaciteCommission"
import "./macro/TunnelMiner"
import "./macro/Etherwarper"
import "./qol/AutoReconnect"
//import "./macro/HoppityMacro" Works fine import if you want
import "./macro/ScathaMacroV2"
import "./macro/ExcavatorMacro"
import "./macro/NukerUtils"
import "./macro/Nuker"
import "./macro/PowderNuker"
import "./qol/AutoEnchanting"
import "./qol/AutoHarp"
import "./qol/ESP"
//import "./qol/GhostBlocks"
import "./qol/LobbyHopper"
import "./qol/ProfileHider"
import "./qol/Spin"
//import "./qol/FastPlace"
import "./qol/MobHider"
import "./qol/GrottoFinder"
import "./gui/clientHud"
import "./qol/AutoBeg"
import "./qol/MiningQOL"
//import "./qol/Freecam"
import "./qol/PowderTracker"
import "./qol/PinglessMining"
import "./qol/InventoryHUD"
//import "./qol/FishingXPCheese"
import "./macro/Mineshafter"
import "./qol/BlackHole"
// Init
import "./gui/ConfigGUIInit"

// blingbling fix
// adds nuker support </3
let f
try {
  f = FileLib.read("BlingBlingAddons/util", "BlingPlayer.js")
} catch (e) {
  ChatLib.chat("&c[ERROR] Failed to read BlingPlayer.js: " + e)
  f = null
}

const bug = "this.mined = {};"
const patch =
  'this.mined  = {}; register("packetSent", (packet) => { let block = Player.lookingAt(); if (block.getClass() === Block) { this.hitBlocks.set(getcoords(block), { type: block.getMetadata(), time: Date.now(), }); } }).setFilteredClass(net.minecraft.network.play.client.C0APacketAnimation)'

if (f && f.includes(bug)) {
  try {
    FileLib.write("BlingBlingAddons/util", "BlingPlayer.js", f.replace(bug, patch))
    const trigger = register("worldLoad", () => {
      trigger.unregister()
      ChatTriggers.reloadCT()
    })
  } catch (e) {
    ChatLib.chat("&c[ERROR] Failed to write to BlingPlayer.js: " + e)
  }
} */

register("command", () => {
  const client = Client.getMinecraft();
  //var invert = client.options.invertYMouse.getValue();

  ChatLib.chat(`${client.options.invertYMouse.getValue()}`);

  // Set value (true/false)
  client.options.invertYMouse.setValue(true);

  //client.options.keyForward.setKeyBindState(true);
}).setName("toggleview");
