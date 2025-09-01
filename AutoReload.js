// credits: ImaDoofus | https://chattriggers.com/modules/v/Reload

// Shouldnt be in public release!
import { Chat } from './Utility/Chat';

const File = java.io.File;
const FileSystems = java.nio.file.FileSystems;
const WatchEvent = java.nio.file.StandardWatchEventKinds;

function onEvent(event) {
    const extension = event.context().toFile().getName().split('.').pop();
    if (extension !== 'js') return;

    const fileName = event.context().getFileName();
    if (event.kind() === WatchEvent.ENTRY_MODIFY)
        Chat.message(`File &6${fileName} &fhas been modified.`);
    else if (event.kind() === WatchEvent.ENTRY_CREATE)
        Chat.message(`File &a${fileName} &fhas been created.`);

    ChatLib.command('ct load', true);
}

new Thread(() => {
    const watchService = FileSystems.getDefault().newWatchService();
    const path = new File('./config/ChatTriggers/modules');

    function listFiles(file) {
        if (file.isDirectory()) {
            file.listFiles().forEach((f) => listFiles(f));
            file.toPath().register(
                watchService,
                WatchEvent.ENTRY_MODIFY,
                WatchEvent.ENTRY_CREATE
            );
        }
    }
    listFiles(path);

    let start = true;
    register('gameUnload', () => (start = false));

    while (start) {
        const key = watchService.take();
        for (let event of key.pollEvents()) {
            onEvent(event);
        }
    }
}).start();
