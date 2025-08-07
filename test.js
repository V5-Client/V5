import RenderLib3d from "./Rendering/Render3d";
const Color = Java.type("java.awt.Color");
const transparentRed = new Color(1, 0, 0, 0.2);

register("postRenderWorld", () => {
  const boxStart = new Vec3i(88, 63, -374);

  RenderLib3d.drawLine({
    start: new Vec3i(245, 63, -368),
    vector: new Vec3i(5, 15, 20), // draw a line from start towards this vector
    color: 0x00ff00, // green color (hex number)
    lineWidth: 2,
    depthTest: true,
  });
});
