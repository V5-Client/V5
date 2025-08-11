//let { S2DPacketOpenWindow, chat, Blocks, TimeHelper, mcMobs, MathUtils, ItemObject, S30PacketWindowItems, Utils, InventoryUtils, ItemUtils } = global.export

import { Prefix } from "./Prefix";
import { Timers } from "./Timing";
import { MathUtils } from "./Math";
import { ItemObject } from "./DataClasses/ItemObject";
import { Utils } from "./Utils";
import { Guis } from "./Inventory";
import { Keybind } from "./Keybinding";

class MiningUtilClass {
  constructor() {
    this.miningSpeed = "" || null;

    register("command", () => {
      Prefix.message("Getting your Mining Data!");
      new Thread(() => {
        // todo force drill when function added + if player.getcontainer !== sb menu etc
        function getItemLore(slot) {
          return Player.getContainer().getStackInSlot(slot).getLore();
        }

        function getFirstMatchFromLore(slot, regex) {
          let lore = getItemLore(slot);
          for (let line of lore) {
            const cleanLine = ChatLib.removeFormatting(line.toString());
            const match = cleanLine.match(regex);
            if (match) return match[1];
          }
          return null;
        }

        ChatLib.command("sbmenu");
        Thread.sleep(1000);
        this.miningSpeed = getFirstMatchFromLore(
          13,
          /Mining Speed\s{0,7}([\d,]+(\.\d+)?)/i
        );

        ChatLib.command("hotm");
        Thread.sleep(1000);
        this.hotm = getFirstMatchFromLore(4, /Level\s{0,2}(\d+)/);
        this.cotm = parseInt(this.hotm) === 10;

        this.professional = getFirstMatchFromLore(12, /\+(\d+(\.\d+)?)/);

        Guis.clickSlot(8, false, "RIGHT");
        Thread.sleep(1000);

        this.strongArm = getFirstMatchFromLore(21, /\+(\d+(\.\d+)?)/);

        this.solver = getFirstMatchFromLore(42, /\+(\d+(\.\d+)?)/);
        this.maxSolver = parseInt(this.solver) === 20;

        Guis.closeInv();

        if (
          Player.getHeldItem()
            .getEnchantments()
            .entrySet()
            .stream()
            .filter((e) => e.toString().includes("lapidary"))
        ) {
          this.professional += " + 100";
          Prefix.message("Lapidary Speed Boost: +100");
        }

        let cotmcolor = this.cotm ? "&a" : "&c";
        let solvercolor = this.maxSolver ? "&a" : "&c";

        Prefix.message(`Your Mining Data:`);
        Prefix.message(`Mining Speed: &e${this.miningSpeed}`);
        Prefix.message(`Professional: &e${this.professional}`);
        Prefix.message(`Strong Arm: &e${this.strongArm}`);
        Prefix.message(`HOTM Level: &e${this.hotm}`);
        Prefix.message(`COTM: ${cotmcolor}${this.cotm}`);
        Prefix.message(`Max Great Explorer: ${solvercolor}${this.maxSolver}`);

        Utils.writeConfigFile("miningstats.json", {
          speed: `${this.miningSpeed}`,
          professional: `${this.professional}`,
          strongarm: `${this.strongArm}`,
          hotm: `${this.hotm}`,
          cotm: `${this.cotm}`,
          maxge: `${this.maxSolver}`,
        });
      }).start();
    }).setName("getminingstats");
  }
}

export const MiningUtils = new MiningUtilClass();
