import { GLFW, isLinux } from './Constants';
import { Mixin } from './MixinManager';

class UngrabManager {
    constructor() {
        this.requestedUngrab = false;
        this.forcedGrab = false;
        Mixin.set('ungrabbed', false);
        Mixin.set('inputLocked', false);
    }

    /**
     * Prevents the player from controlling the camera and locks inventory interaction.
     */
    ungrab() {
        this.requestedUngrab = true;
        if (this.forcedGrab) return;
        if (Mixin.get('ungrabbed')) return;

        this.applyUngrab();
    }

    applyUngrab() {
        Mixin.set('ungrabbed', true);
        Mixin.set('inputLocked', true);

        const mc = Client.getMinecraft();
        if (mc.mouseHandler) {
            mc.mouseHandler.releaseMouse();

            if (isLinux) {
                GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_NORMAL);
            }
        }
    }

    /**
     * Returns control to the player.
     */
    regrab() {
        this.requestedUngrab = false;
        if (this.forcedGrab) return;
        if (!Mixin.get('ungrabbed')) return;

        this.applyRegrab();
    }

    forceGrab() {
        this.forcedGrab = true;
        this.applyRegrab();
    }

    releaseForcedGrab() {
        this.forcedGrab = false;
        if (this.requestedUngrab) this.applyUngrab();
    }

    applyRegrab() {
        Mixin.set('ungrabbed', false);
        Mixin.set('inputLocked', false);

        const mc = Client.getMinecraft();
        if (mc.screen == null) {
            mc.mouseHandler.grabMouse();
            GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_DISABLED);
        }
    }
}

export const Mouse = new UngrabManager();
