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
  "Mines blocks of multiple types on all islands"
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

addCategoryItem("Stuffs", "Mining Bots", "stuffs");

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
