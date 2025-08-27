import RendererMain from "../Rendering/RendererMain";
import { MiningUtils } from "../Utility/MiningUtils";
import { Rotations } from "../Utility/Rotations";
import { Utils } from "../Utility/Utils";

class MiningBot {
  constructor() {
    this.foundLocations = [];

    /* Settings */
    this.PRIOTITA = true;
    this.PRIOTITA ? 1 : 5;

    this.TICKGLIDE = true;

    this.mithrilCosts = {
      "minecraft:polished_diorite": this.PRIOTITA,
      "minecraft:light_blue_wool": 3,
      "minecraft:prismarine": 5,
      "minecraft:prismarine_bricks": 5,
      "minecraft:dark_prismarine": 5,
      "minecraft:gray_wool": 7,
      "minecraft:cyan_terracotta": 7,
    };

    this.gemstoneCosts = {
      "minecraft:orange_stained_glass": 4,
      "minecraft:orange_stained_glass_pane": 5,
      "minecraft:purple_stained_glass": 4,
      "minecraft:purple_stained_glass_pane": 5,
      "minecraft:lime_stained_glass": 4,
      "minecraft:lime_stained_glass_pane": 5,
      "minecraft:magenta_stained_glass": 4,
      "minecraft:magenta_stained_glass_pane": 5,
      "minecraft:red_stained_glass": 4,
      "minecraft:red_stained_glass_pane": 5,
      "minecraft:light_blue_stained_glass": 4,
      "minecraft:light_blue_stained_glass_pane": 5,
      "minecraft:yellow_stained_glass": 4,
      "minecraft:yellow_stained_glass_pane": 5,
    };

    this.STATES = {
      WAITING: 0,
      MINING: 1,
      ABILITY: 2,
      BUFF: 3,
      REFUEL: 4,
    };
    this.state = this.STATES.WAITING;

    this.TYPES = {
      MININGBOT: 0,
      COMMISSION: 1,
      GEMSTONE: 2,
      ORE: 3,
      TUNNEL: 4,
    };
    this.type = this.TYPES.MININGBOT;

    this.Enabled = false;

    register("tick", () => {});
  }

  scanForBlock(target, specific = true) {
    this.foundLocations = [];
    let startX = Math.floor(Player.getX());
    let startY = Math.floor(Player.getY());
    let startZ = Math.floor(Player.getZ());
    let distance = 4;
    let foundBlock = false;

    let queue = [{ x: startX, y: startY, z: startZ, dist: 0 }];
    let visited = new Set();
    visited.add(`${startX},${startY},${startZ}`);

    let directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    while (queue.length > 0) {
      let { x, y, z, dist } = queue.shift();

      if (dist > distance) continue;

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
        let totalCost = target[blockName] + dist;
        this.foundLocations.push({
          x: x,
          y: y,
          z: z,
          cost: totalCost,
        });
      }

      if (dist < distance) {
        for (let i = 0; i < directions.length; i++) {
          let [dx, dy, dz] = directions[i];
          let nextX = x + dx;
          let nextY = y + dy;
          let nextZ = z + dz;
          let nextKey = `${nextX},${nextY},${nextZ}`;

          if (!visited.has(nextKey)) {
            visited.add(nextKey);
            queue.push({ x: nextX, y: nextY, z: nextZ, dist: dist + 1 });
          }
        }
      }
    }

    if (!foundBlock) {
      ChatLib.chat("no found");
    } else {
      this.foundLocations.sort((a, b) => a.cost - b.cost);
      this.currentTarget = this.foundLocations[0];
      ChatLib.chat("Scan complete");
    }
  }
}

// debugging
const bot = new MiningBot();

register("command", () => {
  bot.scanForBlock(bot.mithrilCosts);
  let speed = Utils.getConfigFile("miningstats.json");
  if (speed) {
    ChatLib.chat(speed.speed);
  }
}).setName("scan");

register("postRenderWorld", () => {
  if (bot.foundLocations.length > 0) {
    const Color = java.awt.Color;

    let sortedLocations = [...bot.foundLocations].sort(
      (a, b) => a.cost - b.cost
    );

    let lowestCostBlock = sortedLocations[0];
    let nextCostBlock = sortedLocations[1];

    if (lowestCostBlock) {
      RendererMain.drawWaypoint(
        new Vec3i(lowestCostBlock.x, lowestCostBlock.y, lowestCostBlock.z),
        true,
        new Color(0, 1, 0, 1) // green
      );
    }

    if (nextCostBlock) {
      RendererMain.drawWaypoint(
        new Vec3i(nextCostBlock.x, nextCostBlock.y, nextCostBlock.z),
        true,
        new Color(1, 0, 0, 1) // red
      );
    }
  }
});
