const Color = Java.type("java.awt.Color");

const CATEGORY_BOX_HEIGHT = 70;

if (!global.Categories) {
  global.Categories = {
    categories: [],
    selected: null,
    selectedItem: null,
    currentPage: "categories", // "categories" or "options"
    addCategory(name) {
      if (!this.categories.find((c) => c.name === name)) {
        this.categories.push({ name, items: [] });
      }
    },
    addCategoryItem(categoryName, title, description) {
      const category = this.categories.find((c) => c.name === categoryName);
      if (!category) return;
      category.items.push({
        title,
        description,
        expanded: false,
        animation: CATEGORY_BOX_HEIGHT, // start collapsed
      });
    },
    removeCategory(name) {
      this.categories = this.categories.filter((c) => c.name !== name);
      if (this.selected === name) this.selected = null;
    },
  };
}

/**
 * Creates and returns an object responsible for managing category UI.
 * This function encapsulates all category logic and decouples it from the main GUI foundation.
 * @param {object} deps - Dependencies from the main GUI file.
 * @returns {object} An object with `draw`, `handleClick`, and `handleScroll` methods.
 */
global.createCategoriesManager = (deps) => {
  // Constants for Left Panel (Categories)
  const CATEGORY_HEIGHT = 30;
  const CATEGORY_PADDING = 5;
  const LEFT_PANEL_TEXT_HEIGHT = 8;
  const CATEGORY_OFFSET_Y = 50; 
  // Constants for Right Panel (Items/Options)
  const PADDING = 10;
  const CORNER_RADIUS = 10;
  const BORDER_WIDTH = 2;
  const CATEGORY_BOX_PADDING = 10;
  const ITEM_SPACING = 10; 

  const CATEGORY_INNER_LINE_COLOR = new Color(0.4, 0.4, 0.4, 1);
  const CATEGORY_TITLE_COLOR = 0xffffff;
  const CATEGORY_SELECTED_COLOR = 0xbf994ccc;
  const CATEGORY_DESC_COLOR = 0xaaaaaa;
  const CATEGORY_BOX_COLOR = new Color(0.18, 0.18, 0.18, 1);
  const CATEGORY_BOX_BORDER_COLOR = new Color(0.2, 0.2, 0.2, 1);
  const DROPSHADOW_COLOR = new Color(0.6, 0.3, 0.8, 0.3); 

  const SCROLL_SPEED = 15;
  let rightPanelScrollY = 0;
  /**
   * Helper function to calculate the bounding box for a category.
   * @param {number} index - The index of the category.
   * @returns {object} The bounding box with x, y, width, and height.
   */

  const getCategoryRect = (index) => {
    return {
      x: deps.rectangles.LeftPanel.x + PADDING,
      y:
        deps.rectangles.LeftPanel.y +
        PADDING +
        CATEGORY_OFFSET_Y +
        index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
      width: deps.rectangles.LeftPanel.width - PADDING * 2,
      height: CATEGORY_HEIGHT,
    };
  };
  /**
   * Draws a drop shadow for a given rectangle.
   * @param {object} rect - The rectangle object to draw a shadow for.
   */

  const drawDropShadow = (rect) => {
    deps.draw.drawRoundedRectangle({
      x: rect.x - 2,
      y: rect.y - 2,
      width: rect.width + 4,
      height: rect.height + 4,
      radius: rect.radius + 2,
      color: DROPSHADOW_COLOR,
    });
  };

  const draw = (mouseX, mouseY) => {
    // Draw Left Panel: Categories
    global.Categories.categories.forEach((cat, i) => {
      const rect = getCategoryRect(i);
      const lineY = rect.y + rect.height - 2; // Draw the bottom line of the category box

      deps.draw.drawRoundedRectangle({
        x: rect.x + 5,
        y: lineY,
        width: rect.width - 10,
        height: 1,
        radius: 0,
        color: CATEGORY_INNER_LINE_COLOR,
      }); // Draw the category name

      const textColor =
        global.Categories.selected === cat.name
          ? CATEGORY_SELECTED_COLOR
          : CATEGORY_TITLE_COLOR;
      const textY = lineY - (rect.height - 2 - LEFT_PANEL_TEXT_HEIGHT) / 2 - 1;
      Renderer.drawString(
        cat.name,
        rect.x + rect.width / 2 - Renderer.getStringWidth(cat.name) / 2,
        textY,
        textColor,
        false
      );
    }); // Draw Right Panel: Items/Options

    if (!global.Categories.selected) return;

    const cat = global.Categories.categories.find(
      (c) => c.name === global.Categories.selected
    );
    if (!cat) return;

    const panel = deps.rectangles.RightPanel;
    const x = panel.x + PADDING;
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING) / 2;
    const itemHeight = CATEGORY_BOX_HEIGHT; // Handle drawing based on the current page

    if (global.Categories.currentPage === "categories") {
      // Scissor test to clip content outside the right panel's bounds
      const scale = Renderer.screen.getScale();
      GL11.glEnable(GL11.GL_SCISSOR_TEST);
      GL11.glScissor(
        Math.floor(panel.x * scale),
        Math.floor(
          (Renderer.screen.getHeight() - (panel.y + panel.height)) * scale
        ),
        Math.floor(panel.width * scale),
        Math.floor(panel.height * scale)
      );

      let totalContentHeight = 0;
      for (let i = 0; i < cat.items.length; i += 2) {
        totalContentHeight += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
      }

      let y = panel.y + PADDING - rightPanelScrollY;
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i];
        const isLeft = i % 2 === 0;
        const itemX =
          panel.x + PADDING + (isLeft ? 0 : itemWidth + ITEM_SPACING); // Find the y position of the current row based on previous items

        let rowY = panel.y + PADDING - rightPanelScrollY;
        for (let j = 0; j < Math.floor(i / 2) * 2; j += 2) {
          rowY += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
        }

        const itemRect = {
          x: itemX,
          y: rowY,
          width: itemWidth,
          height: CATEGORY_BOX_HEIGHT,
          radius: CORNER_RADIUS,
          color: CATEGORY_BOX_COLOR,
          borderWidth: BORDER_WIDTH,
          borderColor: CATEGORY_BOX_BORDER_COLOR,
        };

        if (deps.utils.isInside(mouseX, mouseY, itemRect)) {
          drawDropShadow(itemRect);
        }
        deps.draw.drawRoundedRectangleWithBorder(itemRect); // Title and description drawing

        Renderer.drawString(
          item.title,
          itemRect.x +
            itemRect.width / 2 -
            Renderer.getStringWidth(item.title) / 2,
          itemRect.y + 10,
          CATEGORY_TITLE_COLOR,
          false
        );
        Renderer.drawString(
          item.description,
          itemRect.x +
            itemRect.width / 2 -
            Renderer.getStringWidth(item.description) / 2,
          itemRect.y + 30,
          CATEGORY_DESC_COLOR,
          false
        );
      }

      GL11.glDisable(GL11.GL_SCISSOR_TEST);
    } else if (
      global.Categories.currentPage === "options" &&
      global.Categories.selectedItem
    ) {
      // Draw the options for the selected item
      const selectedItem = global.Categories.selectedItem;
      const optionX = panel.x + PADDING;
      const optionY = panel.y + PADDING;

      deps.draw.drawRoundedRectangle({
        x: optionX,
        y: optionY,
        width: panel.width - PADDING * 2,
        height: panel.height - PADDING * 2,
        radius: CORNER_RADIUS,
        color: CATEGORY_BOX_COLOR,
      });
      Renderer.drawString(
        selectedItem.title,
        optionX + 10,
        optionY + 10,
        CATEGORY_SELECTED_COLOR,
        false
      );
      Renderer.drawString(
        selectedItem.description,
        optionX + 10,
        optionY + 30,
        CATEGORY_DESC_COLOR,
        false
      );
    }
  };

  const handleClick = (mouseX, mouseY) => {
    // Left Panel: Select Category
    const wasCategoryClicked = global.Categories.categories.some((cat, i) => {
      const rect = getCategoryRect(i);
      if (deps.utils.isInside(mouseX, mouseY, rect)) {
        global.Categories.selected = cat.name;
        global.Categories.currentPage = "categories";
        global.Categories.selectedItem = null;
        rightPanelScrollY = 0;
        return true;
      }
      return false;
    });

    if (
      !wasCategoryClicked &&
      deps.utils.isInside(mouseX, mouseY, deps.rectangles.LeftPanel)
    ) {
      global.Categories.selected = null;
    } // Right Panel: Open Options

    if (
      global.Categories.selected &&
      global.Categories.currentPage === "categories"
    ) {
      const cat = global.Categories.categories.find(
        (c) => c.name === global.Categories.selected
      );
      if (!cat) return;

      const panel = deps.rectangles.RightPanel;
      const panelWidth = panel.width - PADDING * 2;
      const itemWidth = (panelWidth - ITEM_SPACING) / 2;
      const itemHeight = CATEGORY_BOX_HEIGHT;

      let y = panel.y + PADDING - rightPanelScrollY;
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i];
        const isLeft = i % 2 === 0;
        const itemX =
          panel.x + PADDING + (isLeft ? 0 : itemWidth + ITEM_SPACING);

        let rowY = panel.y + PADDING - rightPanelScrollY;
        for (let j = 0; j < Math.floor(i / 2) * 2; j += 2) {
          rowY += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
        }

        const rect = {
          x: itemX,
          y: rowY,
          width: itemWidth,
          height: itemHeight,
        };

        if (deps.utils.isInside(mouseX, mouseY, rect)) {
          global.Categories.currentPage = "options";
          global.Categories.selectedItem = item;
          return;
        }
      }
    } else if (
      global.Categories.currentPage === "options" &&
      !deps.utils.isInside(mouseX, mouseY, deps.rectangles.RightPanel)
    ) {
      // Return to categories page if clicking outside the options panel
      global.Categories.currentPage = "categories";
      global.Categories.selectedItem = null;
    }
  };

  const handleScroll = (mouseX, mouseY, dir) => {
    if (global.Categories.currentPage !== "categories") return;

    const panel = deps.rectangles.RightPanel;
    if (
      !global.Categories.selected ||
      !deps.utils.isInside(mouseX, mouseY, panel)
    ) {
      return;
    }

    const cat = global.Categories.categories.find(
      (c) => c.name === global.Categories.selected
    );
    const totalContentHeight =
      Math.ceil(cat.items.length / 2) *
      (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);

    const maxScroll = Math.max(0, totalContentHeight - panel.height + PADDING);
    const direction = dir > 0 ? -1 : 1;
    rightPanelScrollY += direction * SCROLL_SPEED;
    rightPanelScrollY = Math.max(0, Math.min(rightPanelScrollY, maxScroll));
  };

  return { draw, handleClick, handleScroll };
};
