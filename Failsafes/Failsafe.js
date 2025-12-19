import { AlertUtils } from './AlertUtils.js';
import { Chat } from '../utils/Chat.js';

export class Failsafe {
    constructor() {
        register('command', () => {
            AlertUtils.isAlerting = true;
            AlertUtils.triggerReaction();
        }).setName('trigger');
    }

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {}
}
