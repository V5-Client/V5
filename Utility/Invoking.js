//let { mc, BP, C08PacketPlayerBlockPlacement, Utils, TimeHelper, chat } =
//global.export;

//let BP =

const mc = Client.getMinecraft();
const LeftClickMouse = mc.getClass().getDeclaredMethod("method_1536");
LeftClickMouse.setAccessible(true);

const RightClickMouse = mc.getClass().getDeclaredMethod("method_1583");
RightClickMouse.setAccessible(true);

class MouseClicks {
  constructor() {
    register("command", () => {
      this.rightClickPacket();
    }).setName("clickp");
  }

  /**
   * Left clicks
   */
  leftClick() {
    LeftClickMouse.invoke(mc);
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
  }

  /**
   * Right clicks
   * @param {*} Tick
   */
  rightClick(Tick = 0) {
    RightClickMouse.invoke(mc);
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
}

export const Invoking = new MouseClicks();
