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

import { loadSettings } from './gui/GuiSave';
MacroState.setupLastMacroToggleKey();
loadSettings();

import { Chat } from './utils/Chat';
import { isDeveloperModeEnabled } from './utils/DeveloperModeState';

function warnDeveloper() {
    setTimeout(() => {
        if (!World.isLoaded()) {
            warnDeveloper();
        } else {
            Chat.message("&cDeveloper Mode is enabled. Run '/V5 developerMode false' to disable.");
            Chat.message('&cDeveloper Mode is UAYOR and disables auto updates.');
        }
    }, 1000);
}

if (isDeveloperModeEnabled()) {
    warnDeveloper();
}
