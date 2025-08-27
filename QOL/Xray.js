import { Chat } from "../Utility/Chat";

const Xray = Java.type("com.chattriggers.ctjs.v5.Xray");

// not intended for singleplayer, it will kill your fps </3

let enabled = false;

register("command", () => {
  enabled = !enabled;
  if (enabled) {
    Xray.setEnabled();
  } else {
    Xray.setDisabled();
  }
}).setName("xray");

// temp cmd
register("command", (opacity) => {
  if (opacity > 255) {
    Chat.message("Opacity level is too big!");
    return;
  } else if (opacity < 1) {
    Chat.message("Opacity level is too low!");
  } else if (opacity === 255) {
    Xray.setDisabled();
    return;
  } else if (!enabled) {
    return;
  }

  Xray.setAlpha(opacity);
  Client.getMinecraft().worldRenderer.reload();
  Chat.message(`Opacity changed to ${opacity}!`);
}).setName("opacity");
