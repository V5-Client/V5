const {
  addCategoryItem,
  addToggle,
  addSlider,
  addSubCategory,
  addMultiToggle,
} = global.Categories;

/* MINING */
addCategoryItem(
  "Mining",
  "Mining Bot",
  "Universal settings for Mining & block miner"
);
addToggle("Modules", "Mining Bot", "Tick Gliding");
addToggle("Modules", "Mining Bot", "Fakelook");
addToggle("Modules", "Mining Bot", "Movement");
addMultiToggle(
  "Modules",
  "Mining Bot",
  "Types",
  ["Mithril", "Gemstone", "Ore"],
  true
);

addCategoryItem(
  "Mining",
  "Gemstone Macro",
  "Mines gemstones in the Crystal Hollows"
);

addSlider("Modules", "Gemstone Macro", "Potato");

addMultiToggle(
  "Modules",
  "Gemstone Macro",
  "title",
  ["rjr", "dont", "be", "a", "gay", "person"],
  true
);
addCategoryItem("Mining", "Ore Macro", "Mines ores across all islands");

addCategoryItem(
  "Mining",
  "Commission Macro",
  "Completes Commissions in the Dwarven Mines"
);

addCategoryItem(
  "Mining",
  "Glacite Commission Macro",
  "Completes Commissions in the Glacite Tunnels"
);

addCategoryItem(
  "Mining",
  "Excavator Macro",
  "Automatically does the excavator task"
);

addCategoryItem(
  "Mining",
  "Pingless Miner",
  "Breaks hardstone quicker in the Crystal Hollows"
);
addToggle("Modules", "Pingless Miner", "Enabled");
addSlider("Modules", "Pingless Miner", "Tick Delay", 0, 5);

/* VISUAL */
addCategoryItem(
  "Visuals",
  "Xray",
  "See through walls - Sodium and Iris will break Xray"
);
addToggle("Modules", "Xray", "Enabled");
addSlider("Modules", "Xray", "Transparency", 0, 255);

/*addCategoryItem("Visuals", "Mob Hider", "Prevent seeing and attacking mobs");
addMultiToggle(
  "Modules",
  "Mob Hider",
  "Mobs",
  ["Kalhuikis", "Sven Pups", "Jerries", "Thysts"],
  false
); */

/* OTHER */
addCategoryItem("Other", "Discord RPC", "Show you're playing V5!");
addToggle("Modules", "Discord RPC", "Enabled");

/*addCategoryItem(
  "Modules",
  "Gemstone Macro",
  "Mines gemstones in the Crystal Hollows"
);
// toggles etc

addCategoryItem("Modules", "Ores Macro", "Mines ores of all types");
// toggles

addCategoryItem(
  "Modules",
  "Commission Macro",
  "Completes commissions in the Dwarven Mines"
);

addSeparator("Modules", "Visuals"); */
