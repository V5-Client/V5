import { Prefix } from "./Prefix";

class FlowstateUtilsClass {
  constructor() {
    this.countdown = 0;
    this.multiplier = 1;
    this.flowstateBlocksBroken = 0;

    let blockx = 0;
    let blocky = 0;
    let blockz = 0;

    let currentBlock = null;

    register("playerInteract", (action, object) => {
      if (action.toString() === "AttackBlock") {
        if (!object.type.name.toLowerCase().includes("bedrock")) {
          blockx = object.getX();
          blocky = object.getY();
          blockz = object.getZ();
          currentBlock = object;
        } else {
          blockx = blocky = blockz = 0;
        }
      }
    });

    register("PacketReceived", (packet) => {
      let lore = Player.getHeldItem()
        .getLore()
        .map((l) => ChatLib.removeFormatting(l))
        .join(" ");
      let match = lore.match(/flowstate\s*(i{1,3})/i);
      let bonus = match
        ? { I: 1, II: 2, III: 3 }[match[1].toUpperCase()] * 1
        : 0;

      if (
        Player.getHeldItem() !== null &&
        match &&
        packet.getPos().getX() == blockx &&
        packet.getPos().getY() == blocky &&
        packet.getPos().getZ() == blockz &&
        (packet.getState().getBlock().toString().includes("bedrock") ||
          packet.getState().getBlock().toString().includes("air"))
      ) {
        this.countdown = 10;
        this.flowstateBlocksBroken += bonus;
        if (this.flowstateBlocksBroken > 100 * this.multiplier) {
          let rounded = Math.floor(this.flowstateBlocksBroken / 100) * 100;
          Prefix.message(`Current Flowstate: ${rounded}`);
          this.multiplier++;
        }
      }
    }).setFilteredClasses([
      net.minecraft.network.packet.s2c.play.BlockUpdateS2CPacket,
    ]);

    register("step", () => {
      if (this.countdown === 0) {
        if (this.flowstateBlocksBroken > 100) {
          Prefix.debugMessage(
            `Flowstate lost at ${this.flowstateBlocksBroken} blocks`
          );
        }
        this.flowstateBlocksBroken = 0;
      }

      if (this.countdown > 0) this.countdown--;
    }).setFps(1);
  }

  CurrentFlowstate() {
    return Math.min(600, this.flowstateBlocksBroken * 3);
  }
}

export const Flowstate = new FlowstateUtilsClass();
