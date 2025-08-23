class ungrabClass {
  constructor() {
    this.isUnGrabbed = false;
    this.oldMouseHelper = null;
    this.ungrabHandler = null;

    register("gameUnload", () => this.reGrabMouse());

    register("command", () => {
      this.unGrabMouse();
    }).setName("ungrabmouse");

    register("command", () => {
      this.reGrabMouse();
    }).setName("regrabmouse");
  }

  unGrabMouse() {
    if (this.isUnGrabbed || this.ungrabHandler) return;

    this.ungrabHandler = register("renderWorld", () => {
      let mc = Client.getMinecraft();
      const Focused = mc.getClass().getDeclaredField("field_1695");
      Focused.setAccessible(true);

      mc.options.pauseOnLostFocus = false;

      if (!this.oldMouseHelper) this.oldMouseHelper = mc.field_1729;

      mc.field_1729.unlockCursor();
      Focused.set(mc, false); // stop regrab

      this.isUnGrabbed = true;
    }).unregister();
  }

  reGrabMouse() {
    if (this.ungrabHandler) {
      this.ungrabHandler.unregister();
      this.ungrabHandler = null;
    }

    if (!this.isUnGrabbed) return;
    let mc = Client.getMinecraft();
    const Focused = mc.getClass().getDeclaredField("field_1695");
    Focused.setAccessible(true);

    mc.options.pauseOnLostFocus = false;
    Focused.set(mc, true);
    mc.field_1729.lockCursor();

    this.oldMouseHelper = null;
    this.isUnGrabbed = false;
  }
}

export const Mouse = new ungrabClass();
