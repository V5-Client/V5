import { Chat } from './Chat';

class SkyblockEventManager {
    constructor() {
        this.listeners = {};
        this.setupTriggers();
    }

    /**
     * Subscribe to a custom event
     * @param {string} name - Event identifier
     * @param {function} callback - Execution block
     */
    subscribe(name, callback) {
        const id = name.toLowerCase();
        if (!this.listeners[id]) this.listeners[id] = [];
        this.listeners[id].push(callback);
    }

    /**
     * Dispatches all callbacks associated with an event key
     * @param {string} key - Event identifier
     */
    emit(key) {
        const id = key.toLowerCase();
        if (!this.listeners[id]) return;

        this.listeners[id].forEach((fn) => {
            try {
                fn();
            } catch (e) {
                Chat.log(`SkyblockEvent error: ${id}`);
                console.error('V5 Caught error' + e + e.stack);
            }
        });
    }

    setupTriggers() {
        const STARTSWITH_CHECKS = {
            ' ☠ You ': 'death',
            'Oh no! Your': 'pickonimbusbroke',
            'You uncovered a treasure': 'chestspawn',
            'You have successfully picked': 'chestsolve',
            'Inventory full?': 'fullinventory',
            'This ability is on cooldown': 'abilitycooldown',
            'You need the Cookie Buff': 'noboostercookie',
            'CHEST LOCKPICKED': 'chestopen',
            'You were spawned in Limbo': 'limbo',
        };

        const INCLUDE_CHECKS = {
            'Sending to server': 'serverchange',
            'Warping...': 'warp',
            'is empty! Refuel it': 'emptydrill',
            'too little fuel to keep mining': 'emptydrill',
            'is now available!': 'abilityready',
            'you used your': 'abilityused',
            'expired!': 'abilitygone',
            "can't use this while": 'incombat',
            "can't fast travel while": 'incombat',
        };

        register('chat', (event) => {
            const msg = event.message.getUnformattedText();
            const lower = msg.toLowerCase();

            for (const phrase in STARTSWITH_CHECKS) {
                if (msg.startsWith(phrase)) {
                    return this.emit(STARTSWITH_CHECKS[phrase]);
                }
            }

            for (const phraseKey in INCLUDE_CHECKS) {
                if (lower.includes(phraseKey.toLowerCase())) {
                    return this.emit(INCLUDE_CHECKS[phraseKey]);
                }
            }
        });
    }
}

export const manager = new SkyblockEventManager();

/**
 * @deprecated Use the manager instead
 * @param {string} name
 * @param {function} callback
 */
export const registerEventSB = (name, callback) => manager.subscribe(name, callback);
