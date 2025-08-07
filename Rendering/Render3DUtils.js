import RendererUtils, { RenderLayers } from "./RendererUtils";

// Helpers - Use RendererMain.js methods!

const Color = java.awt.Color;

const VertexRendering = Java.type(
  "net.minecraft.client.render.VertexRendering"
);
const RenderLayer = Java.type("net.minecraft.client.render.RenderLayer");
const Vector3f = Java.type("org.joml.Vector3f");
const Vec3d = Java.type("net.minecraft.util.math.Vec3d");

const VCP = Client.getMinecraft()
  .getBufferBuilders()
  .getEntityVertexConsumers();

export default class RenderLib3d {
  static drawBox({
    start = new Vec3i(0, 0, 0),
    size = new Vec3i(1, 1, 1),
    end = undefined,
    color = Renderer.WHITE,
    depth = true,
    // filled = true, Doesnt work so force it true
  } = {}) {
    if (end) size = end.minus(start);

    // Extract RGBA components from color object, normalized to 0-1 floats
    const r = color.getRed() / 255;
    const g = color.getGreen() / 255;
    const b = color.getBlue() / 255;
    const a = color.getAlpha() / 255;

    Renderer.pushMatrix().translate(start.getX(), start.getY(), start.getZ());
    // Renderer.pushMatrix().translate(start.getX() - Client.camera.getX(), start.getY() - Client.camera.getY(), start.getZ() - Client.camera.getZ());

    Renderer.disableCull().enableBlend().depthMask(false);
    if (depth) Renderer.enableDepth();

    const dx = size.x;
    const h = size.y;
    const dz = size.z;

    Renderer3d.begin(
      /* filled ? */ Renderer.DrawMode
        .QUADS /* : Renderer.DrawMode.LINE_STRIP, */,
      Renderer.VertexFormat.POSITION_COLOR
    )
      .pos(dx, 0, dz)
      .color(r, g, b, a)
      .pos(dx, 0, 0)
      .color(r, g, b, a)
      .pos(0, 0, 0)
      .color(r, g, b, a)
      .pos(0, 0, dz)
      .color(r, g, b, a)

      .pos(dx, h, dz)
      .color(r, g, b, a)
      .pos(dx, h, 0)
      .color(r, g, b, a)
      .pos(0, h, 0)
      .color(r, g, b, a)
      .pos(0, h, dz)
      .color(r, g, b, a)

      .pos(0, h, dz)
      .color(r, g, b, a)
      .pos(0, h, 0)
      .color(r, g, b, a)
      .pos(0, 0, 0)
      .color(r, g, b, a)
      .pos(0, 0, dz)
      .color(r, g, b, a)

      .pos(dx, h, dz)
      .color(r, g, b, a)
      .pos(dx, h, 0)
      .color(r, g, b, a)
      .pos(dx, 0, 0)
      .color(r, g, b, a)
      .pos(dx, 0, dz)
      .color(r, g, b, a)

      .pos(dx, h, 0)
      .color(r, g, b, a)
      .pos(0, h, 0)
      .color(r, g, b, a)
      .pos(0, 0, 0)
      .color(r, g, b, a)
      .pos(dx, 0, 0)
      .color(r, g, b, a)

      .pos(0, h, dz)
      .color(r, g, b, a)
      .pos(dx, h, dz)
      .color(r, g, b, a)
      .pos(dx, 0, dz)
      .color(r, g, b, a)
      .pos(0, 0, dz)
      .color(r, g, b, a);

    Renderer3d.draw();

    if (depth) Renderer.disableDepth();
    Renderer.enableCull().disableBlend().depthMask(true).popMatrix();
  }

  static _drawBox({
    start = new Vec3i(0, 0, 0),
    size = new Vec3i(1, 1, 1),
    end = undefined,
    color = new Color(1, 1, 1), // default white Color object
    depthTest = true,
    filled = false,
    lineWidth = 2,
  } = {}) {
    if (end) size = end.minus(start);

    if (!filled) {
      Renderer.pushMatrix().translate(
        start.getX() - Client.camera.getX(),
        start.getY() - Client.camera.getY(),
        start.getZ() - Client.camera.getZ()
      );

      const vertexConsumer = VCP.getBuffer(
        depthTest
          ? RenderLayers.getLines(lineWidth)
          : RenderLayers.getLinesThroughWalls(lineWidth)
      );

      VertexRendering.drawBox(
        Renderer.matrixStack.toMC(),
        vertexConsumer,
        0,
        0,
        0,
        size.getX(),
        size.getY(),
        size.getZ(),
        color.getRed() / 255.0,
        color.getGreen() / 255.0,
        color.getBlue() / 255.0,
        1.0
      );

      Renderer.popMatrix();
    }
  }
  static drawOutline(
    voxelShape,
    offset = new Vec3i(0, 0, 0),
    color = Renderer.WHITE,
    lineWidth = 1,
    depthTest = true
  ) {
    color = Color.decode(color);

    const vertexConsumer = VCP.getBuffer(RenderLayers.getLines(lineWidth));
    VertexRendering.drawOutline(
      Renderer.matrixStack.toMC(),
      vertexConsumer,
      voxelShape,
      offset.getX(),
      offset.getY(),
      offset.getZ(),
      1.0,
      1.0,
      1.0,
      1.0
    );
  }
  static drawLine({
    start = new Vec3i(0, 0, 0),
    vector = new Vec3i(0, 0, 0),
    end = undefined,
    color = Renderer.WHITE,
    lineWidth = 1,
    depthTest = true,
  }) {
    if (end) vector = end.minus(start);
    color = Color.decode(color);

    vector = new Vec3d(vector.getX(), vector.getY(), vector.getZ());

    Renderer.pushMatrix().translate(
      start.getX() - Client.camera.getX(),
      start.getY() - Client.camera.getY(),
      start.getZ() - Client.camera.getZ()
    );

    const vertexConsumer = VCP.getBuffer(
      depthTest
        ? RenderLayers.getLines(lineWidth)
        : RenderLayers.getLinesThroughWalls(lineWidth)
    );
    VertexRendering.drawVector(
      Renderer.matrixStack.toMC(),
      vertexConsumer,
      new Vector3f(0, 0, 0),
      vector,
      RendererUtils.colorToARGB(color)
    );

    Renderer.popMatrix();
  }
}
