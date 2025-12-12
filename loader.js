global.Version = '1.0.0';
Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

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

import './modules/loader.js';

import { loadSettings } from './gui/GuiSave';
loadSettings();
