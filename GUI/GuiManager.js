const Color = Java.type("java.awt.Color");

const CATEGORY_BOX_HEIGHT = 70;

if (!global.Categories) {
  global.Categories = {
    categories: [],
    selected: null,
    selectedItem: null,
    currentPage: "categories", // "categories" or "options"
    transitionProgress: 0,
    transitionDirection: 0,
    transitionStart: 0,
    addCategory(name) {
      if (!this.categories.find((c) => c.name === name)) {
        this.categories.push({ name, items: [] });
      }
    },
    addCategoryItem(categoryName, title, description, image) {
      const category = this.categories.find((c) => c.name === categoryName);
      if (!category) return;
      category.items.push({
        title,
        description,
        expanded: false,
        image: Image.fromAsset(image),
        animation: CATEGORY_BOX_HEIGHT,
        components: [],
      });
    },

    addToggle(categoryName, itemName, toggleTitle) {
      const category = this.categories.find((c) => c.name === categoryName);
      if (!category) return;

      const item = category.items.find((i) => i.title === itemName);
      if (!item) return;

      item.components.push(new ToggleButton(toggleTitle, 0, 0));
    },
    getToggleState(categoryName, itemName, toggleTitle) {
      const category = this.categories.find((c) => c.name === categoryName);
      if (!category) return null;

      const item = category.items.find((i) => i.title === itemName);
      if (!item) return null;

      const toggle = item.components.find(
        (c) => c.title === toggleTitle && typeof c.handleClick === "function"
      );
      return toggle ? toggle.enabled : null;
    },
  };
}

global.createCategoriesManager = (deps) => {
  const CATEGORY_HEIGHT = 30;
  const CATEGORY_PADDING = 5;
  const LEFT_PANEL_TEXT_HEIGHT = 8;
  const CATEGORY_OFFSET_Y = 50;

  const PADDING = 10;
  const CORNER_RADIUS = 10;
  const BORDER_WIDTH = 2;
  const CATEGORY_BOX_PADDING = 10;
  const ITEM_SPACING = 10;

  const CATEGORY_INNER_LINE_COLOR = new Color(0.25, 0.25, 0.25, 1);
  const CATEGORY_TITLE_COLOR = 0xffffff;
  const CATEGORY_SELECTED_COLOR = 0xccb380e6; // A brighter purple
  const CATEGORY_DESC_COLOR = 0xaaaaaa;
  const CATEGORY_BOX_COLOR = new Color(0.18, 0.18, 0.18, 1);
  const CATEGORY_BOX_HOVER_COLOR = new Color(0.25, 0.25, 0.25, 1);

  const SCROLL_SPEED = 15;
  const ANIMATION_DURATION = 300; // Smoother animation
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
  const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const draw = (mouseX, mouseY) => {
    if (global.Categories.transitionDirection !== 0) {
      const elapsed = Date.now() - global.Categories.transitionStart;
      const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
      global.Categories.transitionProgress = easeInOutQuad(rawProgress);

      if (rawProgress >= 1) {
        global.Categories.currentPage =
          global.Categories.transitionDirection === 1
            ? "options"
            : "categories";
        global.Categories.transitionDirection = 0;
      }
    }

    global.Categories.categories.forEach((cat, i) => {
      const rect = getCategoryRect(i);
      const lineY = rect.y + rect.height - 2;
      deps.draw.drawRoundedRectangle({
        x: rect.x + 5,
        y: lineY,
        width: rect.width - 10,
        height: 1,
        radius: 0,
        color: CATEGORY_INNER_LINE_COLOR,
      });

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
    });

    if (!global.Categories.selected) return;

    const cat = global.Categories.categories.find(
      (c) => c.name === global.Categories.selected
    );
    if (!cat) return;

    const panel = deps.rectangles.RightPanel;
    const x = panel.x + PADDING;
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING) / 2;
    const itemHeight = CATEGORY_BOX_HEIGHT;

    const scale = Renderer.screen.getScale();
    GL11.glEnable(GL11.GL_SCISSOR_TEST);

    const inset = 2;
    const scissorX = panel.x + inset;
    const scissorY = panel.y + inset;
    const scissorW = panel.width - inset * 2;
    const scissorH = panel.height - inset * 2;

    GL11.glScissor(
      Math.floor(scissorX * scale),
      Math.floor((Renderer.screen.getHeight() - (scissorY + scissorH)) * scale),
      Math.floor(scissorW * scale),
      Math.floor(scissorH * scale)
    );

    const transitionActive = global.Categories.transitionDirection !== 0;
    const shouldDrawItems =
      global.Categories.currentPage === "categories" || transitionActive;
    const shouldDrawOptions =
      global.Categories.currentPage === "options" || transitionActive;
    if (shouldDrawItems) {
      let panelX = panel.x;
      if (global.Categories.transitionDirection === 1) {
        panelX -= panel.width * global.Categories.transitionProgress;
      } else if (global.Categories.transitionDirection === -1) {
        panelX -= panel.width * (1 - global.Categories.transitionProgress);
      }
      let y = panel.y + PADDING - rightPanelScrollY;
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i];
        const isLeft = i % 2 === 0;
        const itemX =
          panelX + PADDING + (isLeft ? 0 : itemWidth + ITEM_SPACING);

        const row = Math.floor(i / 2);
        const rowY =
          panel.y +
          PADDING -
          rightPanelScrollY +
          row * (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);

        const itemRect = {
          x: itemX,
          y: rowY,
          width: itemWidth,
          height: CATEGORY_BOX_HEIGHT,
          radius: CORNER_RADIUS,
          color: CATEGORY_BOX_COLOR,
          borderWidth: BORDER_WIDTH,
        };

        const isHovered = deps.utils.isInside(mouseX, mouseY, itemRect);
        itemRect.color = isHovered
          ? CATEGORY_BOX_HOVER_COLOR
          : CATEGORY_BOX_COLOR;

        deps.draw.drawRoundedRectangleWithGradientOutline(
          itemRect,
          deps.colors.gradientTop,
          deps.colors.gradientBottom
        );
        const ImageRect = {
          x: itemRect.x + CATEGORY_BOX_PADDING,
          y: itemRect.y + CATEGORY_BOX_PADDING - 4,
          width: 70,
          height: itemRect.height - CATEGORY_BOX_PADDING * 1.2,
          radius: CORNER_RADIUS / 2,
          color: new Color(0.15, 0.15, 0.15, 1),
        };
        deps.draw.drawRoundedRectangle(ImageRect);

        if (item.image) {
          item.image.draw(
            ImageRect.x + 4,
            ImageRect.y,
            ImageRect.width - 7,
            ImageRect.height
          );
        }
        Renderer.drawString(
          item.title,
          itemRect.x +
            itemRect.width / 2 -
            Renderer.getStringWidth(item.title) / 2 +
            15,
          itemRect.y + 10,
          CATEGORY_TITLE_COLOR,
          false
        );
      }
    }

    if (shouldDrawOptions) {
      const selectedItem = global.Categories.selectedItem;
      if (selectedItem) {
        let optionPanelX = panel.x;
        if (global.Categories.transitionDirection === 1) {
          optionPanelX +=
            panel.width * (1 - global.Categories.transitionProgress);
        } else if (global.Categories.transitionDirection === -1) {
          optionPanelX += panel.width * global.Categories.transitionProgress;
        }

        const optionX = optionPanelX + PADDING;
        const optionY = panel.y + PADDING;

        deps.draw.drawRoundedRectangle({
          x: optionX,
          y: optionY,
          width: panel.width - PADDING * 2,
          height: panel.height - PADDING * 2,
          radius: CORNER_RADIUS,
          color: CATEGORY_BOX_COLOR,
        });

        const backButtonText = "< Back";
        const backButtonWidth = Renderer.getStringWidth(backButtonText);
        const backButtonX = optionX + 10;
        const backButtonY = optionY + 10;

        Renderer.drawString(
          backButtonText,
          backButtonX,
          backButtonY,
          CATEGORY_SELECTED_COLOR
        );

        Renderer.drawString(
          selectedItem.title,
          backButtonX + backButtonWidth + 5,
          optionY + 10,
          CATEGORY_TITLE_COLOR,
          false
        );
        Renderer.drawString(
          selectedItem.description,
          backButtonX + backButtonWidth + 5,
          optionY + 30,
          CATEGORY_DESC_COLOR,
          false
        );
      }
    }

    GL11.glDisable(GL11.GL_SCISSOR_TEST);
  };

  const handleClick = (mouseX, mouseY) => {
    if (global.Categories.transitionDirection !== 0) return;

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
    }

    if (
      global.Categories.currentPage === "options" &&
      global.Categories.selectedItem
    ) {
      const panel = deps.rectangles.RightPanel;
      const backButtonText = "< Back";
      const backButtonWidth = Renderer.getStringWidth(backButtonText);
      const backButtonRect = {
        x: panel.x + PADDING + 10,
        y: panel.y + PADDING + 10,
        width: backButtonWidth,
        height: 10,
      };
      if (deps.utils.isInside(mouseX, mouseY, backButtonRect)) {
        global.Categories.transitionDirection = -1;
        global.Categories.transitionProgress = 0;
        global.Categories.transitionStart = Date.now();
        return;
      }
    }

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

        const row = Math.floor(i / 2);
        const rowY =
          panel.y +
          PADDING -
          rightPanelScrollY +
          row * (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);

        const rect = {
          x: itemX,
          y: rowY,
          width: itemWidth,
          height: itemHeight,
        };

        if (deps.utils.isInside(mouseX, mouseY, rect)) {
          // forward transition
          global.Categories.transitionDirection = 1;
          global.Categories.transitionProgress = 0;
          global.Categories.transitionStart = Date.now();
          global.Categories.selectedItem = item;
          return;
        }
      }
    } else if (
      global.Categories.currentPage === "options" &&
      !deps.utils.isInside(mouseX, mouseY, deps.rectangles.RightPanel)
    ) {
      // backward transition
      global.Categories.transitionDirection = -1;
      global.Categories.transitionProgress = 0;
      global.Categories.transitionStart = Date.now();
    }
  };

  const handleScroll = (mouseX, mouseY, dir) => {
    if (
      global.Categories.currentPage !== "categories" ||
      global.Categories.transitionDirection !== 0
    )
      return;

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
