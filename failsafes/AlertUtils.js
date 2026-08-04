import { drawRect, drawText } from '../gui/Utils';
import { Chat } from '../utils/Chat';
import { File, globalAssetsDir } from '../utils/Constants';
import { Notifications } from '../utils/Notifications';
import { Utils } from '../utils/Utils';
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
        this.failsafeVolume = 100;
        this.customFailsafeSound = '';
        this.grabWindowOnCheck = false;

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
        this._refreshSettings();
        this.playSound();
        this.sendDesktopAlert();
        if (this.grabWindowOnCheck) this._grabWindowOnFailsafe();

        const line1 = 'V5 BELIEVES YOU HAVE BEEN MACRO CHECKED!';
        const key = this.cancelKey;
        const line2Start = 'PRESS ';
        const line2End = ' TO DISABLE THE REACTION';

        const fontSize = 20;
        const lineSpacing = 8;
        const yOffset = 100;
        const redColor = Math.trunc(0xffff0000); // change this
        const highlightColor = Math.trunc(0xffffffff); // this too

        this.render = register('renderOverlay', () => {
            const screenW = Renderer.screen.getWidth();
            const screenH = Renderer.screen.getHeight();
            try {
                NVG.beginFrame(screenW, screenH);
                NVG.save();
                this._renderAlertScreen(screenW, screenH);

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
        this._playCurrentSound();
    }

    /**
     * Plays the currently selected failsafe sound, ignoring the sound toggle
     */
    previewAlert() {
        this._refreshSettings();
        this._playCurrentSound();
        Chat.messageFailsafe(`&aPreviewing failsafe sound at ${Math.max(0, Math.min(100, this.failsafeVolume))}% volume.`);
    }

    /**
     * Loads and plays the current sound at the configured volume
     */
    _playCurrentSound() {
        const currentSound = this._resolveSoundName();
        if (!this.clip || this.savedSound !== currentSound) this._loadsoundFile();
        this._applyVolume();

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

    /**
     * Sends a native desktop notification if the player has the setting toggled
     */
    sendDesktopAlert() {
        try {
            if (!FailsafeUtils.getFailsafeSettings('Desktop Notification on Check').desktopNotificationOnCheck) return;
            Notifications.sendAlert('V5 believes you have been macro checked!');
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    setFailsafeSound(fileName) {
        failsafeSound = fileName;
    }

    setFailsafeVolume(volume) {
        this.failsafeVolume = volume;
        this._applyVolume();
    }

    setCustomFailsafeSound(value) {
        this.customFailsafeSound = typeof value === 'string' ? value.trim() : '';
        this.savedSound = null;
    }

    /**
     * Pulls the latest sound related settings from the failsafe config
     */
    _refreshSettings() {
        try {
            const settings = FailsafeUtils.getFailsafeSettings('Failsafe Actions');
            this.failsafeVolume = typeof settings.failsafeVolume === 'number' ? settings.failsafeVolume : 100;
            this.customFailsafeSound = typeof settings.customFailsafeSound === 'string' ? settings.customFailsafeSound.trim() : '';
            this.grabWindowOnCheck = !!settings.grabWindowOnCheck;
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    /**
     * Resolves the sound to use, preferring a custom sound if one is set
     */
    _resolveSoundName() {
        if (this.customFailsafeSound) return this.customFailsafeSound;
        return !failsafeSound || failsafeSound.includes('undefined') ? 'Tave Check.wav' : failsafeSound;
    }

    /**
     * Applies the configured volume to the current gain control
     */
    _applyVolume() {
        try {
            if (!this.gainControl) return;
            const volume = Math.max(0, Math.min(100, Number(this.failsafeVolume) || 100)) / 100;
            const min = this.gainControl.getMinimum();
            const max = this.gainControl.getMaximum();
            this.gainControl.setValue(min + (max - min) * volume);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    /**
     * Loads a sound file using Java methods
     */
    _loadsoundFile() {
        this._closeSound();

        const currentSound = this._resolveSoundName();
        this.savedSound = currentSound;

        const hasSeparator = currentSound.includes('/') || currentSound.includes('\\');
        this.soundFile = hasSeparator ? new File(currentSound) : new File(globalAssetsDir, `failsafes/sounds/${currentSound}`);
        if (!this.soundFile.exists()) return;

        try {
            this.audioStream = AudioSystem.getAudioInputStream(this.soundFile);
            this.clip = AudioSystem.getClip();
            this.clip.open(this.audioStream);
            if (this.clip.isControlSupported(FloatControl.Type.MASTER_GAIN)) {
                this.gainControl = this.clip.getControl(FloatControl.Type.MASTER_GAIN);
            }
            this._applyVolume();
        } catch (e) {
            this._closeSound();
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    _closeSound() {
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
        this.gainControl = null;
    }

    /**
     * Uses NVG to draw a overlay over the whole screen
     */
    _renderAlertScreen(screenW, screenH) {
        if (Client.isInChat()) return;
        drawRect({
            x: 0,
            y: 0,
            width: screenW,
            height: screenH,
            color: Math.trunc((120 << 24) | (255 << 16) | (0 << 8)), // change this too pls
        });
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
        this.cancelKeyBind = new KeyBind(keyName, savedKeycode, 'v5_core');

        this.cancelKeyBind.registerKeyPress(() => {
            if (!this.isAlerting) return;
            Chat.messageFailsafe('Reaction disabled due to keybind being pressed');
            this.disableReaction();
        });

        register('gameUnload', () => {
            this.disableReaction();
            this._closeSound();
            const allKeybinds = Utils.getConfigFile('keybinds.json') || {};
            allKeybinds[keyName] = this.cancelKeyBind.getKeyCode();
            Utils.writeConfigFile('keybinds.json', allKeybinds);
        });
    }

    /**
     * Uses GLFW to grab the window on a failsafe if they have the setting toggled (WIP)
     */
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
