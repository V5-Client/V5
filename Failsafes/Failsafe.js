import { AlertUtils } from './AlertUtils.js';

export class Failsafe {
    constructor() {
        register('command', () => {
            AlertUtils.playSound();
        }).setName('trigger');
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {}
}
