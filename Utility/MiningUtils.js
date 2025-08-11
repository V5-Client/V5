//let { S2DPacketOpenWindow, chat, Blocks, TimeHelper, mcMobs, MathUtils, ItemObject, S30PacketWindowItems, Utils, InventoryUtils, ItemUtils } = global.export

import { Prefix } from "./Prefix";
import { Timers } from "./Timing";
import { MathUtils } from "./Math";
import { ItemObject } from "./DataClasses/ItemObject";
import { Utils } from "./Utils";
import { Guis } from "./Inventory";
import { Keybind } from "./Keybinding";
import { Flowstate } from "./Flowstate";

class MiningUtilClass {
  constructor() {
    this.miningSpeed = "" || null;

    register("command", () => {
      this.getMiningStats();
      //this.getMiningSpeed();
    }).setName("getminingstats");
  }

  /**
   * @function getMiningStats returns all necessary stats for other scripts.
   */
  getMiningStats() {
    Prefix.message("Getting your Mining Data!");
    new Thread(() => {
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

      this.coldRes = getFirstMatchFromLore(23, /\+(\d+(\.\d+)?)/);

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
      Prefix.message(`Cold Resistance: &e${this.coldRes}`);
      Prefix.message(`HOTM Level: &e${this.hotm}`);
      Prefix.message(`COTM: ${cotmcolor}${this.cotm}`);
      Prefix.message(`Max Great Explorer: ${solvercolor}${this.maxSolver}`);

      Utils.writeConfigFile("miningstats.json", {
        speed: this.miningSpeed,
        professional: this.professional,
        strongarm: this.strongArm,
        coldres: this.coldRes,
        hotm: this.hotm,
        cotm: this.cotm,
        maxge: this.maxSolver,
      });
    }).start();
  }

  /**
   * @function getMiningSpeed Returns your mining speed for an island
   * @param {*} Area  Checks wether you're in Crystal Hollows to add Professional
   */
  getMiningSpeed(Area = Utils.area()) {
    let file = Utils.getConfigFile("miningstats.json");
    if (!file) return;
    let Speed = file.speed;
    let Professional = file.professional;

    if (!Speed) {
      Prefix.message(
        "You have not saved your mining stats! use /getminingstats"
      );
      return;
    }

    if (Area === "Crystal Hollows") {
      this.savedSpeed = Speed + Professional;
    } else {
      this.savedSpeed = Speed;
    }

    return this.savedSpeed;
  }

  // GE max
  // Refuel
  // the other one

  getMineTime(MiningSpeed, SpeedBoost, pos) {
    let Block = World.getBlockAt(pos);
    let BlockID = Block.type.getID();
    let Speed = MiningSpeed + Flowstate.CurrentFlowstate();
    let MiningOffset = 0;

    if (!this.cotm && SpeedBoost) {
      Speed *= 2;
    } else if (SpeedBoost) {
      Speed *= 2.5;
    }

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
      479: { hardness: 5200 }, // Aquamarine
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

      /* Gems (Blocks) */
      // Tunnels
      296: { hardness: 5200 }, // Aquamarine
      297: { hardness: 5200 }, // Citrine
      298: { hardness: 5200 }, // Peridot
      300: { hardness: 5200 }, // Onyx
      // Crystal Hollows
      287: { hardness: 4800 }, // Jasper
      289: { hardness: 3800 }, // Topaz
      286: { hardness: 3000 }, // Amber
      295: { hardness: 3000 }, // Amethyst
      290: { hardness: 3000 }, // Jade
      288: { hardness: 3000 }, // Sapphire
      299: { hardness: 2300 }, // Ruby

      // Gold
      173: { hardness: 600 },
    };

    if (blockdata[BlockID].hardness) {
      const { hardness } = blockdata[BlockID];
      return this.returnSpeed(
        Math.round((hardness * 30) / Speed),
        MiningOffset
      );
    }

    // unknown block `panic`
    this.returnSpeed(100, MiningOffset);
  }

  /**
   * @function returnSpeed
   * @description Helper function to calculate the final mining speed based on ticks and offset.
   * @param {number} Ticks - The base mining time in ticks.
   * @param {number} Offset - An offset to be applied to the mining time.
   * @returns {number} The adjusted mining time, with a minimum of 4 ticks.
   */
  returnSpeed(Ticks, Offset) {
    return Math.max(4, Ticks + Offset);
  }

  inCamp() {
    return Player.getZ() > 185 && Utils.area() === "Dwarven Mines";
  }

  /**
   * @function getDebuff Returns your current heat or cold or 0 if null
   * @param {*} type The type of debuff you want to get - "heat" or "cold"
   */
  getDebuff(type) {
    const symbols = {
      cold: "❄",
      heat: "♨",
    };

    let symbol = symbols[type.toLowerCase()];
    if (!symbol) return 0;

    let lines = Scoreboard.getLines();

    for (let i = 0; i < lines.length; i++) {
      let str = String(lines[i]);
      if (str.indexOf(symbol) !== -1) {
        let clean = str.replace(/§[0-9A-FK-OR]/gi, "");

        let regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${symbol}`);

        let match = clean.match(regex);
        if (match) {
          return match[1];
        }
      }
    }
    return 0; // not found
  }

  getSpeedWithCold() {
    let baseSpeed = this.savedSpeed ?? this.getMiningSpeed();
    let baseCold = Utils.getConfigFile("miningstats.json");
    if (!baseCold) return;
    this.savedColdRes = baseCold.coldres;

    let cold = this.getDebuff("cold");
    let effectiveCold = cold - this.savedColdRes;

    if (effectiveCold > 0) {
      let reductionPercent = effectiveCold / 2;
      if (reductionPercent > 100) reductionPercent = 100;

      return Number((baseSpeed * (1 - reductionPercent / 100)).toFixed());
    } else {
      return baseSpeed;
    }
  }
}

export const MiningUtils = new MiningUtilClass();
