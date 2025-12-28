import { AlertUtils } from './AlertUtils.js';
import { Chat } from '../utils/Chat.js';

if (!global.V5_FAILSAFE_CMD_REGISTERED) {
    register('command', () => {
        AlertUtils.isAlerting = true;
        AlertUtils.triggerReaction();
    }).setName('trigger');
    global.V5_FAILSAFE_CMD_REGISTERED = true;
}

export class Failsafe {
    constructor() {}

    shouldTrigger() {
        return true;
    }
    onTrigger() {}
    reset() {}
}
