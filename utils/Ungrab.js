import { GLFW, isLinux } from './Constants';
import { getMixinValue, setMixinValue } from './MixinManager';

let requestedUngrab = false;
let forcedGrab = false;

setMixinValue('ungrabbed', false);
setMixinValue('inputLocked', false);

const applyUngrab = () => {
    setMixinValue('ungrabbed', true);
    setMixinValue('inputLocked', true);
    const mc = Client.getMinecraft();
    if (!mc.mouseHandler) return;
    mc.mouseHandler.releaseMouse();
    if (isLinux) GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_NORMAL);
};

const applyRegrab = () => {
    setMixinValue('ungrabbed', false);
    setMixinValue('inputLocked', false);
    const mc = Client.getMinecraft();
    if (mc.screen != null) return;
    mc.mouseHandler.grabMouse();
    GLFW.glfwSetInputMode(mc.getWindow().handle(), GLFW.GLFW_CURSOR, GLFW.GLFW_CURSOR_DISABLED);
};

export function ungrab() {
    requestedUngrab = true;
    if (!forcedGrab && !getMixinValue('ungrabbed')) applyUngrab();
}

export function regrab() {
    requestedUngrab = false;
    if (!forcedGrab && getMixinValue('ungrabbed')) applyRegrab();
}

export function forceGrab() {
    forcedGrab = true;
    applyRegrab();
}

export function releaseForcedGrab() {
    forcedGrab = false;
    if (requestedUngrab) applyUngrab();
}
