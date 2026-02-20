import { drawRect, drawText } from '../gui/Utils.js';
import { Chat } from '../utils/Chat.js';
import { File, KeyBindUtils, NVG } from '../utils/Constants';
import { Utils } from '../utils/Utils.js';
import FailsafeUtils from './FailsafeUtils';

let failsafeSound = 'Tave Check.wav';

const AudioSystem = javax.sound.sampled.AudioSystem;
const FloatControl = javax.sound.sampled.FloatControl;

// todo
// touchen up colours rn they ugly
// touch up code
// rewrite some stuff!
// allow edit of failsafe sound

class AlertUtilsClass {
    constructor() {
        this.clip = null;
        this.audioStream = null;
        this.gainControl = null;
        this.savedSound = null;
        this.isAlerting = false;

        this.cancelKeyBind = null;
        this.cancelKey = null;

        this.render = null;
        this.tracker = null;

        this._makeFailsafeKeybind();

        register('command', () => {
            AlertUtils.triggerReaction();
        }).setName('trigger');
    }

    /**
     * Combines all internal methods to create a failsafe alert
     */
    triggerReaction() {
        if (this.isAlerting) return;

        Chat.messageFailsafe('Suspicious activity detected, reaction occuring!');
        Chat.messageFailsafe(`Press &c&l${this.cancelKey}&r &fto disable the reaction`);

        this.isAlerting = true;
        this.playSound();
        this._grabWindowOnFailsafe();

        const line1 = 'V5 BELIEVES YOU HAVE BEEN MACRO CHECKED!';
        const key = `${this.cancelKey}`;
        const line2Start = 'PRESS ';
        const line2End = ' TO DISABLE THE REACTION';

        const screenW = Renderer.screen.getWidth();
        const screenH = Renderer.screen.getHeight();

        const fontSize = 20;
        const lineSpacing = 8;
        const yOffset = 100;
        const redColor = Math.trunc(0xffff0000); // change this
        const highlightColor = Math.trunc(0xffffffff); // this too

        this.render = register('renderOverlay', () => {
            const scale = fontSize / 10;
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

    /**
     * Disables the reaction & nulls all registers included
     */
    disableReaction() {
        this.isAlerting = false;
        this.stopSound();

        if (this.render) {
            this.render.unregister();
            this.render = null;
        }

        if (this.tracker) {
            this.tracker.unregister();
            this.tracker = null;
        }
    }

    /**
     * Plays a sound if the player has the setting toggled
     */
    playSound() {
        if (!FailsafeUtils.getFailsafeSettings('Play sound on check').playSoundOnCheck) return;
        const currentSound = failsafeSound;
        if (!this.clip || this.savedSound !== currentSound) this._loadsoundFile();

        if (this.clip) {
            this.clip.stop();
            this.clip.setFramePosition(0);
            this.clip.start();
        }
    }

    /**
     * Stops any sounds from playing
     */
    stopSound() {
        if (this.clip && this.clip.isRunning()) this.clip.stop();
    }

    setFailsafeSound(fileName) {
        failsafeSound = fileName;
    }

    /**
     * Loads a sound file using Java methods
     */
    _loadsoundFile() {
        if (this.clip) {
            try {
                this.clip.stop();
                this.clip.close();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
            this.clip = null;
        }

        if (this.audioStream) {
            try {
                this.audioStream.close();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
            this.audioStream = null;
        }

        const currentSound = failsafeSound;
        this.savedSound = currentSound || 'Tave Check.wav';
        if ((currentSound || '').includes('undefined')) this.savedSound = 'Tave Check.wav';

        this.soundFile = new File(Client.getMinecraft().runDirectory, `config/ChatTriggers/assets/failsafes/sounds/${this.savedSound}`);
        if (!this.soundFile.exists()) return;

        try {
            this.audioStream = AudioSystem.getAudioInputStream(this.soundFile);
            this.clip = AudioSystem.getClip();
            this.clip.open(this.audioStream);
            if (this.clip.isControlSupported(FloatControl.Type.MASTER_GAIN)) {
                this.gainControl = this.clip.getControl(FloatControl.Type.MASTER_GAIN);
            }
        } catch (e) {
            this.clip = null;
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    /**
     * Uses NVG to draw a overlay over the whole screen
     */
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
                color: Math.trunc((120 << 24) | (255 << 16) | (0 << 8)), // change this too pls
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

    /**
     * Creates a keybind for canceling the reaction
     */
    _makeFailsafeKeybind() {
        const keyName = 'Cancel Reaction';
        const existingKeybinds = Utils.getConfigFile('keybinds.json') || {};
        let savedKeycode = existingKeybinds[keyName];

        if (savedKeycode === undefined || savedKeycode === 0 || savedKeycode === -1 || savedKeycode === 75) savedKeycode = Keyboard.KEY_K;

        this.cancelKey = Keyboard.getKeyName(savedKeycode);
        this.cancelKeyBind = KeyBindUtils.create('reactionKey', keyName, savedKeycode);

        this.cancelKeyBind.onKeyPress(() => {
            if (!this.isAlerting) return;
            Chat.messageFailsafe('Reaction disabled due to keybind being pressed');
            this.disableReaction();
        });

        register('gameUnload', () => {
            let allKeybinds = Utils.getConfigFile('keybinds.json') || {};
            allKeybinds[keyName] = this.cancelKeyBind.keyBinding.boundKey.code;
            Utils.writeConfigFile('keybinds.json', allKeybinds);

            this.stopSound();
        });
    }

    /**
     * Uses GLFW to grab the window on a failsafe if they have the setting toggled (WIP)
     */
    _grabWindowOnFailsafe() {
        try {
            const GLFW = org.lwjgl.glfw.GLFW;
            const windowHandle = Client.getMinecraft().getWindow().getHandle();

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
