import { Chat } from './Chat';
import { File, globalAssetsDir } from './Constants';

const SOURCE_SOUNDS_DIR = new File('./config/ChatTriggers/modules/V5/failsafes/sounds');
const DEST_SOUNDS_DIR = new File(globalAssetsDir, 'failsafes/sounds');

function organizeFailsafeSounds() {
    if (!SOURCE_SOUNDS_DIR.exists()) return;
    if (!DEST_SOUNDS_DIR.exists()) DEST_SOUNDS_DIR.mkdirs();

    const soundFiles = SOURCE_SOUNDS_DIR.listFiles();
    if (!soundFiles) return;

    const Files = Java.type('java.nio.file.Files');
    const StandardCopyOption = Java.type('java.nio.file.StandardCopyOption');

    for (const file of soundFiles) {
        if (file.isDirectory() || !file.getName().endsWith('.wav')) continue;

        const target = new File(DEST_SOUNDS_DIR, file.getName());
        if (target.exists() && file.length() === target.length()) continue;

        try {
            Files.copy(file.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (e) {
            console.error('V5 Asset Fixer Error: ' + e);
        }
    }
}

organizeFailsafeSounds();

const CONFIG_ROOT = 'V5Config';
const CONFIG_PATH = `./config/ChatTriggers/modules/${CONFIG_ROOT}`;

function generate(path, type, payload = []) {
    if (FileLib.exists(CONFIG_ROOT, path) && (path.endsWith('.txt') || isValidJson(path))) return;

    if (type === 'dir') new File(CONFIG_PATH, path).mkdir();
    else FileLib.append(CONFIG_ROOT, path, JSON.stringify(payload, null, 4));
}

function isValidJson(path) {
    try {
        JSON.parse(FileLib.read(CONFIG_ROOT, path));
        return true;
    } catch (e) {
        Chat.message(`§cRepairing corrupted data: ${path}`);
        console.error('V5 Caught error' + e + e.stack);
        FileLib.delete(CONFIG_ROOT, path);
        return false;
    }
}

new File('./config/ChatTriggers/modules', CONFIG_ROOT).mkdir();

const responseMessages = ['???', 'bro wtf', 'what', 'rly', 'hmmmm', 'bro', '?', 'hello??', 'lol', 'nice bro', '...', 'omg', 'pls', 'lmfao', 'idiot', 'really'];

const manifest = {
    directories: [
        'GemstoneRoutes',
        'RoutewalkerRoutes',
        'TunnelMinerRoutes',
        'OreRoutes',
        'EtherwarpRoutes',
        'AuthCache',
        'FarmingMacro',
        'Gifs',
        'Clips',
        'OverlayPositions',
        'WynnProfession',
    ],

    jsonFiles: {
        'config.json': {},
        'keybinds.json': {},
        'OverlayPositions/music_overlay.json': {},
        'webhook.json': {},
        'miningstats.json': {},
        'module_history.json': { version: 1, sessions: [] },
        'GemstoneRoutes/empty.json': {},
        'RoutewalkerRoutes/empty.json': {},
        'TunnelMinerRoutes/empty.json': {},
        'OreRoutes/empty.json': {},
        'EtherwarpRoutes/empty.json': {},
        'FarmingMacro/points.json': {},
        'developerMode.json': { enabled: false },
        'AuthCache/do_not_share_this_file': [],
        'responseMessages.json': responseMessages,
        'WynnProfession/route.json': {},
    },
};

manifest.directories.forEach((dir) => generate(dir, 'dir'));
Object.entries(manifest.jsonFiles).forEach(([path, data]) => generate(path, 'file', data));
