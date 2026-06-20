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

const triggerName = (name) => `v5skyblock${name.toLowerCase()}`;
const events = [...new Set([...Object.values(STARTSWITH_CHECKS), ...Object.values(INCLUDE_CHECKS)])];
const triggers = {};
for (const name of events) {
    triggers[name] = createCustomTrigger(triggerName(name));
}

register('chat', (event) => {
    const msg = event.message.getUnformattedText();
    const lower = msg.toLowerCase();

    for (const phrase in STARTSWITH_CHECKS) {
        if (msg.startsWith(phrase)) return triggers[STARTSWITH_CHECKS[phrase]].trigger();
    }

    for (const phrase in INCLUDE_CHECKS) {
        if (lower.includes(phrase.toLowerCase())) return triggers[INCLUDE_CHECKS[phrase]].trigger();
    }
});

/**
 * @param {string} name
 * @param {function} callback
 */
export const registerEventSB = (name, callback) => register(triggerName(name), callback);

export const manager = { subscribe: registerEventSB };
