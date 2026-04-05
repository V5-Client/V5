com.chattriggers.ctjs.api.Config.setAutoUpdateModules(false);
com.chattriggers.ctjs.api.Config.setOpenConsoleOnError(true);

/* KEYBINDS */
import './utils/KeybindInitializer';

/* COMMANDS */
import './utils/V5Commands';

/* GUI */
import './gui/GUI';

/* CORE */
import './utils/Config';
import './utils/backend/WebSocket';

/* Utils */
import { MacroState } from './utils/MacroState';
import './modules/other/MacroScheduler';
import './modules/other/MacroControllers';
import './modules/other/DiscordIntegration';
import './utils/pathfinder/PathFinder';
import './utils/pathfinder/EtherwarpPathfinder';
import './utils/Clipping';
import './utils/Misc';
import './failsafes/FailsafeManager';
import './utils/V5Mod';
import './utils/SkyblockEvents';

/* Modules */
import './modules/loader';
import './utils/Debugging';

import { loadSettings } from './gui/GuiSave';
MacroState.setupLastMacroToggleKey();
loadSettings();
