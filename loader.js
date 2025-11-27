// Client Version + Title (This is kinda useless ngl since Minecraft* 1.21.5 overrides it for some reason)
global.Version = '1.0.0';
global.SESSION_SERVER_HASH = java.util.UUID.randomUUID().toString().replaceAll('-', '');

Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

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
import './Modules/Mining/CommissionMacro.js';
import './Modules/Mining/GemstoneMacro.js';
import './Modules/Mining/PinglessMining.js';
//import './Modules/Mining/ScathaMacro.js';
import './Modules/Mining/ExcavatorMacro.js';

/* FARMING */
import './Modules/Farming/FarmingMacro.js';

/* VISUALS */
import './Modules/Visuals/MobHider.js';
import './Modules/Visuals/Xray.js';

/* SKILLS */
import './Modules/Other/Visual.js'; // this is just for me cus i need - zurv
import './Modules/Skills/AutoExperiments.js';
import './Modules/Skills/AutoHarp.js';
import './Modules/Skills/BeachBaller.js';
import './Modules/Skills/FishingMacro.js';
import './Modules/Skills/JerryBoxMacro.js';

/* OTHER */
import './Modules/Other/DiscordRPC.js';
import './Modules/Other/FastPlace.js';
import './Modules/Other/LobbyHopper.js';

/* Utilities and shit */
import './Backend/IRC.js';
import './Utility/Clipping.js'; // register command. it uses modulebase cuz fuck you. it's still a utility!!
import './Utility/Misc.js';
import './Utility/Webhooks.js';

import { loadSettings } from './GUI/GuiSave';
import { returnDiscord } from './GUI/Utils.js';
loadSettings();
returnDiscord();

/*register('tick', () => {
    const velocity = Player.getPlayer().getVelocity();

    const horizontalSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;

    const speedBPS = Math.sqrt(horizontalSpeedSq) * 20.0;

    ChatLib.chat(speedBPS);
}); */
