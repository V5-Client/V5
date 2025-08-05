//let { mc, TimeHelper, chat } = global.export;

import { Time } from "./Timing";

class InventoryUtilsClass {
  constructor() {
    this.cooldown = new Time();
  }

  /**
   * Strips Minecraft formatting codes from a string
   * @param {String} str - The string to strip formatting from
   * @returns {String} The string without formatting codes
   */
  stripFormatting(str) {
    return typeof str === "string"
      ? str.replace(/\u00A7[0-9A-FK-ORa-fk-or]/g, "")
      : str;
  }

  /**
   * Gets the player's inventory
   * @returns {Object} The player's inventory or null if not available
   */
  getInventory() {
    return Player.getInventory();
  }

  findFirst(inv, itemn) {
    let inventory = inv;
    for (let i = 0; i < inventory.getSize(); i++) {
      let item = inventory.getStackInSlot(i);
      if (item && item.getName && item.getName().removeFormatting() === itemn) {
        return i; // Returns the slot index where it's found
      }
    }
    return -1; // Not found
  }

  findAll(inv, itemn) {
    let inventory = inv;
    let result = [];
    for (let i = 0; i < inventory.getSize(); i++) {
      let item = inventory.getStackInSlot(i);
      if (item && item.getName && item.getName().removeFormatting() === itemn) {
        result.push(i);
      }
    }
    return result; // Returns an array of all matching slot indices
  }

  /**
   * A strange bug occurs when you click while tabbed out then it no longer is able to mine.
   * This function fixes that.
   */
  closeInv() {
    Client.currentGui?.close();
    const Focused = mc.getClass().getDeclaredField("field_1695");
    Focused.setAccessible(true);

    if (!Focused.getBoolean(mc)) {
      // if (!mc.inGameHasFocus)
      mc.field_71415_G = true; // mc.inGameHasFocus = true;
      mc.mouse.lockCursor(); // mc.mouseHelper.grabMouseCursor();
    }
  }

  /**
   * Clicks an item with the specified name
   * @param {String} name name to search for
   * @param {Boolean} shift whether shift is being held
   * @param {String} button the mouse button to use
   * @param {Boolean} displayName whether to use display name or registry name
   * @param {Boolean} nameSpecific if true, the name has to exactly match, otherwise it will use includes
   * @returns {Boolean} True if the item was clicked, false otherwise
   * @author Kash MiningModules
   */
  clickItem(
    name,
    shift = false,
    button = "LEFT",
    displayName = true,
    nameSpecific = false
  ) {
    chat.log(`Attempting to click on item: ${name}`);

    if (!name || this.guiName() == "null") return false;

    name = name.toLowerCase();
    const items = Player.getContainer().getItems();
    const slot = items.findIndex((item) => {
      const itemName = displayName
        ? item?.getName()?.removeFormatting()
        : item?.getRegistryName();
      const compare = nameSpecific
        ? itemName?.toLowerCase() === name
        : itemName?.toLowerCase()?.removeFormatting()?.includes(name);
      return compare;
    });

    if (slot < 0) {
      return false; // item not found
    }

    Player.getContainer().click(slot, shift, button);
    return true;
  }

  /**
   * Clicks the specified slot number
   * @param {Number} slot the slot number to click
   * @param {Boolean} shift whether shift is being held
   * @param {String} button the mouse button to use (MIDDLE by default, or LEFT/RIGHT)
   * @author Kash MiningModules
   */
  clickSlot(slot, shift = false, button = "LEFT") {
    if (slot == null || slot < 0 || this.guiName() === "null") return;
    const items = Player.getContainer().getItems();
    if (!items || slot >= items.length) return;
    Player.getContainer().click(slot, shift, button);
    return;
  }

  /**
   * Loops through an array and clicks the first item it can find.
   * @param {Array<String>} names An array of item names to search for.
   * @param {Boolean} shift Whether shift is being held.
   * @param {String} button The mouse button to use.
   * @param {Boolean} displayName Whether to use display name or registry name.
   * @param {Boolean} nameSpecific If true, the name has to exactly match, otherwise it will use includes.
   * @returns {Boolean} True if all items were attempted to be clicked, false otherwise.
   */
  clickItems(
    names,
    shift = false,
    button = "LEFT",
    displayName = true,
    nameSpecific = false
  ) {
    if (!Array.isArray(names) || names.length === 0) {
      chat.debugMessage("No item names provided or input is not an array.");
      return false;
    }

    let clicked = false;
    for (let i = 0; i < names.length; i++) {
      let name = names[i];
      clicked = this.clickItem(name, shift, button, displayName, nameSpecific);
      if (clicked) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the name of the current GUI
   * @returns {String} The name of the current GUI
   * @author Kash MiningModules
   */
  guiName() {
    return Client.currentGui.getClassName();
  }
}

export const Clicking = new InventoryUtilsClass();
