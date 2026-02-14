import { GLFW, System } from './Constants';
import { Mixin } from './MixinManager';

const os = System.getProperty('os.name').toLowerCase();
const isLinux = os.includes('nux') || os.includes('nix');

class UngrabManager {
    constructor() {
        Mixin.set('ungrabbed', false);
        Mixin.set('inputLocked', false);
    }

    /**
     * Prevents the player from controlling the camera and locks inventory interaction.
     */
    ungrab() {
        if (Mixin.get('ungrabbed')) return;

        Mixin.set('ungrabbed', true);
        Mixin.set('inputLocked', true);

        const mc = Client.getMinecraft();
        if (mc.mouse) {
            mc.mouse.unlockCursor();

            if (isLinux) {
                GLFW.glfwSetInputMode(mc.getWindow().getHandle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_NORMAL);
            }
        }
    }

    /**
     * Returns control to the player.
     */
    regrab() {
        if (!Mixin.get('ungrabbed')) return;

        Mixin.set('ungrabbed', false);
        Mixin.set('inputLocked', false);

        const mc = Client.getMinecraft();
        if (mc.currentScreen == null) {
            mc.mouse.lockCursor();
            GLFW.glfwSetInputMode(mc.getWindow().getHandle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_DISABLED);
        }
    }
}

export const Mouse = new UngrabManager();
