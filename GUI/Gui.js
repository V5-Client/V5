import "./Categories";

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

// Rectangles - The foundational layout of the GUI
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

// --- Utility and Drawing Primitives ---
const isInside = (mouseX, mouseY, rect) =>
  mouseX >= rect.x &&
  mouseX <= rect.x + rect.width &&
  mouseY >= rect.y &&
  mouseY <= rect.y + rect.height;
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

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

// --- Initialize Category Manager ---
// Pass all necessary dependencies from this file into the category manager
const categoryManager = global.createCategoriesManager({
  rectangles: rectangles,
  draw: {
    drawRoundedRectangle: drawRoundedRectangle,
    drawRoundedRectangleWithBorder: drawRoundedRectangleWithBorder,
  },
  utils: {
    isInside: isInside,
  },
});

// --- Main Draw Loop ---
const drawGUI = () => {
  // 1. Draw the foundational rectangles
  drawRoundedRectangleWithBorder(rectangles.Background);
  drawRoundedRectangleWithBorder(rectangles.LeftPanel);
  drawRoundedRectangleWithBorder(rectangles.RightPanel);

  // 2. Delegate content drawing to the category manager
  categoryManager.draw();
};

myGui.registerDraw(drawGUI);

// --- Event Handlers ---
let dragging = false;

const handleClick = (mouseX, mouseY) => {
  // Check for dragging the background
  if (
    isInside(mouseX, mouseY, rectangles.Background) &&
    !isInside(mouseX, mouseY, rectangles.LeftPanel) &&
    !isInside(mouseX, mouseY, rectangles.RightPanel)
  ) {
    dragging = true;
    rectangles.Background.dx = mouseX - rectangles.Background.x;
    rectangles.Background.dy = mouseY - rectangles.Background.y;
  }
  // Delegate category-specific clicks to the manager
  categoryManager.handleClick(mouseX, mouseY);
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

// Register all GUI events
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

// Command to open the GUI
register("command", () => myGui.open()).setName("gui");
