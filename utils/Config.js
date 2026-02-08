import { Chat } from './Chat';
import { File } from './Constants';

class ConfigInitializer {
    constructor(baseName) {
        this.root = baseName;
        this.basePath = `./config/ChatTriggers/modules/`;
        this.fullRootPath = `${this.basePath}${this.root}`;

        this.setupBaseDirectory();
    }

    setupBaseDirectory() {
        const rootDir = new File(this.basePath, this.root);
        if (!rootDir.exists()) rootDir.mkdir();
    }

    isCorrupted(path) {
        if (path.endsWith('.txt')) return false;

        const rawContent = FileLib.read(this.root, path);
        try {
            JSON.parse(rawContent);
            return false;
        } catch (e) {
            Chat.message(`§cRepairing corrupted data: ${path}`);
            console.error('V5 Caught error' + e + e.stack);
            FileLib.delete(this.root, path);
            return true;
        }
    }

    generate(path, type, payload = []) {
        const alreadyExists = FileLib.exists(this.root, path);
        if (alreadyExists && !this.isCorrupted(path)) return;

        switch (type) {
            case 'dir':
                new File(this.fullRootPath, path).mkdir();
                break;
            case 'text':
                FileLib.append(this.root, path, payload.join('\n'));
                break;
            case 'file':
            default:
                FileLib.append(this.root, path, JSON.stringify(payload, null, 4));
                break;
        }
    }
}

const Manager = new ConfigInitializer('V5Config');

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
    ],

    jsonFiles: {
        'config.json': {},
        'keybinds.json': {},
        'OverlayPositions/music_overlay.json': {},
        'webhook.json': {},
        'miningstats.json': {},
        'GemstoneRoutes/empty.json': {},
        'RoutewalkerRoutes/empty.json': {},
        'TunnelMinerRoutes/empty.json': {},
        'OreRoutes/empty.json': {},
        'EtherwarpRoutes/empty.json': {},
        'FarmingMacro/points.json': {},
        'AuthCache/do_not_share_this_file': [],
        'responseMessages.json': responseMessages,
    },
};

manifest.directories.forEach((dir) => Manager.generate(dir, 'dir'));
Object.entries(manifest.jsonFiles).forEach(([path, data]) => Manager.generate(path, 'file', data));
