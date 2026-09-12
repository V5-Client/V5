import { GLFW, isLinux } from './Constants';

let requestedUngrab = false;
let forcedGrab = false;

Client.setUngrabbed(false);
Client.setInputLocked(false);

const applyUngrab = () => {
    Client.setUngrabbed(true);
    Client.setInputLocked(true);
    const mc = Client.getMinecraft();
    if (!mc.mouseHandler) return;
    mc.mouseHandler.releaseMouse();
    if (isLinux) GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_NORMAL);
};

const applyRegrab = () => {
    Client.setUngrabbed(false);
    Client.setInputLocked(false);
    const mc = Client.getMinecraft();
    if (Client.getCurrentScreen() != null) return;
    mc.mouseHandler.grabMouse();
    GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_DISABLED);
};

export function ungrab() {
    requestedUngrab = true;
    if (!forcedGrab && !Client.isUngrabbed()) applyUngrab();
}

export function regrab() {
    requestedUngrab = false;
    if (!forcedGrab && Client.isUngrabbed()) applyRegrab();
}

export function forceGrab() {
    forcedGrab = true;
    applyRegrab();
}

export function releaseForcedGrab() {
    forcedGrab = false;
    if (requestedUngrab) applyUngrab();
}
