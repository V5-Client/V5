const actions = [];

// Register handlers (called from outside)
function registerEventSB(name, callback) {
  actions.push({ name: name.toLowerCase(), action: callback });
}

// Internal function to trigger events
function CheckEvents(event) {
  const ev = event.toLowerCase();
  for (const a of actions) {
    if (a.name === ev) a.action();
  }
}

register("chat", (event) => {
  let msg = event.message.getString();

  if (msg.includes("Sending to server"))
    CheckEvents("serverchange"), ChatLib.chat("EOOOOO");

  /* Ability */
  if (
    msg.includes("Mining Speed Boost is now available!") ||
    msg.includes("Maniac Miner is now available")
  )
    CheckEvents("abilityready");

  if (msg.includes("Pickobulus is now available")) CheckEvents("pickoready");

  if (
    msg.includes("You used your Mining Speed Boost Pickaxe Ability!") ||
    msg.includes("You used your Maniac Miner Pickaxe Ability!") ||
    msg.includes("You used your Pickobulus Pickaxe Ability!")
  )
    CheckEvents("abilityused");

  if (
    msg.includes("Your Mining Speed Boost has expired!") ||
    msg.includes("Your Maniac Miner has expired!") ||
    msg.includes("Your Pickobulus has expired!")
  )
    CheckEvents("abilitygone");

  if (msg.startsWith("This ability is on cooldown for"))
    CheckEvents("abilitycooldown");

  /* Misc */
  if (
    msg.startsWith("You can't use this while") ||
    msg.startsWith("You can't fast travel while")
  )
    CheckEvents("incombat");

  if (msg.startsWith("Oh no! Your")) CheckEvents("pickonimbusbroke");

  if (msg.startsWith("You uncovered a treasure")) CheckEvents("chestspawn");

  if (msg.startsWith("You have successfully picked")) CheckEvents("chestsolve");

  if (msg.startsWith("Inventory full?")) CheckEvents("fullinventory");

  if (msg.startsWith("You need the Cookie Buff"))
    CheckEvents("noboostercookie");

  if (msg.startsWith(" ☠ You ")) CheckEvents("death");
});

register("chat", () => {
  CheckEvents("emptydrill");
})
  .setCriteria("is empty! Refuel it by talking to a Drill Mechanic!")
  .setContains();

register("chat", () => {
  CheckEvents("emptydrill");
})
  .setCriteria(
    "has too little fuel to keep mining blocks of this type! Refuel it by talking to a Drill Mechanic!"
  )
  .setContains();

export { registerEventSB };
