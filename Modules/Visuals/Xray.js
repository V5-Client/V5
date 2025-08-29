import { getSetting } from "../../GUI/GuiSave";
const XrayPackage = Java.type("com.chattriggers.ctjs.v5.Xray");

class Xray {
  constructor() {
    this.enabled = false;
    this.transparency = getSetting("Xray", "Transparency");
    this.firstTransparency = this.transparency;

    let stepEvent = register("step", () => this.update()).setFps(5);

    Client.scheduleTask(0, () => this.checkInitialState()); // prevent a rendering  bug?
  }

  checkInitialState() {
    const enabled = getSetting("Xray", "Enabled");
    if (enabled) {
      this.enableXray();
    } else {
      this.disableXray();
    }
  }

  update() {
    const enabled = getSetting("Xray", "Enabled");
    const transparency = getSetting("Xray", "Transparency");

    if (enabled && !this.enabled) {
      this.enableXray();
    } else if (!enabled && this.enabled) {
      this.disableXray();
    }

    if (enabled && transparency !== this.firstTransparency) {
      XrayPackage.setAlpha(transparency);
      Client.getMinecraft().worldRenderer.reload();
      this.firstTransparency = transparency;
    }
  }

  enableXray() {
    XrayPackage.setEnabled();
    this.enabled = true;
    this.firstTransparency = this.transparency;
  }

  disableXray() {
    XrayPackage.setDisabled();
    this.enabled = false;
  }
}

new Xray();
