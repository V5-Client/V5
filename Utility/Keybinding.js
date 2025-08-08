import { Timers } from "./Timing";
import { Utils } from "./Main";

import { mc } from "./Main";

const LeftClickMouse = mc.getClass().getDeclaredMethod("method_1536");
LeftClickMouse.setAccessible(true);

const RightClickMouse = mc.getClass().getDeclaredMethod("method_1583");
RightClickMouse.setAccessible(true);

class Keybinding {
  constructor() {
    this.cooldown = Timers;
  }

  /**
   * Left clicks
   */
  leftClick() {
    LeftClickMouse.invoke(mc);
  }

  /**
   * Right clicks
   */
  rightClick() {
    RightClickMouse.invoke(mc);
  }

  /**
   * Right clicks with a specified amount of ticks
   * @param {*} ticks
   */
  rightClickZPH(ticks = 0) {
    if (ticks === 0) {
      RightClickMouse.invoke(mc);
    } else {
      Client.scheduleTask(ticks, () => {
        RightClickMouse.invoke(mc);
      });
    }
  }

  setItemSlot(slot) {
    if (slot < 0 || slot > 8)
      return chat.message("Invalid slot blocked! Report this ASAP!");
    if (Player.getHeldItemIndex() !== slot) {
      chat.log(
        `Swapping hotbar slots from ${Player.getHeldItemIndex()} to ${slot}`
      );
      Player.setHeldItemIndex(slot);
    }
  }

  getHeldItemStackSize() {
    let item = Player.getHeldItem();
    if (item && item.getStackSize) {
      return item.getStackSize();
    }
    return 0;
  }

  /**
   * Finds an item in the hotbar and returns its slot
   * @param {string} itemName - The name of the item to find
   * @returns {number} - The slot of the item, or -1 if not found
   */
  findItemInHotbar(itemName) {
    for (let slot = 0; slot < 8; slot++) {
      let item = Player.getInventory()?.getStackInSlot(slot);
      if (item && item.getName().includes(itemName)) {
        return slot;
      }
    }
    return -1;
  }

  /**
   * Sends a right click packet
   * @param {*} ticks
   */
  /*rightClickPacket(ticks = 0) {
    if (
      ticks === 0 &&
      Player.getInventory().getStackInSlot(Player.getHeldItemIndex())
    ) {
      Utils.sendPacket(
        new PlayerInteractBlockC2SPacket(
          new BP(-1, -1, -1),
          255,
          Player.getInventory()
            .getStackInSlot(Player.getHeldItemIndex())
            .getItemStack(),
          0,
          0,
          0
        )
      );
    } else {
      Client.scheduleTask(ticks, () => {
        Utils.sendPacket(
          new PlayerInteractBlockC2SPacket(
            new BP(-1, -1, -1),
            255,
            Player.getInventory()
              .getStackInSlot(Player.getHeldItemIndex())
              .getItemStack(),
            0,
            0,
            0
          )
        );
      });
    }
  } */

  setKey(key, down) {
    if (Client.isInGui() && !Client.isInChat()) return;
    if (key === "a") mc.options.leftKey.setPressed(down);
    if (key === "d") mc.options.rightKey.setPressed(down);
    if (key === "s") mc.options.backKey.setPressed(down);
    if (key === "w") mc.options.forwardKey.setPressed(down);
    if (key === "space") mc.options.jumpKey.setPressed(down);
    if (key === "shift") mc.options.sneakKey.setPressed(down);
    if (key === "leftclick") mc.options.attackKey.setPressed(down);
    if (key === "sprint") mc.options.sprintKey.setPressed(down);
  }

  isKeyDown(key) {
    if (key === "a") return mc.options.leftKey.isPressed();
    if (key === "d") return mc.options.rightKey.isPressed();
    if (key === "s") return mc.options.backKey.isPressed();
    if (key === "w") return mc.options.forwardKey.isPressed();
    if (key === "space") return mc.options.jumpKey.isPressed();
    if (key === "shift") return mc.options.sneakKey.isPressed();
    if (key === "leftclick") return mc.options.sneakKey.isPressed();
    if (key === "sprint") return mc.options.sprintKey.isPressed();
  }

  setKeysBasedOnYaw(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (yaw >= -50.0 && yaw <= 50.0) this.setKey("w", true);
    if (yaw >= -135.5 && yaw <= -7.0) this.setKey("a", true);
    if (yaw >= 7.0 && yaw <= 135.5) this.setKey("d", true);
    if (yaw <= -135.5 || yaw >= 135.5) this.setKey("s", true);

    this.setKey(
      "space",
      Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.04 &&
        this.cooldown.hasReached(500) &&
        jump &&
        Utils.playerIsCollided()
    );
  }

  setKeysBasedOnYawTemp(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (yaw >= -50.0 && yaw <= 50.0) this.setKey("w", true);
    if (yaw >= -135.5 && yaw <= -40.0) this.setKey("a", true);
    if (yaw >= 40.0 && yaw <= 135.5) this.setKey("d", true);
    if (yaw <= -135.5 || yaw >= 135.5) this.setKey("s", true);

    this.setKey(
      "space",
      Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.02 &&
        this.cooldown.hasReached(500) &&
        jump &&
        Utils.playerIsCollided()
    );
  }

  setKeysForStraightLine(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (22.5 > yaw && yaw > -22.5) {
      // Forwards
      this.setKey("w", true);
    } else if (-22.5 > yaw && yaw > -67.5) {
      // Forwards+Right
      this.setKey("w", true);
      this.setKey("a", true);
    } else if (-67.5 > yaw && yaw > -112.5) {
      // Right
      this.setKey("a", true);
    } else if (-112.5 > yaw && yaw > -157.5) {
      // Backwards + Right
      this.setKey("a", true);
      this.setKey("s", true);
    } else if ((-157.5 > yaw && yaw > -180) || (180 > yaw && yaw > 157.5)) {
      // Backwards
      this.setKey("s", true);
    } else if (67.5 > yaw && yaw > 22.5) {
      // Forwards + Left
      this.setKey("w", true);
      this.setKey("d", true);
    } else if (112.5 > yaw && yaw > 67.5) {
      // Left
      this.setKey("d", true);
    } else if (157.5 > yaw && yaw > 112.5) {
      // Backwards+Left
      this.setKey("s", true);
      this.setKey("d", true);
    }
    this.setKey(
      "space",
      Player.asPlayerMP().isInWater() ||
        (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.02 &&
          this.cooldown.hasReached(500) &&
          jump &&
          Utils.playerIsCollided())
    );
  }

  setCooldown() {
    this.cooldown.reset();
  }

  stopMovement() {
    this.setKey("a", false);
    this.setKey("s", false);
    this.setKey("d", false);
    this.setKey("w", false);
    this.setKey("space", false);
  }

  unpressKeys() {
    this.stopMovement();
    this.setKey("shift", false);
  }
}

export const Keybind = new Keybinding();
