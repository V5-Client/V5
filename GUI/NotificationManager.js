const Color = java.awt.Color;
const UIRoundedRectangle = Java.type("gg.essential.elementa.components.UIRoundedRectangle");
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat.INSTANCE;
const matrix = UMatrixStack.get();

// Configuration
const NOTIFICATION_WIDTH = 250;
const NOTIFICATION_HEIGHT = 56;
const NOTIFICATION_PADDING = 10;
const NOTIFICATION_SPACING = 8;
const NOTIFICATION_MARGIN = 20;
const DEFAULT_NOTIFICATION_DURATION = 5000; 
const ANIMATION_DURATION = 300;
const CORNER_RADIUS = 8;

// Colors
const BACKGROUND_COLOR = new Color(0x23/255, 0x25/255, 0x31/255, 0.9);
const ICON_BACKGROUND_COLOR = new Color(1, 1, 1, 0.05);
const ICON_SYMBOL_COLOR = 0xdddddd; // Light gray for icons
const TEXT_COLOR = 0xffffff;
const DESCRIPTION_COLOR = 0x808080;
const CLOSE_BUTTON_COLOR = 0x999999;
const CLOSE_BUTTON_HOVER_COLOR = new Color(1, 1, 1, 0.05);
const PROGRESS_BAR_COLOR = new Color(1, 1, 1, 0.2);

const NOTIFICATION_TYPES = {
  "SUCCESS": {
    outlineColor: new Color(parseInt("2b9875", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        const points = [{x: -6, y: 0}, {x: -2, y: 4}, {x: 6, y: -4}];
        for (let i = 0; i < points.length - 1; i++) {
            const x1 = centerX + points[i].x, y1 = centerY + points[i].y;
            const x2 = centerX + points[i+1].x, y2 = centerY + points[i+1].y;
            Renderer.drawLine(color, x1, y1, x2, y2, 2);
        }
    }
  },
  "ERROR": {
    outlineColor: new Color(parseInt("ef4444", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        const size = 5;
        Renderer.drawLine(color, centerX - size, centerY - size, centerX + size, centerY + size, 2);
        Renderer.drawLine(color, centerX - size, centerY + size, centerX + size, centerY - size, 2);
    }
  },
  "DANGER": {
    outlineColor: new Color(parseInt("ff0f0f", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 8);
        Renderer.drawRect(color, centerX - 1.5, centerY + 4, 3, 3);
    }
  },
  "CHECK-IN": {
    outlineColor: new Color(parseInt("99cc33", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        const points = [{x: 0, y: 1}, {x: 3, y: 4}, {x: 8, y: -4}]; 
        for (let i = 0; i < points.length - 1; i++) {
            const x1 = centerX + points[i].x - 4;
            const y1 = centerY + points[i].y;
            const x2 = centerX + points[i+1].x - 4;
            const y2 = centerY + points[i+1].y;
            Renderer.drawLine(color, x1, y1, x2, y2, 2);
        }
    }
  },
   "WARNING": {
    outlineColor: new Color(parseInt("f59e0b", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 8);
        Renderer.drawRect(color, centerX - 1.5, centerY + 4, 3, 3);
    }
  },
  "INFO": {
    outlineColor: new Color(parseInt("3b82f6", 16)),
    iconDrawer: (centerX, centerY, alpha) => {
        const color = (alpha << 24) | ICON_SYMBOL_COLOR;
        Renderer.drawRect(color, centerX - 1.5, centerY - 6, 3, 3);
        Renderer.drawRect(color, centerX - 1.5, centerY - 2, 3, 8);
    }
  },
};

class Notification {
  constructor(title, description, type = "SUCCESS", duration = DEFAULT_NOTIFICATION_DURATION) {
    this.title = title;
    this.description = description;
    this.type = NOTIFICATION_TYPES[type] ? type : "SUCCESS";
    this.duration = duration; // <-- custom duration per notification
    this.createdAt = Date.now();
    this.state = "entering";
    this.animationStart = Date.now();
    this.x = Renderer.screen.getWidth();
    this.targetX = Renderer.screen.getWidth() - NOTIFICATION_WIDTH - NOTIFICATION_MARGIN;
    this.y = Renderer.screen.getHeight(); 
    this.targetY = 0;
    this.opacity = 0;
    this.closeHovered = false;
  }

  updatePosition(index) {
    this.targetY = Renderer.screen.getHeight() - NOTIFICATION_MARGIN - NOTIFICATION_HEIGHT - (NOTIFICATION_HEIGHT + NOTIFICATION_SPACING) * index;
  }

  update() {
    const now = Date.now();
    const lifetime = now - this.createdAt;

    if (this.state === "entering") {
      const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
      const eased = this.easeOutCubic(progress);
      this.x = Renderer.screen.getWidth() - (Renderer.screen.getWidth() - this.targetX) * eased;
      this.opacity = eased;
      
      if (progress >= 1) this.state = "active";
    } else if (this.state === "active") {
      this.x = this.targetX;
      this.opacity = 1;
      
      if (lifetime >= this.duration) this.startExit();
    } else if (this.state === "exiting") {
      const progress = Math.min(1, (now - this.animationStart) / ANIMATION_DURATION);
      const eased = this.easeInCubic(progress);
      this.x = this.targetX + (Renderer.screen.getWidth() - this.targetX) * eased;
      this.opacity = 1 - eased;
      
      if (progress >= 1) this.state = "removed";
    }

    const yDiff = this.targetY - this.y;
    if (Math.abs(yDiff) > 0.5) {
      this.y += yDiff * 0.3;
    } else {
      this.y = this.targetY;
    }
  }

  startExit() {
    if (this.state !== "exiting") {
      this.state = "exiting";
      this.animationStart = Date.now();
    }
  }

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  easeInCubic(t) { return t * t * t; }

  draw(mouseX, mouseY) {
    if (this.state === "removed") return;

    const alpha = this.opacity;
    const typeInfo = NOTIFICATION_TYPES[this.type];
    
    const bgColor = new Color(BACKGROUND_COLOR.getRed()/255, BACKGROUND_COLOR.getGreen()/255, BACKGROUND_COLOR.getBlue()/255, BACKGROUND_COLOR.getAlpha()/255 * alpha);
    UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, this.x, this.y, this.x + NOTIFICATION_WIDTH, this.y + NOTIFICATION_HEIGHT, CORNER_RADIUS, bgColor);

    const iconBgX = this.x + NOTIFICATION_PADDING;
    const iconBgY = this.y + NOTIFICATION_HEIGHT / 2 - 12;
    const iconBgSize = 24;

    const outlineColor = new Color(typeInfo.outlineColor.getRed()/255, typeInfo.outlineColor.getGreen()/255, typeInfo.outlineColor.getBlue()/255, alpha);
    UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, iconBgX - 1, iconBgY - 1, iconBgX + iconBgSize + 1, iconBgY + iconBgSize + 1, 7, outlineColor);

    const iconBgColor = new Color(ICON_BACKGROUND_COLOR.getRed()/255, ICON_BACKGROUND_COLOR.getGreen()/255, ICON_BACKGROUND_COLOR.getBlue()/255, ICON_BACKGROUND_COLOR.getAlpha()/255 * alpha);
    UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, iconBgX, iconBgY, iconBgX + iconBgSize, iconBgY + iconBgSize, 6, iconBgColor);

    typeInfo.iconDrawer(iconBgX + iconBgSize / 2, iconBgY + iconBgSize / 2, Math.floor(alpha * 255));
    
    const textX = iconBgX + iconBgSize + 8;
    const titleY = this.y + NOTIFICATION_HEIGHT / 2 - 8;
    const descY = titleY + 12;
    
    const textAlpha = (Math.floor(alpha * 255) << 24) | TEXT_COLOR;
    const descAlpha = (Math.floor(alpha * 255) << 24) | DESCRIPTION_COLOR;
    
    Renderer.drawString(this.title, textX, titleY, textAlpha, false);
    
    const scale = 0.8;
    Renderer.scale(scale, scale);
    Renderer.drawString(this.description, textX / scale, descY / scale, descAlpha, false);
    Renderer.scale(1 / scale, 1 / scale);

    const closeX = this.x + NOTIFICATION_WIDTH - 30;
    const closeY = this.y + NOTIFICATION_HEIGHT / 2 - 10;
    const closeSize = 20;
    
    const closeRect = { x: closeX, y: closeY, width: closeSize, height: closeSize };
    this.closeHovered = this.isInside(mouseX, mouseY, closeRect);
    
    if (this.closeHovered) {
      const hoverColor = new Color(CLOSE_BUTTON_HOVER_COLOR.getRed()/255, CLOSE_BUTTON_HOVER_COLOR.getGreen()/255, CLOSE_BUTTON_HOVER_COLOR.getBlue()/255, CLOSE_BUTTON_HOVER_COLOR.getAlpha()/255 * alpha);
      UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, closeX, closeY, closeX + closeSize, closeY + closeSize, 4, hoverColor);
    }
    
    this.drawXSymbol(closeX + closeSize / 2, closeY + closeSize / 2, Math.floor(alpha * 255));

    if (this.state === "active") {
      const progress = 1 - ((Date.now() - this.createdAt) / this.duration); 
      const progressBarHeight = 2;
      const progressBarY = this.y + NOTIFICATION_HEIGHT - progressBarHeight;
      const progressBarWidth = NOTIFICATION_WIDTH * progress;
      
      const progressColor = new Color(PROGRESS_BAR_COLOR.getRed()/255, PROGRESS_BAR_COLOR.getGreen()/255, PROGRESS_BAR_COLOR.getBlue()/255, PROGRESS_BAR_COLOR.getAlpha()/255 * alpha);
      UIRoundedRectangle.Companion.drawRoundedRectangle(matrix, this.x, progressBarY, this.x + progressBarWidth, progressBarY + progressBarHeight, 0, progressColor);
    }
  }

  drawXSymbol(centerX, centerY, alpha) {
    const color = (alpha << 24) | CLOSE_BUTTON_COLOR;
    const size = 4;
    Renderer.drawLine(color, centerX - size, centerY - size, centerX + size, centerY + size, 1.5);
    Renderer.drawLine(color, centerX - size, centerY + size, centerX + size, centerY - size, 1.5);
  }

  isInside(mouseX, mouseY, rect) {
    return mouseX >= rect.x && mouseX <= rect.x + rect.width &&
           mouseY >= rect.y && mouseY <= rect.y + rect.height;
  }

  handleClick(mouseX, mouseY) {
    if (this.closeHovered) {
      this.startExit();
      return true;
    }
    return false;
  }
}

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.renderTrigger = register("renderOverlay", () => this.render());
    this.clickTrigger = register("guiMouseClick", (mouseX, mouseY, button) => {
      if (button === 0) this.handleClick(mouseX, mouseY);
    });
    this.tickTrigger = register("tick", () => this.update());
  }

  add(title, description, type = "SUCCESS", duration = DEFAULT_NOTIFICATION_DURATION) {
    const notification = new Notification(title, description, type, duration);
    this.notifications.unshift(notification); 
    this.updatePositions();
  }

  update() {
    this.notifications.forEach(n => n.update());
    
    const beforeCount = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.state !== "removed");
    
    if (this.notifications.length !== beforeCount) {
      this.updatePositions();
    }
  }

  updatePositions() {
    this.notifications.forEach((n, index) => n.updatePosition(index));
  }

  render() {
    const mouseX = Client.getMouseX();
    const mouseY = Client.getMouseY();
    
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].draw(mouseX, mouseY);
    }
  }

  handleClick(mouseX, mouseY) {
    for (const notification of this.notifications) {
      if (notification.handleClick(mouseX, mouseY)) break;
    }
  }

  destroy() {
    this.renderTrigger.unregister();
    this.clickTrigger.unregister();
    this.tickTrigger.unregister();
  }
}

global.notificationManager = new NotificationManager();

global.showNotification = (title, description, type = "SUCCESS", duration = DEFAULT_NOTIFICATION_DURATION) => {
  global.notificationManager.add(title, description, type, duration);
};