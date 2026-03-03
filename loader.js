if (global.V5Loaded) {
    for (let i = 0; i < 100; i++) {
        ChatLib.chat('V5 Already loaded? Multiple modules? Did you forget to set dev channel?');
    }
}
global.V5Loaded = true;

com.chattriggers.ctjs.api.Config.setAutoUpdateModules(false);
com.chattriggers.ctjs.api.Config.setOpenConsoleOnError(true);

/* KEYBINDS */
import './utils/KeybindInitializer.js';

/* COMMANDS */
import './utils/V5Commands.js';

/* GUI */
import './gui/GUI.js';

/* CORE */
import './utils/Config.js';
import './utils/backend/WebSocket.js';

/* Utils */
import './utils/MacroState.js';
import './modules/other/MacroScheduler.js';
import './modules/other/MacroControllers.js';
import './modules/other/DiscordIntegration.js';
import './utils/pathfinder/PathFinder.js';
import './utils/Clipping.js';
import './utils/Misc.js';
import './failsafes/FailsafeManager.js';
import './utils/V5Mod.js';
import './utils/SkyblockEvents.js';

/* Modules */
import './modules/loader.js';
import './utils/Debugging.js';

import { loadSettings } from './gui/GuiSave';
loadSettings();
