const Color = Java.type("java.awt.Color");
const UIRoundedRectangle = Java.type("gg.essential.elementa.components.UIRoundedRectangle");
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat.INSTANCE;
const matrix = UMatrixStack.get();

const PADDING = 10;
const BORDER_WIDTH = 2;
const CORNER_RADIUS = 10;

const BACKGROUND_COLOR = new Color(0.089, 0.089, 0.089, 1);
const BACKGROUND_BORDER_COLOR = new Color(0.12, 0.12, 0.12, 1);
const BAR_COLOR = new Color(0.15, 0.15, 0.15, 1);
const BAR_BORDER_COLOR = new Color(0.18, 0.18, 0.18, 1);

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
    get x() { return rectangles.Background.x + PADDING; },
    get y() { return rectangles.Background.y + PADDING; },
    width: 100,
    height: 380,
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
  },

  RightPanel: {
    name: "Right",
    get x() { return rectangles.LeftPanel.x + rectangles.LeftPanel.width + PADDING; },
    get y() { return rectangles.Background.y + PADDING; },
    width: 470,
    height: 380,
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
  },
};

const myGui = new Gui();

myGui.registerDraw(() => {
  drawRectangles();
});

const isInside = (mouseX, mouseY, rectangle) => mouseX >= rectangle.x && mouseX <= rectangle.x + rectangle.width && mouseY >= rectangle.y && mouseY <= rectangle.y + rectangle.height;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

const drawRoundedRectangle = ({ x, y, width, height, radius, color }) => {
  UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, x, y, x + width, y + height, radius, color);
};

const drawRoundedRectangleWithBorder = (r) => {
  if (r.borderWidth && r.borderWidth > 0) {
    // Outer (border)
    drawRoundedRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      radius: r.radius,
      color: r.borderColor || r.color,
    });
    // Inner (fill)
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

const drawRectangles = () => {
  drawRoundedRectangleWithBorder(rectangles.Background);
  drawRoundedRectangleWithBorder(rectangles.LeftPanel);
  drawRoundedRectangleWithBorder(rectangles.RightPanel);
};

// Window dragging
let dragging = false;


const handleClick = (mouseX, mouseY) => {
  if (
    isInside(mouseX, mouseY, rectangles.Background) // inside background
    && !isInside(mouseX, mouseY, rectangles.LeftPanel) // not inside LeftPanel
    && !isInside(mouseX, mouseY, rectangles.RightPanel) // not inside bar2
  ) {
    dragging = true;
    rectangles.Background.dx = mouseX - rectangles.Background.x;
    rectangles.Background.dy = mouseY - rectangles.Background.y;
  }
};

myGui.registerClicked((mouseX, mouseY, button) => {
  if (button !== 0) return; // Only process left-click
  handleClick(mouseX, mouseY);
});

const handleMouseDrag = (mouseX, mouseY) => {
  if (dragging) {
    rectangles.Background.x = mouseX - rectangles.Background.dx;
    rectangles.Background.y = mouseY - rectangles.Background.dy;
  }
};

myGui.registerMouseDragged((mouseX, mouseY, clickedMouseButton, _dt) => {
  if (clickedMouseButton !== 0 || !dragging) return; // left-click only and if a rect is being dragged
  handleMouseDrag(mouseX, mouseY);
});

myGui.registerMouseReleased((_mouseX, _mouseY, _button) => {
  dragging = false;
});

// use this for easy debugging and shit
const handleScroll = (mouseX, mouseY, dir) => {
  const direction = dir > 0 ? -1 : 1
  const order = ["RightPanel", "LeftPanel", "Background"];

  for (const key of order) {
    const r = rectangles[key];
    if (isInside(mouseX, mouseY, r)) {
      r.radius = clamp(r.radius + direction, 0, 50);
      return;
    }
  }
};

myGui.registerScrolled((mouseX, mouseY, dir) => {
  handleScroll(mouseX, mouseY, dir);
});


register("command", () => {
  myGui.open();
}).setName("gui");
