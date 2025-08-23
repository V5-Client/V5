import RendererMain from "../Rendering/RendererMain";
import { Rotations } from "../Utility/Rotations";

class MiningBot {
  constructor() {
    this.foundLocations = [];

    this.prioritizetitanium = true;
    this.prioritizetitanium ? 1 : 5;

    this.mithrilCosts = {
      "minecraft:polished_diorite": this.prioritizetitanium,
      "minecraft:light_blue_wool": 3,
      "minecraft:prismarine": 5,
      "minecraft:prismarine_bricks": 5,
      "minecraft:dark_prismarine": 5,
      "minecraft:gray_wool": 7,
      "minecraft:cyan_terracotta": 7,
    };

    this.TYPES = {
      MININGBOT: 0,
      COMMISSION: 1,
      GEMSTONE: 2,
      ORE: 3,
      TUNNEL: 4,
    };
  }

  scanForBlock(target, specific = true) {
    this.foundLocations = [];
    let playerX = Math.floor(Player.getX());
    let playerY = Math.floor(Player.getY());
    let playerZ = Math.floor(Player.getZ());

    let foundBlock = false;

    for (let x = playerX - 5; x <= playerX + 5; x++) {
      for (let y = playerY - 5; y <= playerY + 5; y++) {
        for (let z = playerZ - 5; z <= playerZ + 5; z++) {
          let block = World.getBlockAt(x, y, z);
          let blockName = block?.type?.getRegistryName();

          let isTargetBlock = false;
          if (specific) {
            isTargetBlock = target.hasOwnProperty(blockName);
          } else {
            isTargetBlock = Object.keys(target).includes(blockName);
          }

          if (isTargetBlock) {
            foundBlock = true;

            let distance =
              Math.abs(x - playerX) +
              Math.abs(y - (playerY + 1.95)) + // rough distance of eyes (i think and fix this)
              Math.abs(z - playerZ);

            let totalCost = target[blockName] + distance;

            this.foundLocations.push({
              x: x,
              y: y,
              z: z,
              cost: totalCost,
            });
          }
        }
      }
    }

    if (!foundBlock) {
      ChatLib.chat("no found");
    } else {
      ChatLib.chat("Scan complete");
    }
  }
}

// debugging
const bot = new MiningBot();

register("command", () => bot.scanForBlock(bot.mithrilCosts)).setName("scan");

register("postRenderWorld", () => {
  if (bot.foundLocations.length > 0) {
    bot.foundLocations.forEach((loc) => {
      const Color = Java.type("java.awt.Color");
      let waypointColor;

      let lowestCostBlock = [...bot.foundLocations].sort(
        (a, b) => a.cost - b.cost
      )[0];

      Rotations.rotateTo([
        lowestCostBlock.x,
        lowestCostBlock.y,
        lowestCostBlock.z,
      ]);

      const MIN_POSSIBLE_COST = 1;
      const MAX_POSSIBLE_COST = 17; // idk

      let normalizedCost =
        (loc.cost - MIN_POSSIBLE_COST) /
        (MAX_POSSIBLE_COST - MIN_POSSIBLE_COST);

      normalizedCost = Math.max(0, Math.min(1, normalizedCost));

      const red = normalizedCost;
      const green = 1 - normalizedCost;
      const blue = 0;

      waypointColor = new Color(red, green, blue, 1);

      RendererMain.drawWaypoint(
        new Vec3i(loc.x, loc.y, loc.z),
        true,
        waypointColor
      );
    });
  }
});
