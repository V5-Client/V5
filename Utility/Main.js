//let { ModuleManager } = global.settingSelection;

import { Prefix } from "./Prefix";
let ArrayLists = Java.type("java.util.ArrayList");
let AxisAlignedBB = Java.type("net.minecraft.world.phys.AABB");

// mc
export const mc = Client.getMinecraft();

class UtilsClass {
  constructor() {
    this.configName = "C";
  }

  /**
   * @param {Map} map
   */
  mapToArray(map) {
    let array = [];
    map.forEach((element) => {
      array.push(element);
    });
    return array;
  }

  makeJavaArray(array) {
    let JavaArray = new ArrayLists();
    for (let i = 0; i < array.length; i++) {
      JavaArray.add(array[i]);
    }
    return JavaArray;
  }

  makeRandomPitch(min, max) {
    this.randomPitch = Math.random() * (max - min) + min;
  }

  getRandomPitch() {
    return this.randomPitch;
  }

  /**
   * Warn the player
   */
  /**
   * Warns the player with a message and an optional audio notification.
   * @param {string} [msg="New Alert!"] - The message to display to the player.
   */
  warnPlayer = (msg = "New Alert!") => {
    // TODO RC Alert

    global.export.NotificationUtils.sendAlert(msg);

    if (!ModuleManager.getSetting("Failsafes", "Audio Notifications")) return;

    // Failsafe Sound
    try {
      let audio = new Sound({
        source: global.export.FailsafeManager.getAudioSource()?.toString(),
      });
      chat.message("New Alert! " + msg);
      audio.setVolume(1);
      audio.play();
    } catch (e) {
      chat.message(
        "&cFailsafe sound assets missing! Try reinstall rdbt client!"
      );
    }
  };

  getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  sendPacket(Packet) {
    Client.getMinecraft().client.getNetworkHandler().sendPacket(Packet);
  }

  // Item Utils

  /**
   * @param {String} name
   * @returns {itemObject}
   */
  getItemByName(name) {
    for (let i = 0; i <= 8; i++) {
      let item = Player.getInventory()?.getStackInSlot(i);
      if (item && ChatLib.removeFormatting(item.getName()).includes(name)) {
        return new ItemObject(item, i);
      }
    }
    return null;
  }
  /**
   * @param {Array<String>} lore
   * @param {String} string
   */
  includesLore(lore, string) {
    for (let i = 0; i < lore.length; i++) {
      if (lore[i].removeFormatting().includes(string)) return true;
    }
  }

  /**
   * Returns an item index filtered by the unformatted name
   * @param {String[]} Name
   * @returns {itemHelper}
   */
  findItem(Names) {
    for (let i = 0; i < Names.length; i++) {
      for (let f = 0; f <= 8; f++) {
        let item = Player.getInventory()?.getStackInSlot(f);
        if (
          item &&
          ChatLib.removeFormatting(item.getName()).includes(Names[i])
        ) {
          return new ItemObject(item, f);
        }
      }
    }
    return null;
  }

  getItem = (Slot) => {
    let item = Player.getInventory()?.getStackInSlot(Slot);
    return new ItemObject(item, Slot);
  };

  /**
       * @param {String} ModuleName
       * @param {String[][]} Items
       * @returns {Boolean}
        checks if all input items are in the hotbar
    */
  checkItems = (ModuleName, Items) => {
    let Missing = [];
    for (let i = 0; i < Items.length; i++) {
      if (this.findItem(Items[i]) === null) {
        Missing.push(Items[i]);
      }
    }
    if (Missing.length > 0) {
      for (let i = 0; i < Missing.length; i++) {
        chat.message("- Missing: " + Missing[i].toString());
      }
      return false;
    }
    return true;
  };

  playerCords = () => {
    return {
      floor: [
        Math.floor(Player.getX()),
        Math.floor(Player.getY()),
        Math.floor(Player.getZ()),
      ],
      player: [Player.getX(), Player.getY(), Player.getZ()],
      beneath: [
        Math.floor(Player.getX()),
        Math.floor(Player.getY() - 1),
        Math.floor(Player.getZ()),
      ],
    };
  };

  /**
   * @returns {vec}
   */
  getPlayerNode() {
    return this.getEntityPathfindLocation(Player.getPlayer());
  }

  /**
   * @param {MCEntity} entity
   * @returns {vec}
   */
  getEntityPathfindLocation(entity) {
    let entityCt = new Entity(entity);
    let entityPosition = new BlockPos(
      Math.floor(entityCt.getX()),
      Math.floor(entityCt.getY()),
      Math.floor(entityCt.getZ())
    );
    let vectors = [];
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        for (let y = 0; y >= -50; y--) {
          let pos = entityPosition.add(x, y, z);
          if (!this.validPos(pos)) continue;
          vectors.push(new Vector(pos));
          break;
        }
      }
    }

    let closest = null;
    let lowest;
    vectors.forEach((vector) => {
      if (!vector) return;
      let distance = global.export.MathUtils.getDistance(
        entityCt,
        vector.add(0.5, 0.5, 0.5)
      ).distanceFlat;
      if (!closest || distance < lowest) {
        closest = vector;
        lowest = distance;
      }
    });
    return closest;
  }

  validPos(pos) {
    let block = World.getBlockAt(pos);
    let MCBlock = block.type.mcBlock;
    if (
      MCBlock.func_149688_o().func_76224_d() ||
      (!MCBlock.func_149688_o().func_76220_a() && block.type.getID() != 78)
    )
      return false;
    let totalHeight = 0.0;
    let blockType1 = World.getBlockAt(pos.add(0, 1, 0)).type;
    let blockType2 = World.getBlockAt(pos.add(0, 2, 0)).type;
    let blockType3 = World.getBlockAt(pos.add(0, 3, 0)).type;
    if (blockType1.getID() != 0.0)
      totalHeight += blockType1.mcBlock.func_149669_A();
    if (blockType2.getID() != 0.0)
      totalHeight += blockType2.mcBlock.func_149669_A();
    if (blockType3.getID() != 0.0)
      totalHeight += blockType3.mcBlock.func_149669_A();
    return totalHeight < 0.6;
  }

  playerIsCollided() {
    let ABB = Player.getPlayer().func_174813_aQ();
    let boxes = this.getBlocks();
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].func_72326_a(ABB)) {
        return true;
      }
    }
    return false;
  }

  getBlocks() {
    let cords = [
      Math.floor(Player.getX()),
      Math.floor(Player.getY()),
      Math.floor(Player.getZ()),
    ];
    let boxes = [];
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        for (let y = 0; y <= 1; y++) {
          let ctBlock = World.getBlockAt(
            cords[0] + x,
            cords[1] + y,
            cords[2] + z
          );
          if (
            ctBlock.type.mcBlock.func_149669_A() != 1.0 ||
            ctBlock.type.getID() === 0
          )
            continue;
          boxes.push(
            new AxisAlignedBB(
              cords[0] + x - 0.01,
              cords[1] + y,
              cords[2] + z - 0.01,
              cords[0] + x + 1.01,
              cords[1] + y + ctBlock.type.mcBlock.func_149669_A(),
              cords[2] + z + 1.01
            )
          );
        }
      }
    }
    return boxes;
  }

  /**
   * @param {Object} input
   * @returns {vec}
   */
  convertToVector(input) {
    if (input instanceof Vector) return input;
    if (input instanceof Array) return new Vector(input[0], input[1], input[2]);
    else if (input instanceof BlockPos || input instanceof Vec3i)
      return new Vector(input.x, input.y, input.z);
    else if (input instanceof net.minecraft.util.Vec3)
      return new Vector(
        input.field_72450_a,
        input.field_72448_b,
        input.field_72449_c
      );
    else if (
      input instanceof Player ||
      input instanceof PlayerMP ||
      input instanceof Entity
    )
      return new Vector(input.getX(), input.getY(), input.getZ());
  }

  isNumber(object) {
    return typeof object === "number";
  }

  /**
   * ported from java to js because it could find the "public" class.
   * @param {BlockPos} pos
   */
  isWalkable(pos) {
    let block = World.getBlockAt(pos);
    let MCBlock = block.type.mcBlock;
    if (
      MCBlock.func_149688_o().func_76224_d() ||
      (!MCBlock.func_149688_o().func_76220_a() && block.type.getID() != 78)
    )
      return false;
    let totalHeight = 0.0;
    let blockType1 = World.getBlockAt(pos.add(0, 1, 0)).type;
    let blockType2 = World.getBlockAt(pos.add(0, 2, 0)).type;
    let blockType3 = World.getBlockAt(pos.add(0, 3, 0)).type;
    if (blockType1.getID() != 0.0)
      totalHeight += blockType1.mcBlock.func_149669_A();
    if (blockType2.getID() != 0.0)
      totalHeight += blockType2.mcBlock.func_149669_A();
    if (blockType3.getID() != 0.0)
      totalHeight += blockType3.mcBlock.func_149669_A();
    return totalHeight < 0.6;
  }

  /**
   * Reads and parses a JSON configuration file.
   * @param {string} Name - The name of the configuration file (e.g., "webhook.json").
   * @returns {object} The parsed JSON object from the file.
   */
  getConfigFile(Name) {
    let content = FileLib.read(this.configName, Name);
    if (!content) return {};
    try {
      let parse = JSON.parse(content);
      return parse;
    } catch (error) {
      ChatLib.chat("Error parsing route file: " + error);
      return {};
    }
  }

  /**
   * Writes a JavaScript object to a JSON configuration file.
   * @param {string} Name - The name of the configuration file.
   * @param {object} Value - The object to write to the file.
   */
  writeConfigFile(Name, Value) {
    let string = JSON.stringify(Value, null, 2);
    FileLib.write(this.configName, Name, string);
  }

  blockCode(pos) {
    return pos.x + "" + pos.y + "" + pos.z;
  }

  /**
   * Returns the area from the tab list
   * @returns {string} area
   */
  area() {
    let areaLine = TabList.getNames().find((name) => {
      let str = String(name);
      return str.indexOf("Area:") !== -1;
    });

    if (areaLine) {
      let clean = String(areaLine).replace(/§[0-9A-FK-OR]/gi, "");
      let areaName = clean.split("Area:")[1].trim();
      return areaName;
    }
  }

  subArea() {
    let lines = Scoreboard.getLines();

    for (let i = 0; i < lines.length; i++) {
      let str = String(lines[i]);

      if (str.indexOf("⏣") !== -1) {
        let clean = str.replace(/§[0-9A-FK-OR]/gi, "");
        let subAreaName = clean.split("⏣")[1].trim();

        return subAreaName;
      }
    }
  }
}

export const Utils = new UtilsClass();
