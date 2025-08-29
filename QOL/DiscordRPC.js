import { getSetting } from "../GUI/GuiSave";

const RPCPackage = Java.type("com.chattriggers.v5.qol.DiscordRPC");

class RPC {
  constructor() {
    register("step", () => {
      this.enabled = getSetting("Discord RPC", "Enabled");

      if (this.enabled) RPCPackage.stayOn();
      else RPCPackage.turnOff();
    });
  }
}

new RPC();
