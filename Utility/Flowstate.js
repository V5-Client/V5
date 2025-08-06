import { Prefix } from "./Prefix";

class FlowstateUtilsClass {
  constructor() {
    this.countdown = 0;
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
      if (
        Player.getHeldItem() !== null &&
        Player.getHeldItem()
          .getEnchantments()
          .entrySet()
          .stream()
          .filter((e) => e.toString().includes("flowstate")) &&
        packet.getPos().getX() == blockx &&
        packet.getPos().getY() == blocky &&
        packet.getPos().getZ() == blockz &&
        (packet.getState().getBlock().toString().includes("bedrock") ||
          packet.getState().getBlock().toString().includes("air"))
      ) {
        this.countdown = 10;
        this.flowstateBlocksBroken += 1;
        if (this.flowstateBlocksBroken % 100 == 0) {
          Prefix.message(`Current Flowstate: ${this.flowstateBlocksBroken}`);
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
