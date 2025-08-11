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
      this.getMiningStats();
    }).setName("getminingstats");
  }

  /**
   * @function getMiningStats returns all necessary stats for other scripts.
   */
  getMiningStats() {
    Prefix.message("Getting your Mining Data!");
    new Thread(() => {
      // todo force drill when function added + if player.getcontainer !== sb menu etc + get item ability
      function getItemLore(slot) {
        return Player.getContainer().getStackInSlot(slot).getLore();
      }

      function getFirstMatchFromLore(slot, regex) {
        let lore = getItemLore(slot);
        for (let line of lore) {
          const cleanLine = ChatLib.removeFormatting(line.toString());
          const match = cleanLine.match(regex);
          if (match) {
            let value = match[1].replace(/,/g, "");
            return value.includes(".") ? parseFloat(value) : parseInt(value);
          }
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

      let lore = Player.getHeldItem()
        .getLore()
        .map((l) => ChatLib.removeFormatting(l))
        .join(" ");
      let match = lore.match(/lapidary\s*(i{1,3}|iv|v)/i);
      let bonus = match
        ? { I: 1, II: 2, III: 3, IV: 4, V: 5 }[match[1].toUpperCase()] * 20
        : 0;

      if (match) {
        this.professional += bonus;
        Prefix.message(`Lapidary Speed: +${bonus}`);
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
        speed: this.miningSpeed,
        professional: this.professional,
        strongarm: this.strongArm,
        hotm: this.hotm,
        cotm: this.cotm,
        maxge: this.maxSolver,
      });
    }).start();
  }

  // GE max
  // Refuel
  // the other one

  getMineTime() {
    const blockdata = {
      /* BlockID : hardness */

      /* Mithril */
      5: { hardness: 2000 }, // Titanium
      143: { hardness: 1500 }, // Blue Wool Mithril
      495: { hardness: 800 }, // Prismarine Mithril
      461: { hardness: 500 }, // Cyan Terracotta Mithril
      147: { hardness: 500 }, // Gray Wool Mithril

      /* Tunnels */
      524: { hardness: 6000 }, // Glacite
      268: { hardness: 5600 }, // Tungsten Clay
      318: { hardness: 5600 }, // Tungsten Cobble
      464: { hardness: 5600 }, // Umber Brown Terracotta
      595: { hardness: 5600 }, // Umber Smooth Red Sandstone
      522: { hardness: 5600 }, // Umber Terracotta

      /* Gems (Panes) */
      // Tunnels
      479: { hardness: 5200 }, // AquaMarine
      480: { hardness: 5200 }, // Citrine
      481: { hardness: 5200 }, // Peridot
      483: { hardness: 5200 }, // Onyx
      // Crystal Hollows
      470: { hardness: 4800 }, // Jasper
      472: { hardness: 3800 }, // Topaz
      469: { hardness: 3000 }, // Amber
      478: { hardness: 3000 }, // Amethyst
      473: { hardness: 3000 }, // Jade
      471: { hardness: 3000 }, // Sapphire
      482: { hardness: 2300 }, // Ruby
    };
  }
}

export const MiningUtils = new MiningUtilClass();
