register("command", () => {
  let block = Player.lookingAt();
  if (block instanceof Block) {
    ChatLib.chat("blockid: " + block.type.getID());
    let Name = block.type.getName();
    ChatLib.chat("blockname: " + Name);
  } else {
    ChatLib.chat(block);
  }
}).setName("blockinfo");
