import { chat } from './Chat';
import { BufferUtils, GLFW, IS_MC_26_3, SDLRect, SDLVideo } from './Constants';

let pipWindowState = null;
export function togglePiP() {
    const window = Client.getMinecraft().getWindow();
    const handle = window.handle();

    if (IS_MC_26_3) return toggleSdlPiP(window, handle);

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
        return chat('&cPicture-in-picture disabled.');
    }

    const monitor = window.findBestMonitor();
    const workX = BufferUtils.createIntBuffer(1);
    const workY = BufferUtils.createIntBuffer(1);
    const workWidth = BufferUtils.createIntBuffer(1);
    const workHeight = BufferUtils.createIntBuffer(1);
    GLFW.glfwGetMonitorWorkarea(monitor ? monitor.monitor() : GLFW.glfwGetPrimaryMonitor(), workX, workY, workWidth, workHeight);

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
    chat('&aPicture-in-picture enabled.');
}

const toggleSdlPiP = (window, handle) => {
    if (pipWindowState) {
        const state = pipWindowState;
        SDLVideo.SDL_SetWindowBordered(handle, state.decorated);
        SDLVideo.SDL_SetWindowAlwaysOnTop(handle, state.floating);
        window.setFullscreen(state.fullscreen);
        window.updateFullscreenIfChanged();

        if (!state.fullscreen) {
            SDLVideo.SDL_RestoreWindow(handle);
            SDLVideo.SDL_SetWindowSize(handle, state.width, state.height);
            SDLVideo.SDL_SetWindowPosition(handle, state.x, state.y);
            if (state.maximized) SDLVideo.SDL_MaximizeWindow(handle);
        }

        pipWindowState = null;
        return chat('&cPicture-in-picture disabled.');
    }

    const flags = SDLVideo.SDL_GetWindowFlags(handle);
    const bounds = SDLRect.calloc();
    const display = SDLVideo.SDL_GetDisplayForWindow(handle) || SDLVideo.SDL_GetPrimaryDisplay();
    if (!SDLVideo.SDL_GetDisplayUsableBounds(display, bounds)) SDLVideo.SDL_GetDisplayBounds(display, bounds);
    const workArea = { x: bounds.x(), y: bounds.y(), width: bounds.w(), height: bounds.h() };
    bounds.free();

    pipWindowState = {
        x: window.getX(),
        y: window.getY(),
        width: window.getWidth(),
        height: window.getHeight(),
        fullscreen: (flags & SDLVideo.SDL_WINDOW_FULLSCREEN) !== 0,
        maximized: (flags & SDLVideo.SDL_WINDOW_MAXIMIZED) !== 0,
        decorated: (flags & SDLVideo.SDL_WINDOW_BORDERLESS) === 0,
        floating: (flags & SDLVideo.SDL_WINDOW_ALWAYS_ON_TOP) !== 0,
    };

    window.setFullscreen(false);
    window.updateFullscreenIfChanged();
    if (pipWindowState.maximized) SDLVideo.SDL_RestoreWindow(handle);

    const width = 480;
    const height = 270;
    SDLVideo.SDL_SetWindowBordered(handle, false);
    SDLVideo.SDL_SetWindowAlwaysOnTop(handle, true);
    SDLVideo.SDL_SetWindowSize(handle, width, height);
    SDLVideo.SDL_SetWindowPosition(handle, workArea.x + workArea.width - width - 16, workArea.y + workArea.height - height - 16);
    chat('&aPicture-in-picture enabled.');
};

register('gameUnload', () => {
    if (pipWindowState) togglePiP();
});
