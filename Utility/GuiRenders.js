const Color = Java.type("java.awt.Color");

class GuiRenders {
  constructor() {
    this.drawQueue = [];

    // Example: queue rectangle every tick (optional)
    register("tick", () => {
      // You can comment this out later
      // this.DrawRoundedRect(new Color(255, 128, 77, 128), 50, 50, 200, 100, 20);
    });
  }

  /**
   * Queue a rounded rectangle to be drawn on next render tick
   * @param {java.awt.Color} colour
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   */
  DrawRoundedRect(colour, x, y, width, height, radius) {
    this.drawQueue.push({ colour, x, y, width, height, radius });
  }

  /**
   * Called every render frame with current matrices to draw all queued rectangles
   * @param {net.minecraft.client.util.math.MatrixStack} matrices
   */
  render(matrices) {
    const UIRoundedRectangle = Java.type(
      "gg.essential.elementa.components.UIRoundedRectangle"
    );

    for (const rect of this.drawQueue) {
      UIRoundedRectangle.Companion.drawRoundedRectangle(
        matrices,
        rect.x,
        rect.y,
        rect.x + rect.width,
        rect.y + rect.height,
        rect.radius,
        rect.colour
      );
    }

    this.drawQueue = []; // clear after drawing
  }
}

export const GuiRendering = new GuiRenders();
