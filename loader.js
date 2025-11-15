// Client Version + Title (This is kinda useless ngl since Minecraft* 1.21.5 overrides it for some reason)
global.Version = '1.0.0';
global.SESSION_SERVER_HASH = java.util.UUID.randomUUID().toString().replaceAll('-', '');

Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

/* FAILSAFES */

/* GUI */
import './GUI/GUI.js';
import './GUI/GIF.js';
import './Utility/Config.js';

/* CORE */
import './Pathfinding/PathFinder.js';
//import './Failsafes/Failsafes.js';

/* FORAGING */
//import './Modules/Foraging/SeaLumieMacro.js';

/* MINING */
import './Modules/Mining/PinglessMining.js';
import './Modules/Mining/GemstoneMacro.js';
import './Modules/Mining/CommissionMacro.js';
//import './Modules/Mining/ScathaMacro.js';
import './Modules/Mining/ExcavatorMacro.js';

/* FARMING */
import './Modules/Farming/FarmingMacro.js';

/* VISUALS */
import './Modules/Visuals/Xray.js';
import './Modules/Visuals/MobHider.js';

/* SKILLS */
import './Modules/Skills/AutoHarp.js';
//import './Modules/Skills/BeachBaller.js'; //still fucking broken but less.
//import './BeachBallerDebug.js';
import './Modules/Skills/FishingMacro.js';
import './Modules/Skills/JerryBoxMacro.js';
import './Modules/Skills/AutoExperiments.js';
import './Modules/Other/Visual.js'; // this is just for me cus i need - zurv

/* OTHER */
import './Modules/Other/DiscordRPC.js';
import './Modules/Other/FastPlace.js';
//import './Modules/Other/CakeAura.js'; // broken cuz im a retard
//import './Modules/Other/AutoLoot.js';
//import './Modules/Other/AutoSkyblock.js'; // this imports NUKER so it still works idk - cus it needs  connections
//import './Modules/Other/Freelook.js';
import './Utility/Misc.js';
import './Backend/IRC.js';
import './Modules/Other/LobbyHopper.js';
// import "./Utility/Webhooks.js"; i honestly fucking hate the webhook load message so much, it just spams me.

import { loadSettings } from './GUI/GuiSave';
loadSettings();
import { returnDiscord } from './GUI/Utils.js';
returnDiscord();

/*register('tick', () => {
    const velocity = Player.getPlayer().getVelocity();

    const horizontalSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;

    const speedBPS = Math.sqrt(horizontalSpeedSq) * 20.0;

    ChatLib.chat(speedBPS);
}); */
