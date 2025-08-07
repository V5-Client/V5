import RenderLib3d from "./Rendering/Render3d";
const Color = Java.type("java.awt.Color");
const transparentRed = new Color(1, 0, 0, 0.5);
register("postRenderWorld", () => {
  const boxStart = new Vec3i(88, 63, -374);

  RenderLib3d.drawBox({
    start: boxStart,
    size: new Vec3i(100, 100, 100),
    color: 0x47FF5100,
    filled: true,
    depth: false,
  });
});
