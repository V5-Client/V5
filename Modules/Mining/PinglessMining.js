// Credits: Kash - MiningModules

import { Utils } from "../../Utility/Utils";
import { getSetting } from "../../GUI/GuiSave";
import { MiningUtils } from "../../Utility/MiningUtils";

// ghost blocking is much harder in 1.21.5, making this more buggy
class Pingless {
  constructor() {
    this.mining = false;
    let x;
    let y;
    let z;

    register("step", () => {
      this.enabled = getSetting("Pingless Miner", "Enabled");
      this.tickCount = getSetting("Pingless Miner", "Tick Delay");
      let isActive = false;

      if (this.enabled && !isActive) {
        playerAction.register();
        handSwing.register();
        isActive = true;
      } else if (!this.enabled && isActive) {
        playerAction.unregister();
        handSwing.unregister();
        isActive = false;
      }
    }).setFps(1);

    let playerAction = register("packetSent", (packet) => {
      if (!this.enabled || Utils.area() !== "Crystal Hollows") return;

      let action = packet.getAction().toString();
      if (action === "START_DESTROY_BLOCK") {
        this.pos = packet.getPos();

        x = this.pos.x;
        y = this.pos.y;
        z = this.pos.z;

        if (!Player.getPlayer().isOnGround()) return;
        if (
          this.ticks < 4 &&
          World.getBlockAt(x, y, z)
            ?.type?.getRegistryName()
            .includes("stained_glass")
        )
          return; // i dont think this affects anymore ?

        if (
          !Player.getHeldItem()
            ?.getName()
            ?.toLowerCase()
            ?.match(/pick|drill|gauntlet/)
        )
          return; // tools only

        let blockName = World.getBlockAt(x, y, z)?.type?.getRegistryName();
        if (
          (World.getBlockAt(x, y, z)?.type?.getID() !== 1 &&
            !blockName.includes("ore")) ||
          blockName.includes("redstone")
        )
          return;

        this.mining = true;
      }
    })
      .setFilteredClass(
        net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
      )
      .unregister();

    let handSwing = register("packetSent", () => {
      if (!this.enabled || Utils.area() !== "Crystal Hollows") return;

      if (this.mining) {
        if (this.tickCount > 0) {
          this.tickCount--;
        } else {
          MiningUtils.GhostBlock(this.pos);
          this.mining = false;
        }
      }
    })
      .setFilteredClass(
        net.minecraft.network.packet.c2s.play.HandSwingC2SPacket
      )
      .unregister();
  }
}

new Pingless();
