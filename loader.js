Config.setAutoUpdateModules(false);
Config.setOpenConsoleOnError(true);

/* COMMANDS */
import { registerV5Commands } from './utils/V5Commands';

/* GUI */
import './gui/GUI';

/* CORE */
import './utils/Config';
import './utils/backend/WebSocket';
import { ServerboundCommandSuggestionPacket } from './utils/Packets';

register('packetSent', (packet, event) => {
    if (packet.getCommand().toLowerCase().startsWith('/v5')) cancel(event);
}).setFilteredClass(ServerboundCommandSuggestionPacket);

/* Utils */
import { MacroState } from './utils/MacroState';
import './modules/other/MacroScheduler';
import './modules/other/MacroControllers';
import './modules/other/DiscordIntegration';
import './utils/pathfinder/PathFinder';
import './utils/pathfinder/EtherwarpPathfinder';
import './utils/Misc';
import './utils/SkyblockItemUtil';
import './failsafes/FailsafeManager';
import './utils/SkyblockEvents';

/* Modules */
import './modules/loader';
import './utils/UserScripts';

import { loadSettings } from './gui/GuiSave';
registerV5Commands();
MacroState.setupLastMacroToggleKey();
loadSettings();

import './utils/DeveloperModeState';
