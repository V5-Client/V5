let _instance = null;

class Debug {
    getInstance() {
        if (!_instance) {
            const { ModuleBase } = require('./ModuleBase');

            _instance = new (class DebuggingModule extends ModuleBase {
                constructor() {
                    super({
                        name: 'Debugging',
                        subcategory: 'Core',
                        description: 'Debugging tools',
                        showEnabledToggle: false,
                    });

                    this.DEBUG_MESSAGES = false;
                    this.addToggle('Debug Messages', (v) => (this.DEBUG_MESSAGES = v), 'Sends debug messages in chat', true);
                }
            })();
        }

        return _instance;
    }

    Messages() {
        return this.getInstance().DEBUG_MESSAGES;
    }
}

export const Debugging = new Debug();
