import { SoundHelper } from './AlertUtils.js';

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
}
