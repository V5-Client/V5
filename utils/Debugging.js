import { ModuleBase } from './ModuleBase';
import { isDebugMessagesEnabled, setDebugMessagesEnabled } from './DebugState';

class DebuggingModule extends ModuleBase {
    constructor() {
        super({
            name: 'Debugging',
            subcategory: 'Other',
            description: 'Debugging tools',
            showEnabledToggle: false,
        });

        setDebugMessagesEnabled(false);
        this.addToggle('Debug Messages', (v) => setDebugMessagesEnabled(v), 'Sends debug messages in chat', true);
    }

    Messages() {
        return isDebugMessagesEnabled();
    }
}

export const Debugging = new DebuggingModule();
