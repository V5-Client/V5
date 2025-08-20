const { addCategory, addCategoryItem, addToggle, addSlider } =
  global.Categories;

/* MINING */
addCategory("Mining");

addCategoryItem(
  "Mining",
  "Mining Bot",
  "Mines blocks of multiple types on all islands",
  "MiningBot.png"
);

addCategoryItem(
  "Mining",
  "Gemstone Macro",
  "Mines gemstones in the Crystal Hollows",
  "Gemstone.png"
);
// toggles etc

addCategoryItem("Mining", "Ores Macro", "Mines ores of all types", "Ore.png");
// toggles

addCategoryItem(
  "Mining",
  "Commission Macro",
  "Completes commissions in the Dwarven Mines",
  "Commission.png"
);
