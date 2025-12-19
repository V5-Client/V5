import { File } from '../utils/Constants';
import { drawRect, NVG, drawText, THEME } from '../GUI/Utils.js';
import { ModuleBase } from '../utils/ModuleBase.js';
import { Utils } from '../utils/Utils.js';
import FailsafeUtils from './FailsafeUtils';
import { Chat } from '../utils/Chat.js';

const AudioSystem = javax.sound.sampled.AudioSystem;
const FloatControl = javax.sound.sampled.FloatControl;

// todo
// touchen up colours rn they ugly
// touch up code
// rewrite some stuff!

class AlertUtilsClass {
    constructor() {
        this.clip = null;
        this.audioStream = null;
        this.gainControl = null;
        this.savedSound = null;
        this.isAlerting = false;

        this.cancelKeyBind = null;
        this.cancelKey = null;

        this.alertText = null;
        this.alertScreen = null;
        this.tracker = null;

        this._makeFailsafeKeybind();
    }

    triggerReaction() {
        if (this.alertText || this.alertScreen) return;

        Chat.failsafeMessage('Suspicious activity detected, reaction occuring!');
        Chat.failsafeMessage(`Press &c&l${this.cancelKey}&r &fto disable the reaction`);

        this.isAlerting = true;
        this.playSound();

        const line1 = 'V5 BELIEVES YOU HAVE BEEN MACRO CHECKED!';
        const key = `${this.cancelKey}`;
        const line2Start = 'PRESS ';
        const line2End = ' TO DISABLE THE REACTION';

        const screenW = Renderer.screen.getWidth();
        const screenH = Renderer.screen.getHeight();

        const fontSize = 20;
        const lineSpacing = 8;
        const yOffset = 100;
        const redColor = 0xffff0000; // change this
        const highlightColor = 0xffffffff; // this too

        this.alertText = register('renderOverlay', () => {
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
        });

        this.alertScreen = register('renderOverlay', () => {
            this._renderAlertScreen();
        });

        this.tracker = register('step', () => {
            if (this.cancelKeyBind.isPressed()) {
                Chat.failsafeMessage('Reaction disabled due to keybind being pressed');
                this.disableReaction();
            }

            if (Client.isInGui()) {
                this.disableReaction();
            }
        });
    }

    disableReaction() {
        this.isAlerting = false;
        this.stopSound();

        this.alertText.unregister();
        this.alertText = null;

        this.alertScreen.unregister();
        this.alertScreen = null;

        this.tracker.unregister();
        this.tracker = null;
    }

    playSound() {
        if (!FailsafeUtils.getFailsafeSettings('Play sound on check').playSoundOnCheck) return;
        if (!this.clip || this.savedSound !== global.failsafeSound) this._loadsoundFile();

        if (this.clip) {
            this.clip.stop();
            this.clip.setFramePosition(0);
            this.clip.start();
        }
    }

    stopSound() {
        if (this.clip && this.clip.isRunning()) this.clip.stop();
    }

    _loadsoundFile() {
        this.savedSound = global.failsafeSound;
        this.soundFile = new File(Client.getMinecraft().runDirectory, `config/ChatTriggers/modules/V5/Failsafes/sounds/${this.savedSound}`);
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
        }
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
                color: (120 << 24) | (255 << 16) | (0 << 8) | 0, // change this too pls
            });

            NVG.restore();
        } catch (e) {
        } finally {
            try {
                NVG.endFrame();
            } catch (e) {}
        }
    }

    _makeFailsafeKeybind() {
        const keyName = 'Cancel Reaction';
        const existingKeybinds = Utils.getConfigFile('keybinds.json') || {};
        let savedKeycode = existingKeybinds[keyName];

        if (savedKeycode === undefined || savedKeycode === 0 || savedKeycode === -1 || savedKeycode === 75) savedKeycode = Keyboard.KEY_K;

        this.cancelKey = Keyboard.getKeyName(savedKeycode);
        this.cancelKeyBind = new KeyBind(keyName, savedKeycode, 'v5');

        register('gameUnload', () => {
            let allKeybinds = Utils.getConfigFile('keybinds.json') || {};
            allKeybinds[keyName] = this.cancelKeyBind.getKeyCode();
            Utils.writeConfigFile('keybinds.json', allKeybinds);
        });
    }
}

export const AlertUtils = new AlertUtilsClass();
