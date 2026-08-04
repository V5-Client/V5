import { GLFW, isWindows } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Utils } from '../../utils/Utils';

const MouseInfo = Java.type('java.awt.MouseInfo');
const MemoryUtil = Java.type('org.lwjgl.system.MemoryUtil');

const PIP_WIDTH = 420;
const PIP_HEIGHT = 252;
const PIP_X = 0;
const PIP_Y = 0;

const POS_X = MemoryUtil.memAllocInt(1);
const POS_Y = MemoryUtil.memAllocInt(1);
const SIZE_W = MemoryUtil.memAllocInt(1);
const SIZE_H = MemoryUtil.memAllocInt(1);

class PiP extends ModuleBase {
    constructor() {
        super({
            name: 'PiP',
            subcategory: 'Visuals',
            description: 'Shrinks the game window into a small always-on-top window.',
            tooltip: 'Shrinks the game window into a small picture-in-picture window. Drag it with the middle mouse button. Windows only.',
        });

        this.alwaysOnTop = true;
        this.dragWithMiddleMouse = true;
        this._applied = false;
        this._saved = null;
        this._lastMouse = null;
        this._blocked = false;
        this._blockedMessageShown = false;
        this._pipErrorLogged = false;

        this._constructedAtLoad = true;
        ScheduleTask(() => {
            this._constructedAtLoad = false;
        });

        this.addToggle(
            'Always on Top',
            (value) => {
                this.alwaysOnTop = value;
                if (this.enabled && this._applied) this._setFloating(this._handle(), value);
            },
            'Keeps the PiP window above all other windows.',
            true
        );
        this.addToggle(
            'Drag with Middle Mouse',
            (value) => {
                this.dragWithMiddleMouse = value;
            },
            'Hold the middle mouse button and move the cursor to drag the PiP window.',
            true
        );

        this.on('tick', () => this._onTick());
    }

    onEnable() {
        if (!isWindows) {
            this.message('&cPiP is only available on Windows.');
            this.toggle(false);
            return;
        }

        if (this._constructedAtLoad) {
            this._constructedAtLoad = false;
            this.message('&cPiP was auto-restored from saved settings. Disabling it - toggle it manually to use.');
            this._persistDisabled();
            this.toggle(false);
            return;
        }

        this._applied = false;
        this._lastMouse = null;
        this._blocked = false;
        this._blockedMessageShown = false;
        this._pipErrorLogged = false;
    }

    onDisable() {
        if (this._applied && this._saved) {
            try {
                const handle = this._handle();
                if (handle) {
                    this._setFloating(handle, false);
                    GLFW.glfwSetWindowSize(handle, this._saved.width, this._saved.height);
                    GLFW.glfwSetWindowPos(handle, this._saved.x, this._saved.y);
                }
            } catch (e) {
                this._logError(e);
            }
        }

        this._applied = false;
        this._saved = null;
        this._lastMouse = null;
        this._blocked = false;
        this._blockedMessageShown = false;
    }

    _handle() {
        return GLFW.glfwGetCurrentContext();
    }

    _getSize(handle) {
        GLFW.glfwGetWindowSize(handle, SIZE_W, SIZE_H);
        return { width: SIZE_W.get(0), height: SIZE_H.get(0) };
    }

    _getPos(handle) {
        GLFW.glfwGetWindowPos(handle, POS_X, POS_Y);
        return { x: POS_X.get(0), y: POS_Y.get(0) };
    }

    _setFloating(handle, value) {
        if (!handle) return;
        try {
            GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_FLOATING, value ? GLFW.GLFW_TRUE : GLFW.GLFW_FALSE);
        } catch (e) {
            this._logError(e);
        }
    }

    _apply(handle) {
        if (GLFW.glfwGetWindowMonitor(handle) !== 0) {
            if (!this._blocked) {
                this._blocked = true;
                if (!this._blockedMessageShown) {
                    this._blockedMessageShown = true;
                    this.message('&cPiP needs windowed mode. Press F11 to switch out of fullscreen.');
                }
            }
            return;
        }

        this._blocked = false;

        this._saved = {
            x: this._getPos(handle).x,
            y: this._getPos(handle).y,
            width: this._getSize(handle).width,
            height: this._getSize(handle).height,
        };

        GLFW.glfwSetWindowSize(handle, PIP_WIDTH, PIP_HEIGHT);
        GLFW.glfwSetWindowPos(handle, PIP_X, PIP_Y);
        this._setFloating(handle, this.alwaysOnTop);

        this._applied = true;
        this._lastMouse = null;
    }

    _onTick() {
        if (!this.enabled) return;

        const handle = this._handle();
        if (!handle) return;

        if (!this._applied) {
            try {
                this._apply(handle);
            } catch (e) {
                this._logError(e);
                this.toggle(false);
            }
            return;
        }

        if (!this._applied || !this.dragWithMiddleMouse) return;

        if (GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_MIDDLE) !== GLFW.GLFW_PRESS) {
            this._lastMouse = null;
            return;
        }

        try {
            const mouse = MouseInfo.getPointerInfo().getLocation();
            const mouseX = mouse.getX();
            const mouseY = mouse.getY();

            if (this._lastMouse) {
                const dx = mouseX - this._lastMouse.x;
                const dy = mouseY - this._lastMouse.y;
                GLFW.glfwSetWindowPos(handle, this._getPos(handle).x + dx, this._getPos(handle).y + dy);
            }

            this._lastMouse = { x: mouseX, y: mouseY };
        } catch (e) {
            this._logError(e);
        }
    }

    _logError(e) {
        if (this._pipErrorLogged) return;
        this._pipErrorLogged = true;
        console.error('V5 Caught error' + e + e.stack);
    }

    _persistDisabled() {
        try {
            const settings = Utils.getConfigFile('config.json') || {};
            if (settings && settings.PiP) {
                settings.PiP.Enabled = false;
                if (settings['Macro Controllers'] && typeof settings['Macro Controllers'] === 'object') {
                    settings['Macro Controllers']['Picture-in-Picture (PiP)'] = false;
                }
                Utils.writeConfigFile('config.json', settings);
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }
}

new PiP();
