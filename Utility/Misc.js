import { Chat } from './Chat';

register('command', () => {
    let block = Player.lookingAt();
    if (block instanceof Block) {
        Chat.message('blockid: ' + block.type.getID());
        let Name = block.type.getName();
        Chat.message('blockname: ' + Name);
        Chat.message('registry: ' + block.type.getRegistryName());
    } else {
        Chat.message(block);
    }
}).setName('blockinfo');

register('command', function () {
    const block = Player.lookingAt();
    if (!block) {
        Chat.message('You are not looking at a block');
        return;
    }
    Chat.message(block?.type?.isTranslucent());
}).setName('istranslucent');
