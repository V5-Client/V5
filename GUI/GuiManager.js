const Color = Java.type("java.awt.Color");

const CATEGORY_BOX_HEIGHT = 40;

import { ToggleButton } from "./Toggle";
import { Slider } from "./Slider";

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
      if (!global.Categories.categories.find((c) => c.name === name)) {
        global.Categories.categories.push({ name, items: [] });
      }
    },
    addCategoryItem(categoryName, subcategoryName, title, description) {
      const category = global.Categories.categories.find(
        (c) => c.name === categoryName
      );
      if (!category) return;

      const newItem = {
        title,
        description,
        expanded: false,
        animation: CATEGORY_BOX_HEIGHT,
        components: [],
        type: "item",
      };

      if (subcategoryName) {
        let subcategory = category.items.find(
          (item) => item.type === "separator" && item.title === subcategoryName
        );

        if (!subcategory) {
          subcategory = {
            title: subcategoryName,
            type: "separator",
            items: [],
          };
          category.items.push(subcategory);
        }
        subcategory.items.push(newItem);
      } else {
        category.items.push(newItem);
      }
    }, // The old addSeparator function is removed as it's now part of addCategoryItem // addSeparator(categoryName, title) { ... },

    addToggle(categoryName, itemName, toggleTitle) {
      const category = global.Categories.categories.find(
        (c) => c.name === categoryName
      );
      if (!category) return;

      let item = null;
      for (const group of category.items) {
        if (group.type === "separator") {
          item = group.items.find((i) => i.title === itemName);
          if (item) break;
        } else if (group.title === itemName) {
          item = group;
          break;
        }
      }
      if (!item) return;

      item.components.push(new ToggleButton(toggleTitle, 0, 0));
    },
    getToggleState(categoryName, itemName, toggleTitle) {
      const category = global.Categories.categories.find(
        (c) => c.name === categoryName
      );
      if (!category) return null;

      let item = null;
      for (const group of category.items) {
        if (group.type === "separator") {
          item = group.items.find((i) => i.title === itemName);
          if (item) break;
        } else if (group.title === itemName) {
          item = group;
          break;
        }
      }
      if (!item) return null;

      const toggle = item.components.find(
        (c) => c.title === toggleTitle && c instanceof ToggleButton
      );
      return toggle ? toggle.enabled : null;
    },
    addSlider(categoryName, itemName, sliderTitle) {
      const category = global.Categories.categories.find(
        (c) => c.name === categoryName
      );
      if (!category) return;

      let item = null;
      for (const group of category.items) {
        if (group.type === "separator") {
          item = group.items.find((i) => i.title === itemName);
          if (item) break;
        } else if (group.title === itemName) {
          item = group;
          break;
        }
      }
      if (!item) return;

      item.components.push(new Slider(sliderTitle, 0, 0));
    },
    getSliderValue(categoryName, itemName, sliderTitle) {
      const category = global.Categories.categories.find(
        (c) => c.name === categoryName
      );
      if (!category) return null;

      let item = null;
      for (const group of category.items) {
        if (group.type === "separator") {
          item = group.items.find((i) => i.title === itemName);
          if (item) break;
        } else if (group.title === itemName) {
          item = group;
          break;
        }
      }
      if (!item) return null;

      const slider = item.components.find(
        (c) => c.title === sliderTitle && c instanceof Slider
      );
      return slider ? slider.value : null;
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
  const CATEGORY_BOX_PADDING = 5; // Reduced vertical spacing between rows
  const ITEM_SPACING = 5; // Reduced horizontal spacing between items
  const SEPARATOR_HEIGHT = 20;

  const CATEGORY_INNER_LINE_COLOR = new Color(0.25, 0.25, 0.25, 1);
  const CATEGORY_TITLE_COLOR = 0xffffff;
  const CATEGORY_SELECTED_COLOR = 0xccb380e6; // A brighter purple
  const CATEGORY_DESC_COLOR = 0xaaaaaa;
  const CATEGORY_BOX_COLOR = new Color(0.18, 0.18, 0.18, 1);
  const CATEGORY_BOX_HOVER_COLOR = new Color(0.25, 0.25, 0.25, 1);
  const SEPARATOR_COLOR = new Color(0.25, 0.25, 0.25, 1);

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
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;

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

      let yOffset = panel.y + PADDING - rightPanelScrollY;
      let itemIndexInRow = 0;

      cat.items.forEach((group) => {
        if (group.type === "separator") {
          if (itemIndexInRow > 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
            itemIndexInRow = 0;
          }
          const separatorY = yOffset + SEPARATOR_HEIGHT / 2;
          const separatorX = panelX + PADDING;
          const separatorWidth = panelWidth;

          Renderer.drawRect(
            SEPARATOR_COLOR.getRGB(),
            separatorX,
            separatorY,
            separatorWidth,
            1
          );
          const separatorTextWidth = Renderer.getStringWidth(group.title);
          const separatorTextX =
            separatorX + separatorWidth / 2 - separatorTextWidth / 2;
          Renderer.drawString(
            group.title,
            separatorTextX,
            separatorY - 10,
            CATEGORY_DESC_COLOR,
            false
          );
          yOffset += SEPARATOR_HEIGHT;
          itemIndexInRow = 0;

          group.items.forEach((item) => {
            const col = itemIndexInRow % 3;
            if (col === 0 && itemIndexInRow > 0) {
              yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
            }

            const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
            const itemRect = {
              x: itemX,
              y: yOffset,
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
            Renderer.drawString(
              item.title,
              itemX + 5,
              yOffset + CATEGORY_BOX_HEIGHT / 2 - 4,
              CATEGORY_TITLE_COLOR,
              false
            );
            itemIndexInRow++;
          });
          if (group.items.length % 3 !== 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
          }
          itemIndexInRow = 0;
        } else {
          const item = group;
          const col = itemIndexInRow % 3;
          if (col === 0 && itemIndexInRow > 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
          }

          const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
          const itemRect = {
            x: itemX,
            y: yOffset,
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
          Renderer.drawString(
            item.title,
            itemX + 5,
            yOffset + CATEGORY_BOX_HEIGHT / 2 - 4,
            CATEGORY_TITLE_COLOR,
            false
          );
          itemIndexInRow++;
        }
      });
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

        const backButtonText = "Back";
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
          backButtonX,
          optionY + 30,
          CATEGORY_TITLE_COLOR,
          false
        );
        Renderer.drawString(
          selectedItem.description,
          backButtonX + 10,
          optionY + 45,
          CATEGORY_DESC_COLOR,
          false
        );

        let componentY = optionY + 70;
        selectedItem.components.forEach((component) => {
          if (typeof component.draw === "function") {
            component.x = optionX + 10;
            component.y = componentY;
            component.draw();
            componentY += 30; // Increased spacing for sliders
          }
        });
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
      const backButtonText = "Back";
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

      const components = global.Categories.selectedItem.components;
      let wasComponentClicked = false;
      if (components) {
        components.forEach((component) => {
          if (
            typeof component.handleClick === "function" &&
            component.handleClick(mouseX, mouseY)
          ) {
            wasComponentClicked = true;
          }
        });
      }

      if (wasComponentClicked) return;
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
      const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
      const itemHeight = CATEGORY_BOX_HEIGHT;

      let yOffset = panel.y + PADDING - rightPanelScrollY;
      let itemIndexInRow = 0;

      for (const group of cat.items) {
        if (group.type === "separator") {
          if (itemIndexInRow > 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
            itemIndexInRow = 0;
          }
          yOffset += SEPARATOR_HEIGHT;
          for (const item of group.items) {
            const col = itemIndexInRow % 3;
            if (col === 0 && itemIndexInRow > 0) {
              yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
            }
            const itemX = panel.x + PADDING + col * (itemWidth + ITEM_SPACING);
            const rect = {
              x: itemX,
              y: yOffset,
              width: itemWidth,
              height: itemHeight,
            };
            if (deps.utils.isInside(mouseX, mouseY, rect)) {
              global.Categories.transitionDirection = 1;
              global.Categories.transitionProgress = 0;
              global.Categories.transitionStart = Date.now();
              global.Categories.selectedItem = item;
              return;
            }
            itemIndexInRow++;
          }
          if (group.items.length % 3 !== 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
          }
          itemIndexInRow = 0;
        } else {
          const item = group;
          const col = itemIndexInRow % 3;
          if (col === 0 && itemIndexInRow > 0) {
            yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
          }
          const itemX = panel.x + PADDING + col * (itemWidth + ITEM_SPACING);
          const rect = {
            x: itemX,
            y: yOffset,
            width: itemWidth,
            height: itemHeight,
          };
          if (deps.utils.isInside(mouseX, mouseY, rect)) {
            global.Categories.transitionDirection = 1;
            global.Categories.transitionProgress = 0;
            global.Categories.transitionStart = Date.now();
            global.Categories.selectedItem = item;
            return;
          }
          itemIndexInRow++;
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
      global.Categories.currentPage === "options" &&
      global.Categories.selectedItem
    ) {
      const components = global.Categories.selectedItem.components;
      if (components) {
        components.forEach((component) => {
          if (typeof component.handleScroll === "function") {
            component.handleScroll(mouseX, mouseY, dir);
          }
        });
      }
      return;
    }
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

    let totalContentHeight = 0;

    for (const group of cat.items) {
      if (group.type === "separator") {
        totalContentHeight += SEPARATOR_HEIGHT;
        const itemsInRows = Math.ceil(group.items.length / 3);
        totalContentHeight +=
          itemsInRows * (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);
      } else {
        totalContentHeight += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
      }
    }

    const maxScroll = Math.max(0, totalContentHeight - panel.height + PADDING);
    const direction = dir > 0 ? -1 : 1;
    rightPanelScrollY += direction * SCROLL_SPEED;
    rightPanelScrollY = Math.max(0, Math.min(rightPanelScrollY, maxScroll));
  };

  const handleMouseDrag = (mouseX, mouseY) => {
    if (
      global.Categories.currentPage === "options" &&
      global.Categories.selectedItem
    ) {
      const components = global.Categories.selectedItem.components;
      if (components) {
        components.forEach((component) => {
          if (typeof component.handleMouseDrag === "function") {
            component.handleMouseDrag(mouseX, mouseY);
          }
        });
      }
    }
  };

  const handleMouseRelease = () => {
    if (
      global.Categories.currentPage === "options" &&
      global.Categories.selectedItem
    ) {
      const components = global.Categories.selectedItem.components;
      if (components) {
        components.forEach((component) => {
          if (typeof component.handleMouseRelease === "function") {
            component.handleMouseRelease();
          }
        });
      }
    }
  };

  return {
    draw,
    handleClick,
    handleScroll,
    handleMouseDrag,
    handleMouseRelease,
  };
};
