import RendererUtils, { Align, OutlineMode } from "./RendererUtils";

// Helpers - Use RendererMain.js methods!

const TextLayerType = net.minecraft.client.font.TextRenderer.class_6415; // class_6415: TextLayerType
const VertexConsumers = Client.getMinecraft()
  .getBufferBuilders()
  .getEntityVertexConsumers();

const NEWLINE_REGEX = /\n|\r\n?/;
export default class RenderLib2d {
  /**
   * Draws a filled rectangle.
   * @param {Object} options - Options for the rectangle.
   * @param {number} options.x - X-coordinate of the rectangle.
   * @param {number} options.y - Y-coordinate of the rectangle.
   * @param {number} options.z - Z-coordinate of the rectangle.
   * @param {number} options.width - Width of the rectangle.
   * @param {number} options.height - Height of the rectangle.
   * @param {number} options.scale - Scale of the rectangle.
   * @param {number} options.color - Color of the rectangle.
   * @param {string} options.align - Alignment of the rectangle.
   * @return {void}
   */
  static drawRect({
    x = 0,
    y = 0,
    z = 200,
    width = 1,
    height = 1,
    scale = 1,
    color = Renderer.WHITE,
    align = Align.TOP_LEFT,
  }) {
    align = align.split("_");
    if (align[0] == "CENTER") y -= (height / 2) * scale;
    if (align[0] == "BOTTOM") y -= height * scale;
    if (align[1] == "CENTER") x -= (width / 2) * scale;
    if (align[1] == "RIGHT") x -= width * scale;
    width *= scale;
    height *= scale;
    Renderer.pushMatrix() //
      .translate(x, y, z)
      .enableDepth()
      .drawRect(color, 0, 0, width, height)
      .popMatrix();
  }

  /**
   * Draws an outlined rectangle.
   * @param {Object} options - Options for the rectangle outline.
   * @param {number} options.x - X-coordinate of the rectangle.
   * @param {number} options.y - Y-coordinate of the rectangle.
   * @param {number} options.z - Z-coordinate of the rectangle.
   * @param {number} options.width - Width of the rectangle.
   * @param {number} options.height - Height of the rectangle.
   * @param {number} options.scale - Scale of the rectangle.
   * @param {number} options.color - Color of the rectangle.
   * @param {string} options.align - Alignment of the rectangle.
   * @param {number} options.lineWidth - Width of the outline.
   * @param {string} options.outlineMode - Outline mode (INLINE, CENTER, OUTLINE).
   * @return {void}
   */
  static drawRectOutline({
    x = 0,
    y = 0,
    z = 200,
    width = 1,
    height = 1,
    scale = 1,
    color = Renderer.WHITE,
    align = Align.TOP_LEFT,
    lineWidth = 1,
    outlineMode = OutlineMode.CENTER,
  }) {
    align = align.split("_");
    if (align[0] == "CENTER") y -= (height / 2) * scale;
    if (align[0] == "BOTTOM") y -= height * scale;
    if (align[1] == "CENTER") x -= (width / 2) * scale;
    if (align[1] == "RIGHT") x -= width * scale;

    width *= scale;
    height *= scale;

    const lw = lineWidth;
    let a = 0;
    let b = 0;

    if (outlineMode == OutlineMode.INLINE) [a, b] = [0, lw / 2];
    if (outlineMode == OutlineMode.CENTER) [a, b] = [-lw / 2, 0];
    if (outlineMode == OutlineMode.OUTLINE) [a, b] = [-lw, -lw / 2];

    Renderer.pushMatrix().translate(x, y, z).enableDepth();

    Renderer.drawLine(color, a, b, width - a, b, lineWidth); //top
    Renderer.drawLine(color, a, height - b, width - a, height - b, lineWidth); //bottom
    Renderer.drawLine(color, b, lw + a, b, height - lw - a, lineWidth); //left
    Renderer.drawLine(
      color,
      width - b,
      lw + a,
      width - b,
      height - lw - a,
      lineWidth
    ); //right

    Renderer.popMatrix();
  }

  /**
   * Draws a filled circle.
   * @param {Object} options - Options for the circle.
   * @param {number} options.x - X-coordinate of the circle.
   * @param {number} options.y - Y-coordinate of the circle.
   * @param {number} options.z - Z-coordinate of the circle.
   * @param {number} options.radius - Radius of the circle.
   * @param {number} options.color - Color of the circle.
   * @param {number} options.steps - Number of steps for rendering the circle.
   * @param {string} options.align - Alignment of the circle.
   * @return {void}
   */
  static drawCircle({
    x = 0,
    y = 0,
    z = 200,
    radius = 1,
    color = Renderer.WHITE,
    steps = 16,
    align = Align.TOP_LEFT,
  }) {
    this.drawEllipse({
      x,
      y,
      z,
      width: radius,
      height: radius,
      color,
      steps,
      align,
    });
  }

  /**
   * Draws a filled ellipse.
   * @param {Object} options - Options for the ellipse.
   * @param {number} options.x - X-coordinate of the ellipse.
   * @param {number} options.y - Y-coordinate of the ellipse.
   * @param {number} options.z - Z-coordinate of the ellipse.
   * @param {number} options.width - Width of the ellipse.
   * @param {number} options.height - Height of the ellipse.
   * @param {number} options.color - Color of the ellipse.
   * @param {number} options.steps - Number of steps for rendering the ellipse.
   * @param {string} options.align - Alignment of the ellipse.
   * @return {void}
   */
  static drawEllipse({
    x = 0,
    y = 0,
    z = 200,
    width = 1,
    height = 1,
    color = Renderer.WHITE,
    steps = 16,
    align = Align.TOP_LEFT,
  }) {
    steps = Math.clamp(steps, 4, 360);
    align = align.split("_");
    if (align[0] == "TOP") y += height;
    if (align[0] == "BOTTOM") y -= height;
    if (align[1] == "LEFT") x += width;
    if (align[1] == "RIGHT") x -= width;

    Renderer.pushMatrix()
      .translate(x, y, z)
      .enableDepth()
      .begin(
        Renderer.DrawMode.TRIANGLE_FAN,
        Renderer.VertexFormat.POSITION_COLOR
      );

    for (let i = 0; i < steps; i++) {
      const radians = (i / steps) * Math.PI * 2;
      const sin = Math.sin(radians) * width;
      const cos = Math.cos(radians) * height;
      Renderer.pos(sin, cos, 0).color(color);
    }
    Renderer.draw();
    Renderer.disableDepth().popMatrix();
  }

  /**
   * Draws an outlined circle.
   * @param {Object} options - Options for the circle outline.
   * @param {number} options.x - X-coordinate of the circle.
   * @param {number} options.y - Y-coordinate of the circle.
   * @param {number} options.z - Z-coordinate of the circle.
   * @param {number} options.radius - Radius of the circle.
   * @param {number} options.color - Color of the circle.
   * @param {number} options.steps - Number of steps for rendering the circle.
   * @param {string} options.align - Alignment of the circle.
   * @param {number} options.lineWidth - Width of the outline.
   * @param {string} options.outlineMode - Outline mode (INLINE, CENTER, OUTLINE).
   * @return {void}
   */
  static drawCircleOutline({
    x = 0,
    y = 0,
    z = 200,
    radius = 1,
    color = Renderer.WHITE,
    steps = 16,
    align = Align.TOP_LEFT,
    lineWidth = 1,
    outlineMode = OutlineMode.CENTER,
  }) {
    this.drawEllipseOutline({
      x,
      y,
      z,
      width: radius,
      height: radius,
      color,
      steps,
      align,
      lineWidth,
      outlineMode,
    });
  }

  /**
   * Draws an outlined ellipse.
   * @param {Object} options - Options for the ellipse outline.
   * @param {number} options.x - X-coordinate of the ellipse.
   * @param {number} options.y - Y-coordinate of the ellipse.
   * @param {number} options.z - Z-coordinate of the ellipse.
   * @param {number} options.width - Width of the ellipse.
   * @param {number} options.height - Height of the ellipse.
   * @param {number} options.color - Color of the ellipse.
   * @param {number} options.steps - Number of steps for rendering the ellipse.
   * @param {string} options.align - Alignment of the ellipse.
   * @param {number} options.lineWidth - Width of the outline.
   * @param {string} options.outlineMode - Outline mode (INLINE, CENTER, OUTLINE).
   * @return {void}
   */
  static drawEllipseOutline({
    x = 0,
    y = 0,
    z = 200,
    width = 1,
    height = 1,
    color = Renderer.WHITE,
    steps = 16,
    align = Align.TOP_LEFT,
    lineWidth = 1,
    outlineMode = OutlineMode.CENTER,
  }) {
    steps = Math.clamp(steps, 4, 360);
    align = align.split("_");
    if (align[0] == "TOP") y += height;
    if (align[0] == "BOTTOM") y -= height;
    if (align[1] == "LEFT") x += width;
    if (align[1] == "RIGHT") x -= width;

    let inner = 0;
    let outer = 0;
    if (outlineMode == OutlineMode.INLINE) [inner, outer] = [lineWidth, 0];
    if (outlineMode == OutlineMode.CENTER)
      [inner, outer] = [lineWidth / 2, lineWidth / 2];
    if (outlineMode == OutlineMode.OUTLINE) [inner, outer] = [0, lineWidth];

    Renderer.pushMatrix()
      .translate(x, y, z)
      .enableDepth()
      .begin(
        Renderer.DrawMode.TRIANGLE_STRIP,
        Renderer.VertexFormat.POSITION_COLOR
      );

    for (let i = 0; i <= steps; i++) {
      const radians = (i / steps) * Math.PI * 2;
      const sin = Math.sin(radians) * (width - inner);
      const cos = Math.cos(radians) * (height - inner);
      const sin1 = Math.sin(radians) * (width + outer);
      const cos1 = Math.cos(radians) * (height + outer);
      Renderer.pos(sin, cos, 0).color(color);
      Renderer.pos(sin1, cos1, 0).color(color);
    }
    Renderer.draw();
    Renderer.disableDepth().popMatrix();
  }

  /**
   * Draws a line between two points.
   * @param {Object} options - Options for the line.
   * @param {number} options.x - X-coordinate of the starting point.
   * @param {number} options.y - Y-coordinate of the starting point.
   * @param {number} options.z - Z-coordinate of the line.
   * @param {number} options.x1 - X-coordinate of the ending point.
   * @param {number} options.y1 - Y-coordinate of the ending point.
   * @param {number} options.color - Color of the line.
   * @param {number} options.lineWidth - Width of the line.
   * @return {void}
   */
  static drawLine({
    x = 0,
    y = 0,
    z = 200,
    x1 = 0,
    y1 = 0,
    color = Renderer.WHITE,
    lineWidth = 1,
  }) {
    Renderer.pushMatrix().translate(0, 0, z).enableDepth();
    Renderer.drawLine(color, x, y, x1, y1, lineWidth);
    Renderer.disableDepth().popMatrix();
  }

  /**
   * Draws a string of text.
   * @param {Object} options - Options for the text.
   * @param {string} options.text - The text to draw.
   * @param {number} options.x - X-coordinate of the text.
   * @param {number} options.y - Y-coordinate of the text.
   * @param {number} options.z - Z-coordinate of the text.
   * @param {number} options.scale - Scale of the text.
   * @param {number} options.color - Color of the text.
   * @param {boolean} options.shadow - Whether to draw a shadow.
   * @param {number} options.backgroundColor - Background color of the text.
   * @param {number} options.light - Light level of the text.
   * @param {string} options.align - Alignment of the text.
   * @return {void}
   */
  static drawString({
    text,
    x = 0,
    y = 0,
    z = 300,
    scale = 1,
    color = Renderer.WHITE,
    shadow = false,
    backgroundColor = Renderer.getColor(0, 0, 0, 0),
    light = 15,
    align = Align.CENTER,
  }) {
    const TextRenderer = Renderer.getFontRenderer();
    let yOffset = 0;
    align = align.split("_");
    if (align[0] == "CENTER") y -= (TextRenderer.fontHeight / 2) * scale;
    if (align[0] == "BOTTOM") y -= TextRenderer.fontHeight * scale;
    if (align[1] == "CENTER") x -= (Renderer.getStringWidth(text) / 2) * scale;
    if (align[1] == "RIGHT") x -= Renderer.getStringWidth(text) * scale;

    Renderer.pushMatrix().translate(x, y, z).scale(scale, scale, 1);
    ChatLib.addColor(text)
      .split(NEWLINE_REGEX)
      .forEach((line, i) => {
        TextRenderer.draw(
          line,
          0,
          yOffset,
          color,
          shadow,
          RendererUtils.getPositionMatrix(),
          VertexConsumers,
          TextLayerType.NORMAL,
          backgroundColor,
          light
        );
        yOffset += TextRenderer.fontHeight;
      });
    Renderer.popMatrix();
  }
}
