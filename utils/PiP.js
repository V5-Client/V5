import { chat } from './Chat';
import { GLFW } from './Constants';

let pipWindowState = null;
export function togglePiP() {
    const window = Client.getMinecraft().getWindow();
    const handle = window.handle();

    if (pipWindowState) {
        const state = pipWindowState;

        GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, state.decorated);
        GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_FLOATING, state.floating);

        if (window.isFullscreen() !== state.fullscreen) {
            window.toggleFullScreen();
            window.updateFullscreenIfChanged();
        }

        if (!state.fullscreen) {
            GLFW.glfwRestoreWindow(handle);
            GLFW.glfwSetWindowSize(handle, state.width, state.height);
            GLFW.glfwSetWindowPos(handle, state.x, state.y);
            if (state.maximized === GLFW.GLFW_TRUE) GLFW.glfwMaximizeWindow(handle);
        }

        pipWindowState = null;
        return chat('messages.runtime.pictureInPictureDisabled');
    }

    const monitor = window.findBestMonitor();
    const workX = org.lwjgl.BufferUtils.createIntBuffer(1);
    const workY = org.lwjgl.BufferUtils.createIntBuffer(1);
    const workWidth = org.lwjgl.BufferUtils.createIntBuffer(1);
    const workHeight = org.lwjgl.BufferUtils.createIntBuffer(1);
    GLFW.glfwGetMonitorWorkarea(monitor ? monitor.getMonitor() : GLFW.glfwGetPrimaryMonitor(), workX, workY, workWidth, workHeight);

    pipWindowState = {
        x: window.getX(),
        y: window.getY(),
        width: window.getWidth(),
        height: window.getHeight(),
        fullscreen: window.isFullscreen(),
        maximized: GLFW.glfwGetWindowAttrib(handle, GLFW.GLFW_MAXIMIZED),
        decorated: GLFW.glfwGetWindowAttrib(handle, GLFW.GLFW_DECORATED),
        floating: GLFW.glfwGetWindowAttrib(handle, GLFW.GLFW_FLOATING),
    };

    if (pipWindowState.fullscreen) {
        window.toggleFullScreen();
        window.updateFullscreenIfChanged();
    }
    if (pipWindowState.maximized === GLFW.GLFW_TRUE) GLFW.glfwRestoreWindow(handle);

    const width = 480;
    const height = 270;
    GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, GLFW.GLFW_FALSE);
    GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_FLOATING, GLFW.GLFW_TRUE);
    GLFW.glfwSetWindowSize(handle, width, height);
    GLFW.glfwSetWindowPos(handle, workX.get(0) + workWidth.get(0) - width - 16, workY.get(0) + workHeight.get(0) - height - 16);
    chat('messages.runtime.pictureInPictureEnabled');
}
