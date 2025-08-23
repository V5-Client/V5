import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";
import { Rotations } from "../Utility/Rotations";

const Color = Java.type("java.awt.Color");

let pathNodes = [];
let keyNodes = [];

let process = null;
const path = "./config/ChatTriggers/assets/Pathfinding.exe";

const mc = Client.getMinecraft();
let currentSegment = [];
let nextSegment = null;
let isWalking = false;
let stuckTimer = 0;
let lastPosition = null;
const stuckThreshold = 60;
let pathWaypoints = [];
const lookAheadRadius = 5;

function stopPathingMovement() {
  isWalking = false;
  currentSegment = [];
  nextSegment = null;
  pathWaypoints = [];
  try {
    mc.options.forwardKey.setPressed(false);
    mc.options.leftKey.setPressed(false);
    mc.options.rightKey.setPressed(false);
  } catch (e) {}
  Rotations.stopRotation();
}

function startPathingFromNodes(nodes) {
  if (!nodes || nodes.length === 0) return;
  currentSegment = nodes.slice();
  nextSegment = null;
  pathWaypoints = [...currentSegment];
  isWalking = true;
  lastPosition = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  stuckTimer = 0;
}

function updateMovement() {
  // Stuck detection
  const currentPos = {
    x: Math.floor(Player.getX()),
    y: Math.floor(Player.getY()),
    z: Math.floor(Player.getZ()),
  };

  if (
    lastPosition &&
    currentPos.x === lastPosition.x &&
    currentPos.y === lastPosition.y &&
    currentPos.z === lastPosition.z
  ) {
    stuckTimer++;
  } else {
    stuckTimer = 0;
  }
  lastPosition = currentPos;

  if (stuckTimer >= stuckThreshold) {
    ChatLib.chat("&cStuck for too long, stopping movement...");
    stopPathingMovement();
    return;
  }

  if (!currentSegment || currentSegment.length === 0) {
    ChatLib.chat("&aReached destination!");
    stopPathingMovement();
    return;
  }

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

  let currentPathSegmentStart = null;
  let currentPathSegmentEnd = null;
  let segmentIndex = -1;

  for (let i = 0; i < currentSegment.length - 1; i++) {
    const distFromStart = Math.sqrt(
      Math.pow(playerPos.x - currentSegment[i].x - 0.5, 2) +
        Math.pow(playerPos.y - currentSegment[i].y, 2) +
        Math.pow(playerPos.z - currentSegment[i].z - 0.5, 2)
    );
    const distFromEnd = Math.sqrt(
      Math.pow(playerPos.x - currentSegment[i + 1].x - 0.5, 2) +
        Math.pow(playerPos.y - currentSegment[i + 1].y, 2) +
        Math.pow(playerPos.z - currentSegment[i + 1].z - 0.5, 2)
    );

    if (distFromStart < lookAheadRadius && distFromEnd > distFromStart) {
      currentPathSegmentStart = currentSegment[i];
      currentPathSegmentEnd = currentSegment[i + 1];
      segmentIndex = i;
      break;
    }
  }

  if (!currentPathSegmentStart) {
    currentPathSegmentStart = currentSegment[0];
    currentPathSegmentEnd = currentSegment[1] || currentSegment[0];
  }

  const dx = currentPathSegmentEnd.x - currentPathSegmentStart.x;
  const dy = currentPathSegmentEnd.y - currentPathSegmentStart.y;
  const dz = currentPathSegmentEnd.z - currentPathSegmentStart.z;
  const segmentLengthSquared = dx * dx + dy * dy + dz * dz;

  const t =
    segmentLengthSquared === 0
      ? 0
      : ((playerPos.x - currentPathSegmentStart.x) * dx +
          (playerPos.y - currentPathSegmentStart.y) * dy +
          (playerPos.z - currentPathSegmentStart.z) * dz) /
        segmentLengthSquared;

  const projectedPoint = {
    x: currentPathSegmentStart.x + dx * t,
    y: currentPathSegmentStart.y + dy * t,
    z: currentPathSegmentStart.z + dz * t,
  };

  let targetX, targetY, targetZ;
  const remainingDistance = lookAheadRadius;
  const remainingSegmentLength = Math.sqrt(
    Math.pow(currentPathSegmentEnd.x - projectedPoint.x, 2) +
      Math.pow(currentPathSegmentEnd.y - projectedPoint.y, 2) +
      Math.pow(currentPathSegmentEnd.z - projectedPoint.z, 2)
  );

  if (remainingSegmentLength >= remainingDistance) {
    const ratio = remainingDistance / remainingSegmentLength;
    targetX =
      projectedPoint.x + (currentPathSegmentEnd.x - projectedPoint.x) * ratio;
    targetY =
      projectedPoint.y + (currentPathSegmentEnd.y - projectedPoint.y) * ratio;
    targetZ =
      projectedPoint.z + (currentPathSegmentEnd.z - projectedPoint.z) * ratio;
  } else {
    let distanceCovered = remainingSegmentLength;
    let found = false;
    for (let i = segmentIndex + 1; i < currentSegment.length - 1; i++) {
      const nextSegmentLength = Math.sqrt(
        Math.pow(currentSegment[i + 1].x - currentSegment[i].x, 2) +
          Math.pow(currentSegment[i + 1].y - currentSegment[i].y, 2) +
          Math.pow(currentSegment[i + 1].z - currentSegment[i].z, 2)
      );
      if (distanceCovered + nextSegmentLength >= remainingDistance) {
        const ratio = (remainingDistance - distanceCovered) / nextSegmentLength;
        targetX =
          currentSegment[i].x +
          (currentSegment[i + 1].x - currentSegment[i].x) * ratio;
        targetY =
          currentSegment[i].y +
          (currentSegment[i + 1].y - currentSegment[i].y) * ratio;
        targetZ =
          currentSegment[i].z +
          (currentSegment[i + 1].z - currentSegment[i].z) * ratio;
        found = true;
        break;
      }
      distanceCovered += nextSegmentLength;
    }

    if (!found) {
      targetX = currentSegment[currentSegment.length - 1].x;
      targetY = currentSegment[currentSegment.length - 1].y;
      targetZ = currentSegment[currentSegment.length - 1].z;
    }
  }

  if (currentSegment.length > 0) {
    const distToNextNode = Math.sqrt(
      Math.pow(playerPos.x - currentSegment[0].x, 2) +
        Math.pow(playerPos.y - currentSegment[0].y, 2) +
        Math.pow(playerPos.z - currentSegment[0].z, 2)
    );
    if (distToNextNode < 5.0) {
      currentSegment.shift();
    }
  }

  const dx_rot = targetX - playerPos.x;
  const dy_rot = targetY - playerPos.y;
  const dz_rot = targetZ - playerPos.z;

  const yaw = Math.atan2(dz_rot, dx_rot) * (180 / Math.PI) - 90;
  const dist2D = Math.sqrt(dx_rot * dx_rot + dz_rot * dz_rot);
  const pitch = -Math.atan2(dy_rot, dist2D) * (180 / Math.PI) - 12.25;

  Rotations.rotateToAngles(yaw, pitch);
  try {
    mc.options.forwardKey.setPressed(true);
  } catch (e) {}

  // If close to the end, stop walking next tick
  if (currentSegment.length <= 1) {
  }
}

function runProgram() {
  stopProgram();
  keepAlive.register();

  console.log("Running program");

  const JavaProcessBuilder = Java.type("java.lang.ProcessBuilder");
  const JavaScanner = Java.type("java.util.Scanner");
  const JavaThread = Java.type("java.lang.Thread");

  new JavaThread(() => {
    try {
      process = new JavaProcessBuilder(path).start();
      const sc = new JavaScanner(process.getInputStream());

      console.log("Program started");

      while (process !== null && process.isAlive()) {
        JavaThread.sleep(50);

        while (sc.hasNextLine()) {
          let line = sc.nextLine();
          console.log(line);
        }
      }

      if (process !== null) process.waitFor();
      console.log("Program finished");
    } catch (e) {
      console.log(e);
    }
  }).start();
}

function stopProgram() {
  if (process !== null) {
    process.destroy();
    process = null;
    console.log("Program stopped");
    keepAlive.unregister();
  }
}

let lastKeepAlive = Date.now() - 50_000;

const keepAlive = register('tick', () => {
  if (Date.now() - lastKeepAlive > 60_000) {
    try {
      request({ url: "http://localhost:3000/keepalive", timeout: 5000, json: true })
        .then(() => {})
        .catch(() => {});
    } catch (e) {
      // ignore keepalive errors
    }
    lastKeepAlive = Date.now();
    console.log(`Keep-alive sent at ${Date.now()}`);
  }
}).unregister();

register('worldUnload', () => {
  stopPathingMovement();
});
register('worldLoad', runProgram);

register('tick', () => {
  if (isWalking) updateMovement();
});

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
  ChatLib.chat(`§eSending request to pathfinder...`);;

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

  // Start movement following the received path
  startPathingFromNodes(pathNodes);

      ChatLib.chat(
        `§aPath found with ${pathNodes.length} nodes and ${keyNodes.length} key nodes.`
      );
    })
    .catch((err) => {
      ChatLib.chat(`§cError during request to pathfinder: ${err}`);
      console.log(`Error: ${err}`);
    });
}).setName("rustpath");

register("renderWorld", () => {
  const step = 1; // increase to reduce number of rendered nodes
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

register('command', () => {
  stopPathingMovement();
  Rotations.stopRotation();
}).setName('stop');
