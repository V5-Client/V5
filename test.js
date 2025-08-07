//import RenderLib3d from "./Rendering/Render3DUtils";
import RendererMain from "./Rendering/RendererMain";
import RenderLib2d from "./Rendering/Render2DUtils";
import { Align } from "./Rendering/RendererUtils";
const Color = Java.type("java.awt.Color");
const transparentRed = new Color(1, 0, 0, 1);

register("postRenderWorld", () => {
  const boxStart = new Vec3i(88, 63, -374);

  RendererMain.drawWaypoint(new Vec3i(461, 82, 268), true);

  /*if (Player.lookingAt() !== null) {
    RenderLib3d.drawBox({
      start: new Vec3i(
        Player.lookingAt().getX(),
        Player.lookingAt().getY(),
        Player.lookingAt().getZ()
      ),
      size: new Vec3i(1, 1, 1),
      color: transparentRed,
      depth: false,
    });
  } */
});
