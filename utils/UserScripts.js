import { File } from './Constants';
import { ModuleBase } from './ModuleBase';

const USER_SCRIPTS_DIR = new File('./config/ChatTriggers/modules/V5Config/UserScripts');
const EXAMPLE_SCRIPT = `
import { ModuleBase } from '../../V5/utils/ModuleBase';
import { ClientboundPlayerPositionPacket } from '../../V5/utils/Packets';
import { v5Command } from '../../V5/utils/V5Commands';
import { Rotations } from '../../V5/utils/player/Rotations';

class ExampleScript extends ModuleBase {
    constructor() {
        super({
            name: 'Example Script',
            subcategory: 'Other',
            description: 'A starter user script.',
        });

        // this.on runs when the module has been enabled in the gui/keybind
        this.on('tick', () => {
            // This runs every game tick.
        });

        this.on('step', () => {
            // This runs based on the set fps
        }).setFps(2);

        this.on('packetReceived', (packet, event) => {
            // This runs when the client recieves a "ClientboundPlayerPositionPacket"
        }).setFilteredClass(ClientboundPlayerPositionPacket);

        // Registers a command under /v5 example
        v5Command('example', () => {
            // Rotates the player to look at yaw 50, pitch -20, with the specificed options (not required.)
            Rotations.lookAtAngles(50, -20, { precision: 0.25, speedMultiplier: 1.5 });
        });
    }
}

new ExampleScript();`;

if (!USER_SCRIPTS_DIR.exists()) USER_SCRIPTS_DIR.mkdirs();

if (!new File(USER_SCRIPTS_DIR, 'Example.js').exists() && !new File(USER_SCRIPTS_DIR, 'Example.js.disabled').exists()) {
    FileLib.write('V5Config', 'UserScripts/Example.js.disabled', EXAMPLE_SCRIPT);
}

for (const file of Array.from(USER_SCRIPTS_DIR.listFiles() || []).sort((a, b) => a.getName().localeCompare(b.getName()))) {
    if (!file.isFile() || !file.getName().endsWith('.js')) continue;

    ModuleBase.loadingUserScript = true;
    try {
        require(`../../V5Config/UserScripts/${file.getName().slice(0, -3)}`);
    } catch (e) {
        console.error(`Failed to load user script ${file.getName()}:`, e);
    } finally {
        ModuleBase.loadingUserScript = false;
    }
}
