import { getSetting } from "../GUI/GuiSave";

const XrayPackage = Java.type("com.chattriggers.ctjs.v5.Xray");

class Xray {
  constructor() {
    this.firstTransparency = getSetting("Xray", "Transparency");
    this.prgessCounter = 0;

    // i had no idea how to do this different - add unregister/register if u can
    register("step", () => {
      this.enabled = getSetting("Xray", "Enabled");
      this.transparency = getSetting("Xray", "Transparency");

      if (this.enabled && this.progessCounter === 0) {
        XrayPackage.setEnabled();
        this.progessCounter++;
      }

      if (!this.enabled && this.progessCounter > 0) {
        XrayPackage.setDisabled();
        this.progessCounter = 0;
      }

      if (this.firstTransparency !== this.transparency && this.enabled) {
        XrayPackage.setAlpha(this.transparency);
        Client.getMinecraft().worldRenderer.reload();
        this.firstTransparency = this.transparency;
      }
    }).setFps(5);
  }
}

new Xray();
