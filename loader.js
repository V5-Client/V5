// Client Version + Title (This is kinda useless ngl since Minecraft* 1.21.5 overrides it for some reason)
global.Version = '1.0.0';
global.SESSION_SERVER_HASH = java.util.UUID.randomUUID().toString().replaceAll('-', '');

Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

/* GUI */
import './gui/GUI.js';
import './gui/GIF.js';
import './utils/Config.js';
import './utils/backend/IRC.js';

/* CORE */
import './utils/pathfinder/PathFinder.js';
//import './failsafes/Failsafes.js';

/* FORAGING */
//import './modules/foraging/SeaLumieMacro.js';
import './modules/foraging/AutoHarp.js';
import './modules/foraging/HuntingHelpers.js';

/* MINING */
import './modules/mining/Nuker.js';
import './modules/mining/CommissionMacro.js';
import './modules/mining/GemstoneMacro.js';
import './modules/mining/PinglessMining.js';
//import './Modules/Mining/ScathaMacro.js';
import './modules/mining/ExcavatorMacro.js';
import './modules/mining/LobbyHopper.js';

/* FARMING */
import './modules/farming/FarmingMacro.js';

/* VISUALS */
import './modules/visuals/MobHider.js';
import './modules/visuals/Xray.js';
import './modules/visuals/Visual.js'; // i need - zurv

/* SKILLS */
import './modules/skills/AutoExperiments.js';
import './modules/skills/FishingMacro.js';
import './modules/skills/JerryBoxMacro.js';

/* OTHER */
import './modules/other/BeachBaller.js';
import './modules/other/DiscordRPC.js';
import './modules/other/FastPlace.js';

/* Utilities and shit */
import './utils/Clipping.js'; // register command. it uses modulebase cuz fuck you. it's still a utility!!
import './utils/Misc.js';
import './utils/Webhooks.js';

import { loadSettings } from './gui/GuiSave';
loadSettings();

/*register('tick', () => {
    const velocity = Player.getPlayer().getVelocity();

    const horizontalSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;

    const speedBPS = Math.sqrt(horizontalSpeedSq) * 20.0;

    ChatLib.chat(speedBPS);
}); */
