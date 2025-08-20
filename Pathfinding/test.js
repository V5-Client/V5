import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";

const Color = Java.type("java.awt.Color");

let pathNodes = [];
let keyNodes = [];

register("command", (x1, y1, z1, x2, y2, z2) => {
  x1 = parseInt(x1);
  y1 = parseInt(y1);
  z1 = parseInt(z1);
  x2 = parseInt(x2);
  y2 = parseInt(y2);
  z2 = parseInt(z2);

  request(
    `http://localhost:3000/api/pathfinding?start=${x1},${y1},${z1}&end=${x2},${y2},${z2}&map=mines`,
    { json: true },
    (err, res, body) => {
      if (err) return ChatLib.chat("§cError fetching path!");
      if (!body || !body.path) return ChatLib.chat("§cNo path returned!");

      pathNodes = body.path;
      keyNodes = body.keynodes;

      ChatLib.chat(
        `§aRendering path with ${pathNodes.length} nodes and ${keyNodes.length} key nodes`
      );
    }
  );
}).setName("rustpath");

register("renderWorld", () => {
  for (let node of pathNodes) {
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      new Color(0.0, 1.0, 0.0, 1.0)
    );
  }

  for (let node of keyNodes) {
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      new Color(1.0, 0.0, 0.0, 1.0)
    );
  }
});

register("command", function () {
  const block = Player.lookingAt();

  if (!block) {
    ChatLib.chat("You are not looking at a block");
    return;
  }

  ChatLib.chat(block?.type?.isTranslucent());
}).setName("istranslucent");
