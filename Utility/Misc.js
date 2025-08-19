register("command", () => {
  let block = Player.lookingAt();
  if (block instanceof Block) {
    ChatLib.chat("blockid: " + block.type.getID());
    let Name = block.type.getName();
    ChatLib.chat("blockname: " + Name);
    ChatLib.chat("registry: " + block.type.getRegistryName());
  } else {
    ChatLib.chat(block);
  }
}).setName("blockinfo");
