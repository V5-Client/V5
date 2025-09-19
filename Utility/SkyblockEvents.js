const actions = new Map();

function registerEventSB(name, callback) {
    const eventName = name.toLowerCase();
    if (!actions.has(eventName)) {
        actions.set(eventName, []);
    }
    actions.get(eventName).push(callback);
}

function CheckEvents(event) {
    const ev = event.toLowerCase();
    if (actions.has(ev)) {
        actions.get(ev).forEach((action) => action());
    }
}

register('chat', (event) => {
    let msg = event.message.getUnformattedText();

    if (msg.includes('Sending to server')) CheckEvents('serverchange');

    /* Ability */
    if (
        msg.includes('Mining Speed Boost is now available!') ||
        msg.includes('Maniac Miner is now available!') ||
        msg.includes('Pickobulus is now available!')
    ) {
        CheckEvents('abilityready');
    }

    if (
        msg.includes('You used your Mining Speed Boost Pickaxe Ability!') ||
        msg.includes('You used your Maniac Miner Pickaxe Ability!') ||
        msg.includes('You used your Pickobulus Pickaxe Ability!')
    ) {
        CheckEvents('abilityused');
    }

    if (
        msg.includes('Your Mining Speed Boost has expired!') ||
        msg.includes('Your Maniac Miner has expired!') ||
        msg.includes('Your Pickobulus has expired!')
    )
        CheckEvents('abilitygone');

    if (msg.startsWith('This ability is on cooldown for'))
        CheckEvents('abilitycooldown');

    /* Misc */
    if (
        msg.startsWith("You can't use this while") ||
        msg.startsWith("You can't fast travel while")
    )
        CheckEvents('incombat');

    if (msg.startsWith('Oh no! Your')) CheckEvents('pickonimbusbroke');

    if (msg.startsWith('You uncovered a treasure')) CheckEvents('chestspawn');

    if (msg.startsWith('You have successfully picked'))
        CheckEvents('chestsolve');

    if (msg.startsWith('Inventory full?')) CheckEvents('fullinventory');

    if (msg.startsWith('You need the Cookie Buff'))
        CheckEvents('noboostercookie');

    if (msg.startsWith(' ☠ You ')) CheckEvents('death');
});

register('chat', () => {
    CheckEvents('emptydrill');
})
    .setCriteria('is empty! Refuel it by talking to a Drill Mechanic!')
    .setContains();

register('chat', () => {
    CheckEvents('emptydrill');
})
    .setCriteria(
        'has too little fuel to keep mining blocks of this type! Refuel it by talking to a Drill Mechanic!'
    )
    .setContains();

export { registerEventSB };
