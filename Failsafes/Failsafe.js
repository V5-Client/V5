import { SoundHelper } from './sounds/SoundHelper';

export class Failsafe {
    constructor() {
        register('command', () => {
            SoundHelper.playSound();
        }).setName('trigger');
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {}

    PlaySound() {
        let sound = new Sound({ source: 'alarm-check.ogg' });
        ChatLib.chat(global.failsafeSound);
        sound.setVolume(1);
        sound.play();
    }
}
