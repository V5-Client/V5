import { attachMixin } from '../utils/AttachMixin';

const Window = new Mixin('net.minecraft.client.util.Window');
const GLFW = org.lwjgl.glfw.GLFW;

const WindowInjection = Window.inject({
    method: 'updateFullscreen',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});

export const BorderlessFullscreenMixin = attachMixin(WindowInjection, 'WindowInjection', (instance, cir) => {
    let handle = instance.getHandle();
    if (handle === 0) return;

    let options = Client.getMinecraft().options;

    if (options.fullscreen) {
        GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, GLFW.GLFW_FALSE);

        let monitor = GLFW.glfwGetWindowMonitor(handle);
        if (monitor === 0) monitor = GLFW.glfwGetPrimaryMonitor();

        let videoMode = GLFW.glfwGetVideoMode(monitor);

        if (videoMode != null) {
            let width = videoMode.width();
            let height = videoMode.height();

            GLFW.glfwSetWindowPos(handle, 0, 0);
            GLFW.glfwSetWindowSize(handle, width, height);
        }

        cir.cancel();
    } else {
        GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, GLFW.GLFW_TRUE);
    }
});
