import { Chat } from './Chat';
import { File } from './Constants';

let configName = 'V5Config';

function existsFile(configName, FileName) {
    return FileLib.exists(configName, FileName);
}

function deleteFile(configName, FileName) {
    FileLib.delete(configName, FileName);
}

function fileBroken(configName, FileName) {
    let config = FileLib.read(configName, FileName);
    if (FileName === 'responseMessages.txt') {
        return;
    }
    try {
        JSON.parse(config);
    } catch (error) {
        Chat.message('Replaced corrupted file: ' + FileName);
        deleteFile(configName, FileName);
        return true;
    }
    return false;
}

function makeDir(Name) {
    let dir = new File('./config/ChatTriggers/modules/' + configName, Name);
    dir.mkdir();
}

function makeFile(Path, Content) {
    FileLib.append(configName, Path, Content);
}

if (!existsFile('./config/ChatTriggers/modules', configName)) {
    let dir = new File('./config/ChatTriggers/modules/', configName);
    dir.mkdir();
}

let Files = [
    {
        path: 'config.json',
        FileType: 'file',
        Content: [],
    },
    {
        path: 'keybinds.json',
        FileType: 'file',
        Content: [],
    },
    {
        path: 'webhook.json',
        FileType: 'file',
        Content: [],
    },
    {
        path: 'responseMessages.txt',
        FileType: 'text',
        Content: ['???', 'bro wtf', 'what', 'rly', 'hmmmm', 'bro', '?', 'hello??', 'lol', 'nice bro', '...', 'omg', 'pls', 'lmfao', 'idiot', 'really'],
    },

    {
        path: 'GemstoneRoutes',
        FileType: 'dir',
    },
    { path: 'GemstoneRoutes/empty.txt', FileType: 'file', Content: [] },

    {
        path: 'RoutewalkerRoutes',
        FileType: 'dir',
    },
    { path: 'RoutewalkerRoutes/empty.txt', FileType: 'file', Content: [] },

    {
        path: 'TunnelMinerRoutes',
        FileType: 'dir',
    },
    { path: 'TunnelMinerRoutes/empty.txt', FileType: 'file', Content: [] },

    {
        path: 'OreRoutes',
        FileType: 'dir',
    },
    { path: 'OreRoutes/empty.txt', FileType: 'file', Content: [] },

    {
        path: 'EtherwarpRoutes',
        FileType: 'dir',
    },
    { path: 'EtherwarpRoutes/empty.txt', FileType: 'file', Content: [] },

    // Mining Stats
    { path: 'miningstats.json', FileType: 'file', Content: {} },
];

// Handles all the extra files
Files.forEach((FileData) => {
    if (!existsFile(configName, FileData.path) || fileBroken(configName, FileData.path)) {
        if (FileData.FileType === 'file') {
            makeFile(FileData.path, JSON.stringify(FileData.Content, null, 2));
        }
        if (FileData.FileType === 'text') {
            makeFile(FileData.path, FileData.Content.join('\n'));
        }
        if (FileData.FileType === 'dir') {
            makeDir(FileData.path);
        }
    }
});
