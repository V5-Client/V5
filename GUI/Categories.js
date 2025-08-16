const Color = Java.type("java.awt.Color");

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

for (let i = 1; i <= 5; i++) {
  global.Categories.addCategoryItem(
    "Combat",
    `Setting Option #${i}`,
    `Description for option ${i}.`
  );
}

/**
 * Creates and returns an object responsible for managing category UI.
 * This function encapsulates all category logic and decouples it from the main GUI foundation.
 * @param {object} deps - Dependencies from the main GUI file.
 * @returns {object} An object with `draw`, `handleClick`, and `handleScroll` methods.
 */
global.createCategoriesManager = (deps) => {
  const CATEGORY_HEIGHT = 30;
  const CATEGORY_PADDING = 5;
  const PADDING = 10;
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

  const SCROLL_SPEED = 15;
  let rightPanelScrollY = 0;
  let totalContentHeight = 0;

  const draw = () => {
    global.Categories.categories.forEach((cat, i) => {
      const x = deps.rectangles.LeftPanel.x + PADDING;
      const y =
        deps.rectangles.LeftPanel.y +
        PADDING +
        CATEGORY_OFFSET_Y +
        i * (CATEGORY_HEIGHT + CATEGORY_PADDING);
      const width = deps.rectangles.LeftPanel.width - PADDING * 2;
      const height = CATEGORY_HEIGHT;
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

    if (global.Categories.selected) {
      const cat = global.Categories.categories.find(
        (c) => c.name === global.Categories.selected
      );
      if (!cat) return;

      totalContentHeight =
        cat.items.length * (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);

      const panel = deps.rectangles.RightPanel;
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

      const x = panel.x + PADDING;
      let y = panel.y + PADDING - rightPanelScrollY;
      const width = panel.width - PADDING * 2;

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

      GL11.glDisable(GL11.GL_SCISSOR_TEST);
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
        rightPanelScrollY = 0;
        clickedOnCategory = true;
      }
    });

    if (
      !clickedOnCategory &&
      deps.utils.isInside(mouseX, mouseY, deps.rectangles.LeftPanel)
    ) {
      global.Categories.selected = null;
    }
  };

  const handleScroll = (mouseX, mouseY, dir) => {
    const panel = deps.rectangles.RightPanel;
    if (
      !global.Categories.selected ||
      !deps.utils.isInside(mouseX, mouseY, panel)
    ) {
      return;
    }

    const maxScroll = Math.max(0, totalContentHeight - panel.height + PADDING);

    const direction = dir > 0 ? -1 : 1;
    rightPanelScrollY += direction * SCROLL_SPEED;

    rightPanelScrollY = Math.max(0, Math.min(rightPanelScrollY, maxScroll));
  };

  return { draw, handleClick, handleScroll }; // Return the new function
};
