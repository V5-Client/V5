import { NukerUtils } from "../Utility/NukerUtils";
import { Chat } from "../Utility/Chat";
import { Utils } from "../Utility/Utils"
const BP = net.minecraft.util.math.BlockPos

class NukerClass {
  constructor() {
    this.ModuleName = "Nuker";
    this.Enabled = false;

    this.target = null;
    this.lastTime = 0;
    this.lastChestClick = {};
    this.minedBlocks = new Map();
    this.clickQueue = new Set();
    this.chestClickedThisTick = false;
    this.startTime = Date.now();

    this.BLOCK_COOLDOWN = 1000;
    this.REQUIRED_ITEMS = ["Drill", "Gauntlet", "Pick"];

    this.lastNukeTime = Date.now();

    this.customBlockID = 0;
    this.customBlockList = [];

    // settings
    this.blockType = "Custom"
    this.nukeBelow = false
    this.onGroundOnly = false
    this.autoChest = false
    this.heightLimit = 5

    register("command", () => {
      this.toggle()
    }).setName("NukerToggle")

    register("command", (ticks = 1) => {
      let block = Player.lookingAt();

      if (block.getClass() === Block) {
        let pos = [block.getX(), block.getY(), block.getZ()];
        Chat.debugMessage("Nuking " + block.type.getRegistryName() + " at " + pos);
        NukerUtils.nuke(pos, ticks);
      }
    }).setCommandName("nukeit");

    register("command", () => {
      let block = Player.lookingAt();
      if (block.getClass() === Block) {
        const newBlock = { name: block.type.getName(), id: block.type.getID() };
        if (!this.customBlockList.some((b) => b.id === newBlock.id)) {
          this.customBlockList.push(newBlock);
          Chat.message("Added " + block.type.getName() + " to custom nuker list.");
        } else {
          Chat.message("Block already in custom nuker list.");
        }
      } else {
        Chat.message("Look at a block to add it");
      }
    }).setCommandName("nukeradd");

    register("command", (id) => {
      if (id === undefined) {
        Chat.message("Usage: /nukerremove <id>");
        return;
      }
      let initialLength = this.customBlockList.length;
      this.customBlockList = this.customBlockList.filter((block) => !(block.id === parseInt(id)));
      if (this.customBlockList.length < initialLength) {
        Chat.message("Removed block(s) from custom nuker list.");
      } else {
        Chat.message("Block not found in custom nuker list.");
      }
    }).setCommandName("nukerremove");

    register("command", () => {
      this.customBlockList = [];
      Chat.message("Cleared custom nuker list.");
    }).setCommandName("nukerclear");

    register("command", () => {
      if (this.customBlockList.length === 0) {
        Chat.message("Custom nuker list is empty.");
        return;
      }
      Chat.message("Custom Nuker List:");
      this.customBlockList.forEach((block) => {
        Chat.message(`Name: ${block.name} - ID: ${block.id}`);
      });
    }).setCommandName("nukerlist");

    register("worldUnload", () => {
      if (!this.Enabled) return;

      this.toggle();
      Chat.debugMessage(this.ModuleName + ": &cDisabled due to world change");
    });

    register("tick", () => {
      if (!this.Enabled) return;

      if (!this.isHoldingRequiredItem()) return;
      if (Client.isInGui() && !Client.isInChat()) return;
      if (Client.getKeyBindFromDescription("key.attack").isKeyDown()) return;
      if (!this.onGround()) return;
      if (Date.now() - this.lastTime < 0 * 50) return; // delay (0)

      this.lastTime = Date.now();
      this.chestClickedThisTick = false;

      for (const [pos, time] of this.minedBlocks) {
        if (Date.now() - time > this.BLOCK_COOLDOWN) {
          this.minedBlocks.delete(pos);
        }
      }

      let playerX = Math.floor(Player.getX());
      let playerY = Math.floor(Player.getY());
      let playerZ = Math.floor(Player.getZ());

      let validBlocks = [];

      new Thread(() => {
        for (let x = playerX - 5; x <= playerX + 5; x++) {
          for (let y = playerY - (this.nukeBelow ? 0 : 5); y <= playerY + this.heightLimit; y++) {
            for (let z = playerZ - 5; z <= playerZ + 5; z++) {
              let pos = new BlockPos(x, y, z);
              if (this.nukeBelow && y < playerY) continue;
              if (this.minedBlocks.has(pos.toString())) continue;
              if (this.distance(this.cords(), [x, y, z]).distance > 4.5) continue;

              let block = World.getBlockStateAt(new BlockPos(x, y, z)).getBlock();
              let isValidBlock = false;
              if (this.blockType === "Crystal Hollows") {
                let blockA = World.getBlockAt(x, y, z);
                isValidBlock = block instanceof net.minecraft.block.BlockStone || block instanceof net.minecraft.block.BlockOre || block instanceof net.minecraft.block.BlockRedstoneOre || blockA.type.getID() == 4;
              } else if (this.blockType === "Custom") {
                let block = World.getBlockAt(x, y, z);
                isValidBlock = this.customBlockList.some((customBlock) => block.type.getID() === customBlock.id);
              }

              if (isValidBlock) {
                validBlocks.push(pos);
              }
            }
          }
        }

        if (validBlocks.length > 0) {
          let targetPos = validBlocks[Math.floor(Math.random() * validBlocks.length)];

          NukerUtils.nuke([targetPos.x, targetPos.y, targetPos.z]);

          this.target = targetPos;
          this.minedBlocks.set(targetPos.toString(), Date.now());
        }
      }).start();
    });

/*     const nukeHighlight = register("renderWorld", () => {
      if (!this.Enabled) return;
      if (this.target) {
        this.renderRGB([this.target.getX(), this.target.getY(), this.target.getZ()], [255, 255, 255]);
      }
    });

    const chestHighlight = register("renderTileEntity", (entity) => {
      if (Client.isInGui() && !Client.isInChat()) return;
      if (!this.isHoldingRequiredItem()) return;

      if (entity?.getBlockType() != null && entity?.getBlockType()?.getID() === 54) {
        const chest = entity?.getBlock()?.pos;
        if (!chest) return;

        const pos = `${chest.x},${chest.y},${chest.z}`;

        if (this.clickQueue.has(pos)) return; // Skip if already queued
        if (this.distance(this.cords(), [chest.x, chest.y, chest.z]).distance > 6) return;

        if (!this.chestClickedThisTick && (!this.lastChestClick[pos] || Date.now() - this.lastChestClick[pos] > Math.floor(Math.random() * 50) + 50)) {
          this.clickQueue.add(pos);
          this.rightClickBlock([chest.x, chest.y, chest.z]);
          Client.sendPacket(new net.minecraft.network.play.client.C0APacketAnimation());
          this.lastChestClick[pos] = Date.now();
          this.chestClickedThisTick = true;
        }
      }
    }); */
  }

  isHoldingRequiredItem() {
    if (this.blockType === "Crystal Hollows") {
      this.REQUIRED_ITEMS = ["Drill", "Gauntlet", "Pick"];
    } else if (this.blockType === "Custom") {
      return true;
    }

    let heldItem = Player.getHeldItem();
    if (!heldItem) return false;
    return this.REQUIRED_ITEMS.some((item) => heldItem.getName().toLowerCase().includes(item.toLowerCase()));
  }

  distance(from, to) {
    const diffX = from[0] - to[0];
    const diffY = from[1] - to[1];
    const diffZ = from[2] - to[2];
    const distanceFlat = Math.sqrt(diffX * diffX + diffZ * diffZ);
    const distance = Math.sqrt(distanceFlat * distanceFlat + diffY * diffY);
    return { distance, distanceFlat, distanceY: Math.abs(diffY) };
  }

  onGround() {
    if (!this.onGroundOnly) return true;
    return Player.asPlayerMP().isOnGround();
  }

  cords() {
    let eyeVector = Utils.convertToVector(Player.asPlayerMP().getEyePosition(1));
    return [eyeVector.x, eyeVector.y, eyeVector.z];
  }

  renderRGB(location, rgb = [1, 1, 1], alpha = 0.3, full = true) {
    let time = Date.now() / 1000;
    let r = Math.sin(time) * 127 + 128;
    let g = Math.sin(time + 2) * 127 + 128;
    let b = Math.sin(time + 4) * 127 + 128;

    if (!full) {
      RenderLibV2J.drawEspBox(location[0] + 0.5, location[1], location[2] + 0.5, 1, 1, r / 255, g / 255, b / 255, alpha, false);
    } else {
      RenderLibV2J.drawInnerEspBox(location[0] + 0.5, location[1], location[2] + 0.5, 1, 1, r / 255, g / 255, b / 255, alpha, true);
    }
  }

  rightClickBlock(xyz) {
    var blockPos = new BP(xyz[0], xyz[1], xyz[2]);
    var heldItemStack = Player.getHeldItem()?.getItemStack() || null;
    Client.sendPacket(new C08PacketPlayerBlockPlacement(blockPos, 0, heldItemStack, 0, 0, 0));
  }

  init() {
    this.target = null;
    this.lastTime = 0;
    this.lastChestClick = {};
    this.minedBlocks = new Map();
    this.clickQueue = new Set();
    this.chestClickedThisTick = false;
  }

  stopMacro(msg) {
    if (msg) {
      Utils.warnPlayer(msg);
    }
    this.Enabled = false;
    this.init();
  }

  toggle() {
    this.Enabled = !this.Enabled;
    if (this.Enabled) {
      this.startTime = Date.now();
      this.init();
      Chat.message(this.ModuleName + ": &aEnabled");
    } else {
      this.init();
      Chat.message(this.ModuleName + ": &cDisabled");
    }
  }
}

export const Nuker = new NukerClass();