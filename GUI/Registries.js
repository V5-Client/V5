const {
  addCategory,
  addCategoryItem,
  addToggle,
  addSlider,
} = global.Categories;

addCategory("QOL");
addCategoryItem(
  "QOL",
  "Auto Harp",
  "Automatically plays the harp for you.",
  "Gemstone.png"
);
addToggle("QOL", "Auto Harp", "Enabled");
addSlider("QOL", "Auto Harp", "Speed");