const Color = java.awt.Color
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat.INSTANCE;
const matrix = UMatrixStack.get();
const UIRoundedRectangle = Java.type("gg.essential.elementa.components.UIRoundedRectangle");

export class ToggleButton {
  constructor(title, x, y, width = 10, height = 10) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.enabled = false;
  }

  draw() {
    const enabledColor = new Color(0.6, 0.3, 0.8, 0.8); // purple when enabled
    const disabledColor = new Color(0.11, 0.11, 0.11, 1); // dark when disabled
    const textColor = 0xffffff;

    const toggleColor = this.enabled ? enabledColor : disabledColor;
    const scale = 0.9;

    UIRoundedRectangle.Companion.drawRoundedRectangle(
      matrix,
      this.x,
      this.y,
      this.x + this.width,
      this.y + this.height,
      3,
      toggleColor
    );

    Renderer.scale(scale, scale);
    Renderer.drawString(
      this.title,
      (this.x + this.width + 4) / scale,
      (this.y + this.height / 2 - 4) / scale,
      textColor,
      false
    );

    Renderer.scale(1 / scale, 1 / scale);
  }

  handleClick(mouseX, mouseY) {
    if (
      mouseX >= this.x &&
      mouseX <= this.x + this.width &&
      mouseY >= this.y &&
      mouseY <= this.y + this.height
    ) {
      this.enabled = !this.enabled;
      return true;
    }
    return false;
  }
}
