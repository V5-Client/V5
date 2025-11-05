// Client Version + Title (This is kinda useless ngl since Minecraft* 1.21.5 overrides it for some reason)
global.Version = '1.0.0';
global.SESSION_SERVER_HASH = java.util.UUID.randomUUID().toString().replaceAll('-', '');

Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

/* FAILSAFES */

/* GUI */
import './GUI/GUI.js';
import './Utility/Config.js';

/* CORE */
import './Pathfinding2.0/PathFinder.js';
import './Pathfinding2.0/PathWalker/VisibleBlocksHighlighter.js';
import './Failsafes/Failsafes.js';

/* FORAGING */
//import './Modules/Foraging/SeaLumieMacro.js';

/* MINING */
import './Modules/Mining/PinglessMining.js';
import './Modules/Mining/GemstoneMacro.js';
import './Modules/Mining/CommissionMacro.js';

/* VISUALS */
import './Modules/Visuals/Xray.js';
import './Modules/Visuals/MobHider.js';

/* SKILLS */
import './Modules/Skills/AutoHarp.js';
import './Modules/Skills/BeachBaller.js'; //still fucking broken but less.
//import './BeachBallerDebug.js';
import './Modules/Skills/FishingMacro.js';
import './Modules/Skills/JerryBoxMacro.js';
import './Modules/Skills/AutoExperiments.js';
import './Modules/Other/Visual.js'; // this is just for me cus i need - zurv

/* OTHER */
import './Pathfinding/Pathwalker.js';
import './Modules/Other/DiscordRPC.js';
import './Modules/Other/FastPlace.js';
//import './Modules/Other/AutoLoot.js';
import './Modules/Other/AutoSkyblock.js'; // this imports NUKER so it still works idk
//import './Modules/Other/Freelook.js';
import './Utility/Misc.js';
import './Backend/IRC.js';
import './Modules/Other/LobbyHopper.js';
// import "./Utility/Webhooks.js"; i honestly fucking hate the webhook load message so much, it just spams me.

/* TESTING */
import './TestNotification.js'; //REMOVE BEFORE RELEASE
import './RAYTRACEDEBUG.js'; // REMOVE BEFORE RELEASE

import { loadSettings } from './GUI/GuiSave';
loadSettings();
import { returnDiscord } from './GUI/Utils.js';
returnDiscord();
