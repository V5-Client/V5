class ungrabClass {
    constructor() {
        this.isUnGrabbed = false;
        this.oldMouseHelper = null;
        this.ungrabHandler = null;

        this.ungrabHandler = register('renderWorld', () => {
            this.handleUngrab();
        }).unregister();

        register('gameUnload', () => this.reGrabMouse());

        register('command', () => {
            this.unGrabMouse();
        }).setName('ungrabmouse');

        register('command', () => {
            this.reGrabMouse();
        }).setName('regrabmouse');
    }

    handleUngrab() {
        let mc = Client.getMinecraft();
        const Focused = mc.getClass().getDeclaredField('field_1695');
        Focused.setAccessible(true);

        mc.options.pauseOnLostFocus = false;

        if (!this.oldMouseHelper) this.oldMouseHelper = mc.field_1729;

        mc.field_1729.unlockCursor();
        Focused.set(mc, false);

        this.isUnGrabbed = true;
    }

    unGrabMouse() {
        if (this.isUnGrabbed) return;
        this.ungrabHandler.register();
    }

    reGrabMouse() {
        if (this.ungrabHandler) {
            this.ungrabHandler.unregister();
        }

        if (!this.isUnGrabbed) return;
        let mc = Client.getMinecraft();
        const Focused = mc.getClass().getDeclaredField('field_1695');
        Focused.setAccessible(true);

        mc.options.pauseOnLostFocus = false;
        Focused.set(mc, true);
        mc.field_1729.lockCursor();

        this.oldMouseHelper = null;
        this.isUnGrabbed = false;
    }
}

export const Mouse = new ungrabClass();
