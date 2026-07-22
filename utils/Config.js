import { Chat } from './Chat';
import { File } from './Constants';

const CONFIG_ROOT = 'V5Config';
const CONFIG_PATH = `./config/ChatTriggers/modules/${CONFIG_ROOT}`;

function generateJson(path, payload = []) {
    if (FileLib.exists(CONFIG_ROOT, path) && (path.endsWith('.txt') || isValidJson(path))) return;

    FileLib.append(CONFIG_ROOT, path, JSON.stringify(payload, null, 4));
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

    files: [
        ['config.json', {}],
        ['keybinds.json', {}],
        ['OverlayPositions/music_overlay.json', {}],
        ['webhook.json', {}],
        ['miningstats.json', {}],
        ['GemstoneRoutes/empty.json', {}],
        ['RoutewalkerRoutes/empty.json', {}],
        ['TunnelMinerRoutes/empty.json', {}],
        ['OreRoutes/empty.json', {}],
        ['EtherwarpRoutes/empty.json', {}],
        ['developerMode.json', { enabled: false }],
        ['AuthCache/do_not_share_this_file', []],
        ['responseMessages.json', responseMessages],
        ['WynnProfession/route.json', {}],
    ],
};

manifest.directories.forEach((dir) => new File(CONFIG_PATH, dir).mkdir());
manifest.files.forEach(([path, data]) => generateJson(path, data));
