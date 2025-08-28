import { Chat } from "../Utility/Chat";
import "./GuiManager";
import {
  clamp,
  isInside,
  fetchURL,
  downloadFile,
  createCircularImage,
} from "./Utils";

import { saveSettings, loadSettings } from "./GuiSave";

/* Essentials */
const UIRoundedRectangle = Java.type(
  "gg.essential.elementa.components.UIRoundedRectangle"
);
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat
  .INSTANCE;
const Color = java.awt.Color;
const File = java.io.File;

const matrix = UMatrixStack.get();

const PADDING = 10;
const BORDER_WIDTH = 2;
const CORNER_RADIUS = 10;

const BACKGROUND_COLOR = new Color(0.089, 0.089, 0.089, 0.1);
const BACKGROUND_BORDER_COLOR = new Color(0.12, 0.12, 0.12, 0.8);
const BAR_COLOR = new Color(0.15, 0.15, 0.15, 1);
const BAR_BORDER_COLOR = new Color(0.18, 0.18, 0.18, 1);
const GRADIENT_TOP_COLOR = new Color(0.6, 0.4, 0.8, 1);
const GRADIENT_BOTTOM_COLOR = new Color(0.4, 0.6, 0.8, 1);

const ANIMATION_DURATION = 200;
const PROFILE_PICTURE_SIZE = 18;
const PROFILE_PICTURE_OUTLINE = 1;

let openStartTime = 0;
let animatedBackground = {};
let animatedTopPanel = {};
let animatedLeftPanel = {};
let animatedRightPanel = {};

const profilePath = new File("config/ChatTriggers/assets/discordProfile.png");

try {
  if (!profilePath.exists()) {
    new Thread(() => {
      // make sure folder exists
      if (!profilePath.getParentFile().exists())
        profilePath.getParentFile().mkdirs();

      // get all data
      let data = JSON.parse(
        fetchURL(
          `https://client.rdbt.top/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${
            global.APIKEY_DO_NOT_SHARE
          }`
        )
      );

      // only get avatar and define file path
      let avatarUrl = data.discord.avatar;
      let saveFile = new File("config/ChatTriggers/assets/discordProfile.png");

      downloadFile(avatarUrl, saveFile.getAbsolutePath());
    }).start();
  }
} catch (error) {
  ChatLib.chat("Failed to download your Discord pfp :(");
}

if (profilePath.exists()) {
  let avatarPath = Image.fromAsset("discordProfile.png");
  global.discordPfp = createCircularImage(avatarPath);
}

let rectangles = {
  Background: {
    name: "Background",
    x: Renderer.screen.getWidth() / 2 - 300,
    y: Renderer.screen.getHeight() / 2 - 200,
    width: 600,
    height: 420,
    radius: CORNER_RADIUS,
    color: BACKGROUND_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BACKGROUND_BORDER_COLOR,
    isAnimated: true,
  },
  TopPanel: {
    name: "Top",
    get x() {
      return rectangles.Background.x + PADDING;
    },
    get y() {
      return rectangles.Background.y + PADDING;
    },
    get width() {
      return rectangles.Background.width - PADDING * 2;
    },
    height: 30,
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
    isAnimated: true,
  },
  LeftPanel: {
    name: "Left",
    get x() {
      return rectangles.Background.x + PADDING;
    },
    get y() {
      return rectangles.TopPanel.y + rectangles.TopPanel.height + PADDING - 40;
    },
    width: 50,
    get height() {
      const remainingSpace =
        rectangles.Background.height -
        PADDING * 3 -
        rectangles.TopPanel.height +
        40;
      return remainingSpace;
    },
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
    isAnimated: true,
  },
  RightPanel: {
    name: "Right",
    get x() {
      return rectangles.LeftPanel.x + rectangles.LeftPanel.width + PADDING;
    },
    get y() {
      return rectangles.TopPanel.y + rectangles.TopPanel.height + PADDING;
    },
    get width() {
      const remainingWidth =
        rectangles.Background.width - PADDING * 3 - rectangles.LeftPanel.width;
      return remainingWidth;
    },
    get height() {
      const remainingSpace =
        rectangles.Background.height - PADDING * 3 - rectangles.TopPanel.height;
      return remainingSpace;
    },
    radius: CORNER_RADIUS,
    color: BAR_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BAR_BORDER_COLOR,
    isAnimated: true,
  },
};

const myGui = new Gui();

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
    const bw = r.borderWidth;
    const innerWidth = Math.max(0, r.width - bw * 2);
    const innerHeight = Math.max(0, r.height - bw * 2);
    const innerRadius = Math.max(0, r.radius - bw); // Only draw border if it's visible

    if (r.borderColor && bw > 0) {
      drawRoundedRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        radius: r.radius,
        color: r.borderColor,
      });
    } // Only draw inner rectangle if it has valid dimensions

    if (innerWidth > 0 && innerHeight > 0) {
      drawRoundedRectangle({
        x: r.x + bw,
        y: r.y + bw,
        width: innerWidth,
        height: innerHeight,
        radius: innerRadius,
        color: r.color,
      });
    }
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
  if (height <= 0) return;
  radius = Math.min(radius, Math.min(width, height) / 2);
  const hw = lineWidth / 2;
  const ir = radius - hw;

  const getColorAtY = (currentY) => {
    const factor = (currentY - y) / height;
    return interpolateColor(topColor, bottomColor, factor);
  }; // Draw vertical segments

  const segmentHeight = Math.max(1, Math.floor((height - 2 * radius) / 20)); // Divide into 20 segments max

  for (let i = 0; i < height - 2 * radius; i += segmentHeight) {
    const currentY = y + radius + i;
    const remainingHeight = Math.min(segmentHeight, height - 2 * radius - i);
    const color = getColorAtY(currentY + remainingHeight / 2); // Use middle color for segment // Draw left and right vertical segments

    Renderer.drawRect(color.getRGB(), x, currentY, lineWidth, remainingHeight);
    Renderer.drawRect(
      color.getRGB(),
      x + width - lineWidth,
      currentY,
      lineWidth,
      remainingHeight
    );
  } // Draw horizontal lines with gradient approximation using segments

  const horizontalSegments = Math.max(1, Math.floor((width - 2 * radius) / 10));
  for (let i = 0; i < width - 2 * radius; i += horizontalSegments) {
    const currentX = x + radius + i;
    const remainingWidth = Math.min(horizontalSegments, width - 2 * radius - i); // Top horizontal line - use top color

    Renderer.drawRect(
      topColor.getRGB(),
      currentX,
      y,
      remainingWidth,
      lineWidth
    ); // Bottom horizontal line - use bottom color

    Renderer.drawRect(
      bottomColor.getRGB(),
      currentX,
      y + height - lineWidth,
      remainingWidth,
      lineWidth
    );
  }

  const steps = Math.min(30, radius); // Adaptive steps based on radius
  const centers = {
    tl: { x: x + radius, y: y + radius },
    tr: { x: x + width - radius, y: y + radius },
    bl: { x: x + radius, y: y + height - radius },
    br: { x: x + width - radius, y: y + height - radius },
  };

  const cornerPoints = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * (Math.PI / 2);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    cornerPoints.push({
      tl: { dx: -cos, dy: -sin },
      tr: { dx: cos, dy: -sin },
      bl: { dx: -cos, dy: sin },
      br: { dx: cos, dy: sin },
    });
  }

  const pixelSize = Math.max(1, Math.floor(lineWidth / 2));
  for (
    let i = 0;
    i < cornerPoints.length;
    i += Math.max(1, Math.floor(steps / 15))
  ) {
    const points = cornerPoints[i];

    ["tl", "tr", "bl", "br"].forEach((corner) => {
      const center = centers[corner];
      const point = points[corner];
      const px = center.x + point.dx * ir;
      const py = center.y + point.dy * ir;
      const color = getColorAtY(py - hw);

      Renderer.drawRect(color.getRGB(), px - hw, py - hw, pixelSize, pixelSize);
    });
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
  utils: {},
  colors: {
    gradientTop: GRADIENT_TOP_COLOR,
    gradientBottom: GRADIENT_BOTTOM_COLOR,
  },
});

const drawGUI = (mouseX, mouseY) => {
  const elapsed = Date.now() - openStartTime;
  const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

  const targetBackground = rectangles.Background;
  const startX = targetBackground.x + targetBackground.width / 2;
  const startY = targetBackground.y + targetBackground.height / 2;

  const currentWidth = targetBackground.width * progress;
  const currentHeight = targetBackground.height * progress;

  Object.assign(animatedBackground, targetBackground, {
    x: startX - currentWidth / 2,
    y: startY - currentHeight / 2,
    width: currentWidth,
    height: currentHeight,
  });

  Object.assign(animatedTopPanel, rectangles.TopPanel, {
    x: animatedBackground.x + PADDING,
    y: animatedBackground.y + PADDING,
    width: (targetBackground.width - PADDING * 2) * progress,
    height: rectangles.TopPanel.height * progress,
  });

  Object.assign(animatedLeftPanel, rectangles.LeftPanel, {
    x: animatedBackground.x + PADDING,
    y: animatedTopPanel.y + animatedTopPanel.height + PADDING,
    width: rectangles.LeftPanel.width * progress,
    height:
      (targetBackground.height - PADDING * 3 - rectangles.TopPanel.height) *
      progress,
  });

  Object.assign(animatedRightPanel, rectangles.RightPanel, {
    x: animatedLeftPanel.x + animatedLeftPanel.width + PADDING,
    y: animatedTopPanel.y + animatedTopPanel.height + PADDING,
    width:
      (targetBackground.width - PADDING * 3 - rectangles.LeftPanel.width) *
      progress,
    height:
      (targetBackground.height - PADDING * 3 - rectangles.TopPanel.height) *
      progress,
  });

  Client.getMinecraft().gameRenderer.renderBlur();

  drawRoundedRectangleWithBorder(animatedBackground);
  drawRoundedRectangleWithBorder(animatedTopPanel);
  drawRoundedRectangleWithBorder(animatedLeftPanel);
  drawRoundedRectangleWithBorder(animatedRightPanel);

  if (progress >= 0.8) {
    categoryManager.draw(mouseX, mouseY);
  }
};

myGui.registerDraw(drawGUI);

let dragging = false;

const handleClick = (mouseX, mouseY) => {
  if (
    isInside(mouseX, mouseY, rectangles.Background) &&
    !isInside(mouseX, mouseY, rectangles.TopPanel) &&
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

myGui.registerClosed(() => {
  saveSettings();
  loadSettings();
});

myGui.registerScrolled(handleScroll);

// spam this everywhere ...
loadSettings();

register("command", () => {
  isOpening = true;
  openStartTime = Date.now();
  loadSettings();
  myGui.open();
}).setName("gui");
