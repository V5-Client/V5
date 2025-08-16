const Color = Java.type("java.awt.Color");
const UIRoundedRectangle = Java.type(
  "gg.essential.elementa.components.UIRoundedRectangle"
);
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat
  .INSTANCE;
const matrix = UMatrixStack.get();

// GUI settings
const PADDING = 10;
const BORDER_WIDTH = 2;
const CORNER_RADIUS = 10;

const BACKGROUND_COLOR = new Color(0.089, 0.089, 0.089, 1);
const BACKGROUND_BORDER_COLOR = new Color(0.12, 0.12, 0.12, 1);
const BAR_COLOR = new Color(0.15, 0.15, 0.15, 1);
const BAR_BORDER_COLOR = new Color(0.18, 0.18, 0.18, 1);

// Rectangles
let rectangles = {
  Background: {
    name: "Background",
    x: Renderer.screen.getWidth() / 2 - 300,
    y: Renderer.screen.getHeight() / 2 - 200,
    width: 600,
    height: 400,
    radius: CORNER_RADIUS,
    color: BACKGROUND_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BACKGROUND_BORDER_COLOR,
  },
  LeftPanel: {
    name: "Left",
    get x() {
      return rectangles.Background.x + PADDING;
    },
    get y() {
      return rectangles.Background.y + PADDING;
    },
    width: 100,
    height: 380,
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
  },
  RightPanel: {
    name: "Right",
    get x() {
      return rectangles.LeftPanel.x + rectangles.LeftPanel.width + PADDING;
    },
    get y() {
      return rectangles.Background.y + PADDING;
    },
    width: 470,
    height: 380,
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
  },
};

// Create GUI
const myGui = new Gui();

// Initialize categories
if (!global.Categories) {
  global.Categories = {
    categories: [],
    selected: null,

    // Add a category
    addCategory(name) {
      if (!this.categories.includes(name)) this.categories.push(name);
    },

    // Remove a category
    removeCategory(name) {
      this.categories = this.categories.filter((c) => c !== name);
      if (this.selected === name) this.selected = null;
    },
  };
}

// Category styling
const CATEGORY_HEIGHT = 30;
const CATEGORY_PADDING = 5;
const CATEGORY_COLOR = new Color(0.2, 0.2, 0.2, 1);
const CATEGORY_SELECTED_COLOR = new Color(0.6, 0, 0.8, 1);
const CATEGORY_INNER_LINE_COLOR = new Color(0.4, 0.4, 0.4, 1);
const CATEGORY_OFFSET_Y = 50;

// Utils
const isInside = (mouseX, mouseY, rect) =>
  mouseX >= rect.x &&
  mouseX <= rect.x + rect.width &&
  mouseY >= rect.y &&
  mouseY <= rect.y + rect.height;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// Draw functions
const drawRoundedRectangle = ({ x, y, width, height, radius, color }) => {
  UIRoundedRectangle.Companion.drawRoundedRectangle(
    matrix,
    x,
    y,
    x + width,
    y + height,
    radius,
    color
  );
};

const drawRoundedRectangleWithBorder = (r) => {
  if (r.borderWidth && r.borderWidth > 0) {
    drawRoundedRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      radius: r.radius,
      color: r.borderColor || r.color,
    });
    const bw = r.borderWidth;
    drawRoundedRectangle({
      x: r.x + bw,
      y: r.y + bw,
      width: Math.max(0, r.width - bw * 2),
      height: Math.max(0, r.height - bw * 2),
      radius: Math.max(0, r.radius - bw),
      color: r.color,
    });
  } else {
    drawRoundedRectangle(r);
  }
};

// Draw categories
const drawCategories = () => {
  global.Categories.categories.forEach((catName, i) => {
    const x = rectangles.LeftPanel.x + PADDING;
    const y =
      rectangles.LeftPanel.y +
      PADDING +
      CATEGORY_OFFSET_Y +
      i * (CATEGORY_HEIGHT + CATEGORY_PADDING);
    const width = rectangles.LeftPanel.width - PADDING * 2;
    const height = CATEGORY_HEIGHT;

    // Draw inner line
    const lineY = y + height - 2; // bottom of the category
    drawRoundedRectangle({
      x: x + 5,
      y: lineY,
      width: width - 10,
      height: 1,
      radius: 0,
      color: CATEGORY_INNER_LINE_COLOR,
    });

    // Text color based on selection
    const textColor =
      global.Categories.selected === catName ? 0x800080 : 0xffffff;

    // Center text vertically above the line
    const textHeight = 8; // approximate font height
    const textY = lineY - (height - 2 - textHeight) / 2 - 1; // centers text above line

    Renderer.drawString(
      catName,
      x + width / 2 - Renderer.getStringWidth(catName) / 2,
      textY,
      textColor,
      false
    );
  });
};

// Handle category clicks
const handleCategoryClick = (mouseX, mouseY) => {
  global.Categories.categories.forEach((catName, i) => {
    const x = rectangles.LeftPanel.x + PADDING;
    const y =
      rectangles.LeftPanel.y +
      PADDING +
      CATEGORY_OFFSET_Y +
      i * (CATEGORY_HEIGHT + CATEGORY_PADDING);
    const width = rectangles.LeftPanel.width - PADDING * 2;
    const height = CATEGORY_HEIGHT;

    if (isInside(mouseX, mouseY, { x, y, width, height })) {
      global.Categories.selected = catName;
    }
  });
};

// Draw everything
const drawRectangles = () => {
  drawRoundedRectangleWithBorder(rectangles.Background);
  drawRoundedRectangleWithBorder(rectangles.LeftPanel);
  drawRoundedRectangleWithBorder(rectangles.RightPanel);
  drawCategories();
};

myGui.registerDraw(drawRectangles);

// Dragging logic
let dragging = false;

const handleClick = (mouseX, mouseY) => {
  if (
    isInside(mouseX, mouseY, rectangles.Background) &&
    !isInside(mouseX, mouseY, rectangles.LeftPanel) &&
    !isInside(mouseX, mouseY, rectangles.RightPanel)
  ) {
    dragging = true;
    rectangles.Background.dx = mouseX - rectangles.Background.x;
    rectangles.Background.dy = mouseY - rectangles.Background.y;
  }

  handleCategoryClick(mouseX, mouseY); // handle category selection
};

const handleMouseDrag = (mouseX, mouseY) => {
  if (dragging) {
    rectangles.Background.x = mouseX - rectangles.Background.dx;
    rectangles.Background.y = mouseY - rectangles.Background.dy;
  }
};

const handleScroll = (mouseX, mouseY, dir) => {
  const direction = dir > 0 ? -1 : 1;
  ["RightPanel", "LeftPanel", "Background"].forEach((key) => {
    const r = rectangles[key];
    if (isInside(mouseX, mouseY, r))
      r.radius = clamp(r.radius + direction, 0, 50);
  });
};

// Mouse events
myGui.registerClicked((mouseX, mouseY, button) => {
  if (button === 0) handleClick(mouseX, mouseY);
});
myGui.registerMouseDragged((mouseX, mouseY, button, _dt) => {
  if (button === 0) handleMouseDrag(mouseX, mouseY);
});
myGui.registerMouseReleased(() => {
  dragging = false;
});
myGui.registerScrolled(handleScroll);

// Command
register("command", () => myGui.open()).setName("gui");
