import { Keybind } from "../../Utility/Keybinding";
import { Chat } from "../../Utility/Chat";
import { Guis } from "../../Utility/Inventory";

let time = Date.now();
let boomSlot = 1;
let rodSlot = 0;

register("tick", () => {
  if (Date.now() - time < 800) return;
  let stand = World.getAllEntitiesOfType(
    net.minecraft.entity.decoration.ArmorStandEntity
  );
  stand.forEach((element, index) => {
    if (element.getName() === "!!!") {
      Keybind.rightClick();
      time = Date.now();
      Chat.message("Jerking off rod");
      Client.scheduleTask(2, () => {
        Guis.setItemSlot(boomSlot);
      });
      Client.scheduleTask(4, () => {
        Keybind.rightClick();
      });
      Client.scheduleTask(10, () => {
        Keybind.rightClick();
      });
      Client.scheduleTask(16, () => {
        Keybind.rightClick();
      });
      Client.scheduleTask(18, () => {
        Guis.setItemSlot(rodSlot);
      });
      Client.scheduleTask(20, () => {
        Keybind.rightClick();
      });
    }
  });
});
