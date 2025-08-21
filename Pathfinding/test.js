import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";

const Color = Java.type("java.awt.Color");

let pathNodes = [];
let keyNodes = [];

register("command", (x1, y1, z1, x2, y2, z2) => {
  pathNodes = [];
  keyNodes = [];
  x1 = parseInt(x1);
  y1 = parseInt(y1);
  z1 = parseInt(z1);
  x2 = parseInt(x2);
  y2 = parseInt(y2);
  z2 = parseInt(z2);

  const url = `http://localhost:3000/api/pathfinding?start=${x1},${y1},${z1}&end=${x2},${y2},${z2}&map=mines`;
  ChatLib.chat(`§eSending request to pathfinder...`);

  request({
    url: url,
    json: true,
    timeout: 15000, 
  })
    .then((body) => {
      if (!body || !body.path) {
        ChatLib.chat("§cResponse received, but no valid path was found in it.");
        return;
      }

      pathNodes = body.path;
      keyNodes = body.keynodes || []; // handle missing keynodes

      ChatLib.chat(
        `§aPath found with ${pathNodes.length} nodes and ${keyNodes.length} key nodes.`
      );
    })
    .catch((err) => {
      ChatLib.chat("§cError during request to pathfinder:");
      console.log(`Error: ${err}`);
    });
}).setName("rustpath");

register("renderWorld", () => {
  // Only rendering every 5th node to stop it from killing fps since you didn't optimize rendering at ALL zurviq...
  const step = 5;
  for (let i = 0; i < pathNodes.length; i += step) {
    const node = pathNodes[i];
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      new Color(0.0, 1.0, 0.0, 1.0)
    );
  }

  // Draw all key nodes since they are important
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
