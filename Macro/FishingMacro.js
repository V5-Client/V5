import { Keybind } from "../Utility/Keybinding";
import { Chat } from "../Utility/Chat";

let time = Date.now()

register("tick", () => {
  if (Date.now() - time < 400) return
  let stand = World.getAllEntitiesOfType(Java.type("net.minecraft.entity.decoration.ArmorStandEntity").class);
      stand.forEach((element, index) => {
        if (element.getName() === "!!!") {
          Keybind.rightClick()
          time = Date.now()
          Chat.message("Jerking off rod")
          Client.scheduleTask(3, () => {
            Keybind.rightClick()
          })
        }
      });
})
