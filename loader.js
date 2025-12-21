// "1.21.05" => 12105
// "1.21.10" => 12110
global.mcVersion = (net.minecraft.SharedConstants.getGameVersion()?.getId() || net.minecraft.SharedConstants.getGameVersion()?.id())
    .split('.')
    .reduce((acc, val) => acc * 100 + parseInt(val), 0);

global.Version = '1.0.0';
// comment out because mac. please edit ctjs to not break!

//Client.getMinecraft()
//    .getWindow()
//    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

/* GUI */
import './gui/GUI.js';

/* CORE */
import './utils/Config.js';
import './utils/backend/IRC.js';

/* Utils */
import './utils/MacroState.js';
import './utils/pathfinder/PathFinder.js';
import './utils/Clipping.js'; // register command. it uses modulebase cuz fuck you. it's still a utility!!
import './utils/Misc.js';
import './utils/Webhooks.js';
import './Failsafes/FailsafeManager.js';
import './utils/V5Mod.js';

import './modules/loader.js';

import { loadSettings } from './gui/GuiSave';
loadSettings();
