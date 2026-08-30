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
    'Commission Complete! Visit the King to claim': 'commissioncomplete',
    "you haven't unlocked this fast travel destination": 'fasttravellocked',
    'Teleported you to The Barn!': 'barnteleport',
    'Teleported you to Plot': 'plotteleport',
    'Your tool has 0 durability left': 'wynndurability',
    'is available to turn in! Type /quests to claim it.': 'fishquestready',
    "You don't have enough ": 'sprayonatorunavailable',
};

const CALLBACKS = new Map();

const getEventName = (event) => {
    const msg = event.message.getUnformattedText();
    const lower = msg.toLowerCase();

    for (const phrase in STARTSWITH_CHECKS) {
        if (msg.startsWith(phrase)) return STARTSWITH_CHECKS[phrase];
    }

    for (const phrase in INCLUDE_CHECKS) {
        if (lower.includes(phrase.toLowerCase())) return INCLUDE_CHECKS[phrase];
    }

    return null;
};

register('chat', (event) => {
    const callbacks = CALLBACKS.get(getEventName(event));
    if (callbacks) callbacks.forEach((callback) => callback(event));
});

/**
 * @param {string} name
 * @param {function} callback
 */
export const registerSkyblockEvent = (name, callback) => {
    name = name.toLowerCase();
    if (!CALLBACKS.has(name)) CALLBACKS.set(name, []);
    CALLBACKS.get(name).push(callback);
};
