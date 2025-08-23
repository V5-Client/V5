//let { S2DPacketOpenWindow, chat, Blocks, TimeHelper, mcMobs, MathUtils, ItemObject, S30PacketWindowItems, Utils, InventoryUtils, ItemUtils } = global.export

import { Chat } from "./Chat";
//import { Timers } from "./Timing";
import { MathUtils } from "./Math";
import { ItemObject } from "./DataClasses/ItemObject";
import { Utils } from "./Utils";
import { Guis } from "./Inventory";
import { Keybind } from "./Keybinding";
import { Flowstate } from "./Flowstate";
import { registerEventSB } from "./SkyblockEvents";

const blockHardness = {
  /* Mithril */
  5: 2000, // Titanium
  143: 1500, // Blue Wool Mithril
  495: 800, // Prismarine Mithril
  461: 500, // Cyan Terracotta Mithril
  147: 500, // Gray Wool Mithril
  /* Tunnels */
  524: 6000, // Glacite
  268: 5600, // Tungsten Clay
  318: 5600, // Tungsten Cobble
  464: 5600, // Umber Brown Terracotta
  595: 5600, // Umber Smooth Red Sandstone
  522: 5600, // Umber Terracotta
  /* Gems (Panes) */
  479: 5200, // Aquamarine
  480: 5200, // Citrine
  481: 5200, // Peridot
  483: 5200, // Onyx
  470: 4800, // Jasper
  472: 3800, // Topaz
  469: 3000, // Amber
  478: 3000, // Amethyst
  473: 3000, // Jade
  471: 3000, // Sapphire
  482: 2300, // Ruby
  /* Gems (Blocks) */
  296: 5200, // Aquamarine
  297: 5200, // Citrine
  298: 5200, // Peridot
  300: 5200, // Onyx
  287: 4800, // Jasper
  289: 3800, // Topaz
  286: 3000, // Amber
  295: 3000, // Amethyst
  290: 3000, // Jade
  288: 3000, // Sapphire
  299: 2300, // Ruby
  // Gold
  173: 600,
};

class MiningUtilClass {
  constructor() {
    this.miningSpeed = "" || null;

    register("command", () => {
      this.RetreiveStats();
    }).setName("getminingstats");
  }

  RetreiveStats() {
    const drill = this.getDrills().drill;
    Player.setHeldItemIndex(drill.slot);

    Chat.message("Getting your Mining Data!");
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

      Thread.sleep(500);
      ChatLib.command("sbmenu");
      Thread.sleep(1000);
      this.miningSpeed = getFirstMatchFromLore(
        13,
        /Mining Speed\s{0,7}([\d,]+(\.\d+)?)/i
      );

      // Open HOTM Menu
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
      this.maxSolver = parseInt(this.solver) === 96; // get max percentage instead

      Guis.closeInv();

      let lore = Player.getHeldItem().getLore().toString();
      let match = lore.match(/lapidary\s*(i{1,3}|iv|v)/i);
      let bonus = match
        ? { I: 1, II: 2, III: 3, IV: 4, V: 5 }[match[1].toUpperCase()] * 20
        : 0;

      if (match) {
        this.professional += bonus;
        Chat.message(`Lapidary Speed: +${bonus}`);
      }

      let cotmcolor = this.cotm ? "&a" : "&c";
      let solvercolor = this.maxSolver ? "&a" : "&c";

      Chat.message(`Your Mining Data:`);
      Chat.message(`Mining Speed: &e${this.miningSpeed}`);
      Chat.message(`Professional: &e${this.professional}`);
      Chat.message(`Strong Arm: &e${this.strongArm}`);
      Chat.message(`Cold Resistance: &e${this.coldRes}`);
      Chat.message(`HOTM Level: &e${this.hotm}`);
      Chat.message(`COTM: ${cotmcolor}${this.cotm}`);
      Chat.message(`Max Great Explorer: ${solvercolor}${this.maxSolver}`);

      // Save stats
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
   * @function doRefueling Refuels drill during a macro
   * @param {*} isComm Special type of refuel for commission macro
   * @param {*} success Allows for the macro to carry on or stop if a problem occurs
   * @returns a refueled drill
   */
  doRefueling(isComm = false, success) {
    new Thread(() => {
      if (!isComm) {
        this.abiphone = Guis.findItemInHotbar("Abiphone");
        if (this.abiphone === -1) {
          Chat.message("Unable to refuel without Abiphone!");
          return success(false);
        }

        Player.setHeldItemIndex(this.abiphone);
        Thread.sleep(250);
        Keybind.rightClick();

        Thread.sleep(1000);
        if (!Guis.guiName()?.includes("Abiphone")) {
          Chat.message("Took too long to open the Abiphone!");
          return success(false);
        }

        this.Jotraeline = Guis.findFirst(
          Player.getContainer(),
          "Jotraeline Greatforge"
        );
        if (this.Jotraeline === -1) {
          Chat.message("You don't have Jotraeline as a contact!");
          return success(false);
        }
        Guis.clickSlot(this.Jotraeline);

        waited = 0;
        while (Guis.guiName() !== "Drill Anvil" && waited < 5000) {
          Thread.sleep(50);
          waited += 50;
        }

        if (waited >= 5000) {
          Chat.message("Took too long to open Drill Anvil!");
          return success(false);
        }

        if (Guis.guiName() === "Drill Anvil") {
          Thread.sleep(1000);
          let Drills = this.getDrills().drill;
          Guis.clickSlot(Drills.slot + 81, true); // retarded method 💀

          let container = Player.getContainer();

          if (container.getStackInSlot(29)) {
            Thread.sleep(500);
            let fuels = ["Volta", "Oil Barrel", "Biofuel"];
            let clickFuel = Guis.clickItems(fuels, true);

            if (!clickFuel) {
              Chat.message("You have no fuel in your inventory!");
              Thread.sleep(500);
              Guis.clickSlot(29, true); // weird bug where the close function ghosts your drill
              Thread.sleep(500);
              Guis.closeInv();
              return success(false);
            }
          }

          if (container.getStackInSlot(29) && container.getStackInSlot(33)) {
            Thread.sleep(500);
            Guis.clickSlot(22, false);
            Thread.sleep(750);
            Guis.clickSlot(13, true);
            Thread.sleep(500);
            Guis.closeInv();
          }
        } else {
          Chat.message("Failed to open Drill Anvil!");
          return success(false);
        }
        return success(true);
      }
    }).start();
  }

  MaxGreatExplorer(success) {
    new Thread(() => {
      register("chat", (event) => {
        let msg = event.message.getString();

        if (msg.startsWith("You must first unlock")) {
          Thread.sleep(300);
          Chat.message("Great Explorer can't be enabled!");
          Guis.closeInv();
          return success(false);
        }

        if (msg.includes("You don't have enough Gemstone Powder!")) {
          Thread.sleep(300);
          Chat.message("You don't have enough powder to max Great Explorer!");
          Guis.closeInv();
          return success(false);
        }
      });

      let file = Utils.getConfigFile("miningstats.json");

      if (file.maxge) {
        Chat.message("Great Explorer is maxed from last stat check!");
        return success(true);
      } else if (file.maxge === undefined) {
        Chat.message("Great Explorer stat is undefined! Run /getminingstats");
        return success(false);
      }

      ChatLib.command("hotm");
      Thread.sleep(1000);

      if (Guis.guiName() !== "Heart of the Mountain") {
        Chat.message("Took too long to open Heart of The Mountain!");
        return success(false);
      }

      Guis.clickSlot(8, false, "RIGHT");
      Thread.sleep(1000);

      while (Guis.guiName() === "Heart of the Mountain") {
        Thread.sleep(500);
        let slot = Player.getContainer()?.getStackInSlot(42);
        if (!slot) continue;

        let nbt = slot.getNBT().toString();
        if (nbt.includes("item.minecraft.coal")) {
          Guis.clickSlot(42, false); // Normal click for coal
        } else if (nbt.includes("item.minecraft.emerald")) {
          Guis.clickSlot(42, true); // Shift-click for emerald
        }
      }

      return success(true);
    }).start();
  }

  /**
   * @function getMiningSpeed Returns your mining speed for an island
   * @param {*} Area  Checks what island you're in
   * @returns Total Speed with additional Professional if in crystalHollows
   */
  getMiningSpeed(Area = Utils.area()) {
    let file = Utils.getConfigFile("miningstats.json");
    if (!file) return;
    let Speed = file.speed;
    let Professional = file.professional;

    if (!Speed) {
      Chat.message("You have not saved your mining stats! use /getminingstats");
      return;
    }

    if (Area === "Crystal Hollows") {
      this.savedSpeed = Speed + Professional;
    } else {
      this.savedSpeed = Speed;
    }

    // add bettertogether speed

    return this.savedSpeed;
  }

  /**
   * @function getMineTime Calculates the time it takes to mine a specific block.
   * @param {number} MiningSpeed - The player's current mining speed.
   * @param {BlockPos} pos - The position of the block to be mined.
   * @param {boolean} SpeedBoost - Indicates if a speed boost is active.
   * @returns {number} The time in ticks required to mine the block.
   */
  getMineTime(MiningSpeed, SpeedBoost, pos) {
    let Block = World.getBlockAt(pos);
    let BlockID = Block.type.getID();
    let Speed = MiningSpeed + Flowstate.CurrentFlowstate();
    let MiningOffset = 0;

    if (!this.cotm && SpeedBoost) {
      Speed *= 3;
    } else if (SpeedBoost) {
      Speed *= 3.5;
    }

    const hardness = blockHardness[BlockID];
    if (hardness) {
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

  getDrills() {
    const drillNames = [
      { name: "Pickonimbus", drill: false },
      { name: "Drill", drill: true },
      { name: "Gauntlet", drill: true },
      { name: "Mithril Pickaxe", drill: false },
      { name: "Titanium Pickaxe", drill: false },
      { name: "Iron Pickaxe", drill: false },
      { name: "Eon Pickaxe", drill: false },
      { name: "Chrono Pickaxe", drill: false },
    ];

    let blueCheese = null;
    let drill = null;

    for (let i = 0; i <= 7; i++) {
      const item = Player.getInventory().getStackInSlot(i);
      if (!item) continue;

      const itemInstance = new ItemObject(item, i);
      const itemName = item.getName().removeFormatting();

      const drillName = drillNames.find((d) => itemName.includes(d.name));
      if (!drillName) continue;

      if (drillName.drill) {
        const loreHasBlueCheese = item
          .getLore()
          .some((loreLine) =>
            loreLine.toString().replace(/§./g, "").includes("Blue Cheese")
          );
        if (loreHasBlueCheese) {
          blueCheese = itemInstance;
          continue;
        }
        drill = itemInstance;
        break;
      } else if (!drill) {
        drill = itemInstance;
      }
    }

    if (!drill) {
      drill = blueCheese;
    }

    if (!drill) {
      Chat.message("Missing a mining item");
    }

    return { blueCheese, drill };
  }

  inCamp() {
    return Player.getZ() > 185 && Utils.area() === "Dwarven Mines";
  }

  /**
   * @function getDebuff Returns your current heat or cold or 0 if null
   * @param {*} type The type of debuff you want to get - "heat" or "cold"
   * @returns amount of debuff you have from that type
   */
  getDebuff(type) {
    const symbols = {
      cold: "❄",
      heat: "♨",
    };

    const symbol = symbols[type.toLowerCase()];
    if (!symbol) return 0;

    const line = Scoreboard.getLines().find((line) =>
      String(line).includes(symbol)
    );

    if (line) {
      const clean = ChatLib.removeFormatting(String(line));
      const match = clean.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${symbol}`));
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return 0;
  }

  /**
   * @function getSpeedWithCold Calculates Miningspeed after calculating cold res against speed
   * @returns your affected mining speed after calculating total cold reduction
   */
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
