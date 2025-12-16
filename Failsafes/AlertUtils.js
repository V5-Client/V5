import { File } from '../utils/Constants';
import FailsafeUtils from './FailsafeUtils';

const AudioSystem = javax.sound.sampled.AudioSystem;
const FloatControl = javax.sound.sampled.FloatControl;

class AlertUtilsClass {
    constructor() {
        this.clip = null;
        this.audioStream = null;
        this.gainControl = null;
        this.savedSound = null;
    }

    alertPlayer() {
        this.playSound();
    }

    playSound() {
        if (!FailsafeUtils.getFailsafeSettings('Play sound on check').playSoundOnCheck) return;
        if (!this.clip || this.savedSound !== global.failsafeSound) this._loadsoundFile();

        this.clip.stop();
        this.clip.setFramePosition(0);

        this.clip.start();
    }

    stopSound() {
        if (this.clip && this.clip.isRunning()) this.clip.stop();
    }

    _loadsoundFile() {
        this.savedSound = global.failsafeSound;

        this.soundFile = new File(Client.getMinecraft().runDirectory, `config/ChatTriggers/modules/V5/Failsafes/sounds/${this.savedSound}`);

        if (!this.soundFile) return;

        try {
            this.audioStream = AudioSystem.getAudioInputStream(this.soundFile);

            this.clip = AudioSystem.getClip();
            this.clip.open(this.audioStream);

            if (this.clip.isControlSupported(FloatControl.Type.MASTER_GAIN)) this.gainControl = this.clip.getControl(FloatControl.Type.MASTER_GAIN);
        } catch (e) {
            this.clip = null;
        }
    }
}

export const AlertUtils = new AlertUtilsClass();
