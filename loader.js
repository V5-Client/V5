com.chattriggers.ctjs.api.Config.setAutoUpdateModules(false);
com.chattriggers.ctjs.api.Config.setOpenConsoleOnError(true);

/* COMMANDS */
import './utils/V5Commands.js';

/* GUI */
import './gui/GUI.js';

/* CORE */
import './utils/Config.js';
import './utils/backend/IRC.js';

/* Utils */
import './utils/MacroState.js';
import './modules/other/MacroScheduler.js';
import './utils/pathfinder/PathFinder.js';
import './utils/Clipping.js';
import './utils/Misc.js';
import './utils/Webhooks.js';
import './failsafes/FailsafeManager.js';
import './utils/V5Mod.js';
import './utils/SkyblockEvents.js';
import './utils/KeybindInitializer.js';

/* Modules */
import './modules/loader.js';

import { loadSettings } from './gui/GuiSave';
loadSettings();
