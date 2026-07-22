import { drawRect, drawText } from '../gui/Utils';
import { getSetting } from '../gui/GuiSave';
import { Chat } from '../utils/Chat';
import { getSeverity } from './FailsafeUtils';

let failsafeSound = 'Tave Check.ogg';
const playerNotificationSound = 'Player Failsafe.ogg';

class AlertUtilsClass {
    constructor() {
        this.sound = null;
        this.savedSound = null;
        this.isAlerting = false;

        this.cancelKey = null;

        this.render = null;
        this.cancelHandler = null;

        this._makeFailsafeKeybind();

        register('command', () => {
            AlertUtils.triggerReaction();
        }).setName('trigger');
    }

    triggerReaction(severity = 'high') {
        const next = getSeverity(severity);
        if (this.isAlerting && next.rank < getSeverity(this.alertSeverity).rank) return;

        this.alertSeverity = severity;
        this.alertLine = next.line;
        this.alertColor = next.alertColor;
        if (this.isAlerting) return;

        Chat.messageFailsafe('Suspicious activity detected, reaction occuring!');
        Chat.messageFailsafe(`Press &c&l${this.cancelKey}&r &fto disable the reaction`);

        this.isAlerting = true;
        this.playSound();
        this._grabWindowOnFailsafe();

        const key = this.cancelKey;
        const line2Start = 'PRESS ';
        const line2End = ' TO DISABLE THE REACTION';

        const screenW = Renderer.screen.getWidth();
        const screenH = Renderer.screen.getHeight();

        const fontSize = 20;
        const lineSpacing = 8;
        const yOffset = 100;
        const highlightColor = 0xffffffff;

        this.render = register('renderOverlay', () => {
            const scale = fontSize / 10;
            const line1 = this.alertLine;
            const redColor = this.alertColor;
            const x1 = screenW / 2 - (Renderer.getStringWidth(line1) * scale) / 2;
            const totalLine2Width = (Renderer.getStringWidth(line2Start) + Renderer.getStringWidth(key) + Renderer.getStringWidth(line2End)) * scale;
            let currentX2 = screenW / 2 - totalLine2Width / 2;

            const totalBlockHeight = fontSize * 2 + lineSpacing;
            const startY = screenH / 2 - totalBlockHeight / 2 - yOffset;
            const y2 = startY + fontSize + lineSpacing;

            drawText(line1, x1, startY, fontSize, redColor);
            drawText(line2Start, currentX2, y2, fontSize, redColor);

            currentX2 += Renderer.getStringWidth(line2Start) * scale;
            drawText(key, currentX2, y2, fontSize, highlightColor);

            currentX2 += Renderer.getStringWidth(key) * scale;
            drawText(line2End, currentX2, y2, fontSize, redColor);

            this._renderAlertScreen();
        });
    }

    setCancelHandler(callback) {
        this.cancelHandler = typeof callback === 'function' ? callback : null;
    }

    disableReaction() {
        this.isAlerting = false;
        this.stopSound();
        const handler = this.cancelHandler;
        this.cancelHandler = null;
        if (handler) {
            try {
                handler();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        if (this.render) {
            this.render.unregister();
            this.render = null;
        }
    }

    playSound(soundName = failsafeSound) {
        if (!(getSetting('Failsafes', 'Play sound on check') ?? true)) return;

        try {
            if (!this.sound || this.savedSound !== soundName) {
                this.sound?.destroy();
                this.sound = new Sound({ source: `failsafes/sounds/${soundName}` });
                this.savedSound = soundName;
            }
            this.sound.rewind();
        } catch (e) {
            this.sound = null;
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    playQuietNotification() {
        if (this.isAlerting) return;
        this.playSound(playerNotificationSound);
    }

    stopSound() {
        if (this.sound && World.isLoaded()) this.sound.stop();
    }

    setFailsafeSound(fileName) {
        failsafeSound = fileName;
    }

    _renderAlertScreen() {
        if (Client.isInChat()) return;
        try {
            NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
            NVG.save();

            drawRect({
                x: 0,
                y: 0,
                width: Renderer.screen.getWidth(),
                height: Renderer.screen.getHeight(),
                color: 0x78ff0000,
            });

            NVG.restore();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }
    }

    _makeFailsafeKeybind() {
        const keyName = 'Cancel Reaction';
        const cancelKeyBind = new KeyBind(keyName, Keyboard.KEY_K, 'v5_core');
        this.cancelKey = Keyboard.getKeyName(cancelKeyBind.getKeyCode());

        cancelKeyBind.registerKeyPress(() => {
            if (!this.isAlerting) return;
            Chat.messageFailsafe('Reaction disabled due to keybind being pressed');
            this.disableReaction();
        });

        register('gameUnload', () => {
            this.disableReaction();
            if (this.sound && World.isLoaded()) this.sound.destroy();
            this.sound = null;
        });
    }

    _grabWindowOnFailsafe() {
        try {
            const GLFW = org.lwjgl.glfw.GLFW;
            const windowHandle = Client.getMinecraft().getWindow().handle();

            const wasIconified = GLFW.glfwGetWindowAttrib(windowHandle, GLFW.GLFW_ICONIFIED) === GLFW.GLFW_TRUE;
            const wasMaximized = GLFW.glfwGetWindowAttrib(windowHandle, GLFW.GLFW_MAXIMIZED) === GLFW.GLFW_TRUE;

            GLFW.glfwSetWindowAttrib(windowHandle, GLFW.GLFW_FOCUS_ON_SHOW, GLFW.GLFW_TRUE);
            GLFW.glfwShowWindow(windowHandle);

            if (wasIconified) {
                GLFW.glfwRestoreWindow(windowHandle);
            }

            if (wasMaximized) {
                GLFW.glfwMaximizeWindow(windowHandle);
            }

            GLFW.glfwFocusWindow(windowHandle);
            GLFW.glfwRequestWindowAttention(windowHandle);
        } catch (e) {
            Chat.messageFailsafe('GLFW error occured! report this. ' + e);
            console.error('V5 Caught error' + e + e.stack);
        }
    }
}

export const AlertUtils = new AlertUtilsClass();
