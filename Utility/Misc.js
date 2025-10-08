import { Chat } from './Chat';

register('command', () => {
    let block = Player.lookingAt();
    if (block instanceof Block) {
        Chat.Message('blockid: ' + block.type.getID());
        let Name = block.type.getName();
        Chat.Message('blockname: ' + Name);
        Chat.Message('registry: ' + block.type.getRegistryName());
    } else {
        Chat.Message(block);
    }
}).setName('blockinfo');

register('command', function () {
    const block = Player.lookingAt();
    if (!block) {
        Chat.Message('You are not looking at a block');
        return;
    }
    Chat.Message(block?.type?.isTranslucent());
}).setName('istranslucent');
