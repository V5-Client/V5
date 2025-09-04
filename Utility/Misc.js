register('command', () => {
    let block = Player.lookingAt();
    if (block instanceof Block) {
        ChatLib.chat('blockid: ' + block.type.getID());
        let Name = block.type.getName();
        ChatLib.chat('blockname: ' + Name);
        ChatLib.chat('registry: ' + block.type.getRegistryName());
    } else {
        ChatLib.chat(block);
    }
}).setName('blockinfo');

register('command', function () {
    const block = Player.lookingAt();
    if (!block) {
        ChatLib.chat('You are not looking at a block');
        return;
    }
    ChatLib.chat(block?.type?.isTranslucent());
}).setName('istranslucent');
