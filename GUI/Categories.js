// File: categories.js
// Purpose: Manages all category-related data, drawing, and interaction logic.

const Color = Java.type("java.awt.Color");

// Initialize categories data structure
if (!global.Categories) {
  global.Categories = {
    categories: [],
    selected: null,
    addCategory(name) {
      if (!this.categories.find((c) => c.name === name)) {
        this.categories.push({ name, items: [] });
      }
    },
    addCategoryItem(categoryName, title, description) {
      const category = this.categories.find((c) => c.name === categoryName);
      if (!category) return;
      category.items.push({ title, description });
    },
    removeCategory(name) {
      this.categories = this.categories.filter((c) => c.name !== name);
      if (this.selected === name) this.selected = null;
    },
  };
}

// Example Data (for testing)
global.Categories.addCategory("General");
global.Categories.addCategory("Combat");
global.Categories.addCategoryItem(
  "General",
  "Welcome!",
  "This is the general settings page."
);
global.Categories.addCategoryItem(
  "Combat",
  "KillAura",
  "Settings for the KillAura module."
);

/**
 * Creates and returns an object responsible for managing category UI.
 * This function encapsulates all category logic and decouples it from the main GUI foundation.
 * @param {object} deps - Dependencies from the main GUI file.
 * @param {object} deps.rectangles - The layout rectangles (Background, LeftPanel, etc.).
 * @param {object} deps.draw - Drawing functions { drawRoundedRectangle, drawRoundedRectangleWithBorder }.
 * @param {object} deps.utils - Utility functions { isInside }.
 * @returns {object} An object with `draw` and `handleClick` methods.
 */
global.createCategoriesManager = (deps) => {
  // Category styling
  const CATEGORY_HEIGHT = 30;
  const CATEGORY_PADDING = 5;
  const PADDING = 10; // Local copy of padding for convenience
  const CORNER_RADIUS = 10;
  const BORDER_WIDTH = 2;

  const CATEGORY_INNER_LINE_COLOR = new Color(0.4, 0.4, 0.4, 1);
  const CATEGORY_OFFSET_Y = 50;
  const CATEGORY_BOX_HEIGHT = 100;
  const CATEGORY_BOX_PADDING = 10;
  const CATEGORY_TITLE_COLOR = 0xffffff;
  const CATEGORY_DESC_COLOR = 0xaaaaaa;
  const BAR_COLOR = new Color(0.15, 0.15, 0.15, 1);
  const BAR_BORDER_COLOR = new Color(0.18, 0.18, 0.18, 1);

  const draw = () => {
    // Draw left panel categories
    global.Categories.categories.forEach((cat, i) => {
      const x = deps.rectangles.LeftPanel.x + PADDING;
      const y =
        deps.rectangles.LeftPanel.y +
        PADDING +
        CATEGORY_OFFSET_Y +
        i * (CATEGORY_HEIGHT + CATEGORY_PADDING);
      const width = deps.rectangles.LeftPanel.width - PADDING * 2;
      const height = CATEGORY_HEIGHT;

      // Draw inner line
      const lineY = y + height - 2;
      deps.draw.drawRoundedRectangle({
        x: x + 5,
        y: lineY,
        width: width - 10,
        height: 1,
        radius: 0,
        color: CATEGORY_INNER_LINE_COLOR,
      });

      const textColor =
        global.Categories.selected === cat.name ? 0x800080 : 0xffffff;
      const textHeight = 8;
      const textY = lineY - (height - 2 - textHeight) / 2 - 1;
      Renderer.drawString(
        cat.name,
        x + width / 2 - Renderer.getStringWidth(cat.name) / 2,
        textY,
        textColor,
        false
      );
    });

    // Draw right panel content ONLY if a category is selected
    if (global.Categories.selected) {
      const cat = global.Categories.categories.find(
        (c) => c.name === global.Categories.selected
      );
      if (!cat) return;
      const x = deps.rectangles.RightPanel.x + PADDING;
      let y = deps.rectangles.RightPanel.y + PADDING;
      const width = deps.rectangles.RightPanel.width - PADDING * 2;
      cat.items.forEach((item, i) => {
        const height = CATEGORY_BOX_HEIGHT;
        deps.draw.drawRoundedRectangleWithBorder({
          x,
          y,
          width,
          height,
          radius: CORNER_RADIUS,
          color: BAR_COLOR,
          borderWidth: BORDER_WIDTH,
          borderColor: BAR_BORDER_COLOR,
        });
        Renderer.drawString(
          item.title,
          x + width / 2 - Renderer.getStringWidth(item.title) / 2,
          y + 10,
          CATEGORY_TITLE_COLOR,
          false
        );
        Renderer.drawString(
          item.description,
          x + width / 2 - Renderer.getStringWidth(item.description) / 2,
          y + 30,
          CATEGORY_DESC_COLOR,
          false
        );
        y += height + CATEGORY_BOX_PADDING;
      });
    }
  };

  const handleClick = (mouseX, mouseY) => {
    let clickedOnCategory = false;
    global.Categories.categories.forEach((cat, i) => {
      const x = deps.rectangles.LeftPanel.x + PADDING;
      const y =
        deps.rectangles.LeftPanel.y +
        PADDING +
        CATEGORY_OFFSET_Y +
        i * (CATEGORY_HEIGHT + CATEGORY_PADDING);
      const width = deps.rectangles.LeftPanel.width - PADDING * 2;
      const height = CATEGORY_HEIGHT;
      if (deps.utils.isInside(mouseX, mouseY, { x, y, width, height })) {
        global.Categories.selected = cat.name;
        clickedOnCategory = true;
      }
    });

    // Deselect if clicking in the left panel but not on a category button
    if (
      !clickedOnCategory &&
      deps.utils.isInside(mouseX, mouseY, deps.rectangles.LeftPanel)
    ) {
      global.Categories.selected = null;
    }
  };

  return { draw, handleClick };
};
