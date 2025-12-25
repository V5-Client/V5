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
        if (!this.listeners[id]) {
            this.listeners[id] = [];
        }
        this.listeners[id].push(callback);
    }

    /**
     * Dispatches all callbacks associated with an event key
     * @param {string} key - Event identifier
     */
    emit(key) {
        const id = key.toLowerCase();
        if (this.listeners[id]) {
            this.listeners[id].forEach(fn => {
                try {
                    fn();
                } catch (e) {
                    console.error('SkyblockEvent execution error: ' + id, e);
                }
            });
        }
    }

    setupTriggers() {
        register('chat', (event) => {
            const raw = event.message.getUnformattedText();

            if (raw.includes('Sending to server')) this.emit('serverchange');
            if (raw === 'Warping...') this.emit('warp');
            if (raw.startsWith(' ☠ You ')) this.emit('death');

            if (raw.includes('is empty! Refuel it')) this.emit('emptydrill');
            if (raw.includes('has too little fuel to keep mining')) this.emit('emptydrill');
            if (raw.startsWith('Oh no! Your')) this.emit('pickonimbusbroke');
            const up = raw.toLowerCase();
            if (up.includes('available!')) {
                if (up.includes('speed boost') || up.includes('maniac miner') || up.includes('pickobulus')) {
                    this.emit('abilityready');
                }
            }
            if (up.includes('you used your')) {
                if (up.includes('speed boost') || up.includes('maniac miner') || up.includes('pickobulus')) {
                    this.emit('abilityused');
                }

            if (raw.includes('Your Mining Speed Boost has expired!') || raw.includes('Your Maniac Miner has expired!')) // no clue if manic miner has a message, autocomplete suggested this
                this.emit('abilitygone');

            if (raw.startsWith('This ability is on cooldown for')) this.emit('abilitycooldown');

            if (raw.startsWith('You uncovered a treasure')) this.emit('chestspawn');
            if (raw.startsWith('You have successfully picked')) this.emit('chestsolve');
            if (raw.startsWith('Inventory full?')) this.emit('fullinventory');
            if (raw.startsWith("You can't use this while") || raw.startsWith("You can't fast travel while")) {
                this.emit('incombat');
            }
            if (raw.startsWith('You need the Cookie Buff')) this.emit('noboostercookie');
        }});
    }
}

export const manager = new SkyblockEventManager();

/**
 * @deprecated Use the manager instead
 * @param {string} name 
 * @param {function} callback 
 */
export const registerEventSB = (name, callback) => manager.subscribe(name, callback);
