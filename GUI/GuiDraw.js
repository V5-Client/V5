import "./GuiManager";
import "./Registries";

const Color = Java.type("java.awt.Color");
const UIRoundedRectangle = Java.type(
  "gg.essential.elementa.components.UIRoundedRectangle"
);
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat
  .INSTANCE;
const matrix = UMatrixStack.get();

const PADDING = 10;
const BORDER_WIDTH = 2;
const CORNER_RADIUS = 10;
const BACKGROUND_COLOR = new Color(0.089, 0.089, 0.089, 0.5);
const BACKGROUND_BORDER_COLOR = new Color(0.12, 0.12, 0.12, 0.8);
const BAR_COLOR = new Color(0.15, 0.15, 0.15, 1);
const BAR_BORDER_COLOR = new Color(0.18, 0.18, 0.18, 1);

const GRADIENT_TOP_COLOR = new Color(0.6, 0.4, 0.8, 1);
const GRADIENT_BOTTOM_COLOR = new Color(0.4, 0.6, 0.8, 1);

const ANIMATION_DURATION = 200; // Time in milliseconds for the unroll animation

let isOpening = false;
let openStartTime = 0;

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
    isAnimated: true, // New property to indicate this rect animates
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
    isAnimated: true, // New property
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
    isAnimated: true, // New property
  },
};

const myGui = new Gui();

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

const interpolateColor = (color1, color2, factor) => {
  factor = Math.max(0, Math.min(1, factor));
  const r = color1.getRed() + (color2.getRed() - color1.getRed()) * factor;
  const g =
    color1.getGreen() + (color2.getGreen() - color1.getGreen()) * factor;
  const b = color1.getBlue() + (color2.getBlue() - color1.getBlue()) * factor;
  const a =
    color1.getAlpha() + (color2.getAlpha() - color1.getAlpha()) * factor;
  return new Color(r / 255, g / 255, b / 255, a / 255);
};

const drawGradientRoundedOutline = (
  x,
  y,
  width,
  height,
  radius,
  lineWidth,
  topColor,
  bottomColor
) => {
  if (height <= 0) return; // Prevent drawing if height is 0 or less
  radius = Math.min(radius, Math.min(width, height) / 2);
  const hw = lineWidth / 2;
  const ir = radius - hw;

  const getColorAtY = (currentY) => {
    const factor = (currentY - y) / height;
    return interpolateColor(topColor, bottomColor, factor);
  };

  // Draw vertical lines
  for (let i = 0; i < height - 2 * radius; i++) {
    const currentY = y + radius + i;
    const color = getColorAtY(currentY);
    Renderer.drawRect(color.getRGB(), x, currentY, lineWidth, 1);
    Renderer.drawRect(
      color.getRGB(),
      x + width - lineWidth,
      currentY,
      lineWidth,
      1
    );
  }

  // Draw horizontal lines
  Renderer.drawRect(
    topColor.getRGB(),
    x + radius,
    y,
    width - 2 * radius,
    lineWidth
  );
  Renderer.drawRect(
    bottomColor.getRGB(),
    x + radius,
    y + height - lineWidth,
    width - 2 * radius,
    lineWidth
  );

  // Draw corners LAST
  const steps = 90;
  const centers = {
    tl: { x: x + radius, y: y + radius },
    tr: { x: x + width - radius, y: y + radius },
    bl: { x: x + radius, y: y + height - radius },
    br: { x: x + width - radius, y: y + height - radius },
  };

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * (Math.PI / 2);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const drawCornerPixel = (centerX, centerY, dx, dy) => {
      const px = centerX + dx * ir;
      const py = centerY + dy * ir;
      Renderer.drawRect(
        getColorAtY(py - hw).getRGB(),
        px - hw,
        py - hw,
        lineWidth,
        lineWidth
      );
    };

    drawCornerPixel(centers.tl.x, centers.tl.y, -cos, -sin); // Top left
    drawCornerPixel(centers.tr.x, centers.tr.y, cos, -sin); // Top right
    drawCornerPixel(centers.bl.x, centers.bl.y, -cos, sin); // Bottom left
    drawCornerPixel(centers.br.x, centers.br.y, cos, sin); // Bottom right
  }
};

const drawRoundedRectangleWithGradientOutline = (r, topColor, bottomColor) => {
  if (r.borderWidth && r.borderWidth > 0) {
    drawGradientRoundedOutline(
      r.x,
      r.y,
      r.width,
      r.height,
      r.radius,
      r.borderWidth,
      topColor,
      bottomColor
    );
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

const categoryManager = global.createCategoriesManager({
  rectangles: rectangles,
  draw: {
    drawRoundedRectangle: drawRoundedRectangle,
    drawRoundedRectangleWithBorder: drawRoundedRectangleWithBorder,
    drawRoundedRectangleWithGradientOutline:
      drawRoundedRectangleWithGradientOutline,
  },
  utils: {
    isInside: isInside,
  },
  colors: {
    gradientTop: GRADIENT_TOP_COLOR,
    gradientBottom: GRADIENT_BOTTOM_COLOR,
  },
});

const drawGUI = (mouseX, mouseY) => {
  const elapsed = Date.now() - openStartTime;
  const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

  const backgroundHeight = rectangles.Background.height;
  const leftPanelHeight = rectangles.LeftPanel.height;
  const rightPanelHeight = rectangles.RightPanel.height;

  const currentBackgroundHeight = backgroundHeight * progress;
  const currentLeftPanelHeight = leftPanelHeight * progress;
  const currentRightPanelHeight = rightPanelHeight * progress;

  const animatedBackground = {
    ...rectangles.Background,
    height: currentBackgroundHeight,
  };
  const animatedLeftPanel = {
    ...rectangles.LeftPanel,
    height: currentLeftPanelHeight,
  };
  const animatedRightPanel = {
    ...rectangles.RightPanel,
    height: currentRightPanelHeight,
  };

  Client.getMinecraft().gameRenderer.renderBlur();

  drawRoundedRectangleWithBorder(animatedBackground);
  drawRoundedRectangleWithGradientOutline(
    animatedLeftPanel,
    GRADIENT_TOP_COLOR,
    GRADIENT_BOTTOM_COLOR
  );
  drawRoundedRectangleWithBorder(animatedRightPanel);

  if (progress >= 0.5) {
    categoryManager.draw(mouseX, mouseY);
  }
};

myGui.registerDraw(drawGUI);

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

  categoryManager.handleClick(mouseX, mouseY);
};

const handleMouseDrag = (mouseX, mouseY) => {
  if (dragging) {
    let newX = mouseX - rectangles.Background.dx;
    let newY = mouseY - rectangles.Background.dy;

    const screenWidth = Renderer.screen.getWidth();
    const screenHeight = Renderer.screen.getHeight();

    rectangles.Background.x = clamp(
      newX,
      0,
      screenWidth - rectangles.Background.width
    );
    rectangles.Background.y = clamp(
      newY,
      0,
      screenHeight - rectangles.Background.height
    );
  }
  categoryManager.handleMouseDrag(mouseX, mouseY);
};

const handleScroll = (mouseX, mouseY, dir) => {
  categoryManager.handleScroll(mouseX, mouseY, dir);
};

myGui.registerClicked((mouseX, mouseY, button) => {
  if (button === 0) handleClick(mouseX, mouseY);
});

myGui.registerMouseDragged((mouseX, mouseY, button, _dt) => {
  if (button === 0) handleMouseDrag(mouseX, mouseY);
});

myGui.registerMouseReleased(() => {
  dragging = false;
  categoryManager.handleMouseRelease();
});

myGui.registerScrolled(handleScroll);

register("command", () => {
  isOpening = true;
  openStartTime = Date.now();
  myGui.open();
}).setName("gui");
