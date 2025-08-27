import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";
import { Rotations } from "../Utility/Rotations";

const Color = java.awt.Color

let pathNodes = [];
let keyNodes = [];
let process = null;
const path = "./config/ChatTriggers/assets/Pathfinding.exe";

const mc = Client.getMinecraft();

// Movement state
let movementState = {
  isWalking: false,
  currentNodeIndex: 0,
  splinePath: [],
  lastPosition: null,
  stuckTimer: 0,
  isFalling: false,
  fallStartY: 0,
  lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
  rotationSmoothing: 0.15, // Smoothing factor for rotations
  lookAheadDistance: 5.0, // Pure pursuit look-ahead distance
  visitedNodes: new Set(),
  movementHeld: false,
  targetPoint: null,
  sprintHeld: false
};

// Constants
const STUCK_THRESHOLD = 60;
const NODE_REACH_DISTANCE = 3.0; // How close to a node to consider it "reached"
const NODE_REACH_DISTANCE_SPRINT = 4.5; // more lenient when sprinting
const SPLINE_RESOLUTION = 3; // Points between each node for spline

// Catmull-Rom spline interpolation
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: 0.5 * ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) +
      (-p0.z + p2.z) * t +
      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
  };
}

// Generate smooth spline path from nodes
function generateSplinePath(nodes) {
  if (nodes.length < 2) return nodes;
  
  let splinePath = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[Math.max(0, i - 1)];
    const p1 = nodes[i];
    const p2 = nodes[i + 1];
    const p3 = nodes[Math.min(nodes.length - 1, i + 2)];
    
    for (let j = 0; j < SPLINE_RESOLUTION; j++) {
      const t = j / SPLINE_RESOLUTION;
      splinePath.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  
  // Add the last node
  splinePath.push(nodes[nodes.length - 1]);
  
  return splinePath;
}

// Find the closest point on the path to the player (so it can start without going to the first node)
// THIS WOULDN'T BE NECESSARY IF THE PATH COMMAND AT THE PLAYER'S CURRENT POSITION
function findClosestPointIndex(playerPos, path) {
  let closestIndex = 0;
  let closestDistance = Infinity;
  
  for (let i = 0; i < path.length; i++) {
    const dist = getDistance3D(playerPos, path[i]);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

// Smooth rotation interpolation
function smoothRotation(currentYaw, currentPitch, targetYaw, targetPitch, smoothing) {
  // Normalize yaw difference
  let yawDiff = targetYaw - currentYaw;
  while (yawDiff > 180) yawDiff -= 360;
  while (yawDiff < -180) yawDiff += 360;
  
  const smoothedYaw = currentYaw + yawDiff * smoothing;
  const smoothedPitch = currentPitch + (targetPitch - currentPitch) * smoothing;
  
  return { yaw: smoothedYaw, pitch: smoothedPitch };
}

// Helper function for 3D distance
function getDistance3D(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}

// Helper function for 2D distance (ignoring Y)
function getDistance2D(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}

function stopPathingMovement() {
  movementState.isWalking = false;
  movementState.visitedNodes.clear();
  movementState.currentNodeIndex = 0;
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.targetPoint = null;
  // IMPORTANT: IF YOU WANT TO KEEP THE PATH VISIBLE AFTER STOPPING, COMMENT OUT THE NEXT 2 LINES
  // movementState.splinePath = []; // clear spline path (stops rendering green and grey nodes)
  // keyNodes = []; // clear key nodes (stops rendering red nodes)
  
  try {
    mc.options.forwardKey.setPressed(false);
    mc.options.leftKey.setPressed(false);
    mc.options.rightKey.setPressed(false);
    mc.options.backKey.setPressed(false);
    mc.options.jumpKey.setPressed(false);
    mc.options.sprintKey.setPressed(false);
  } catch (e) {}
  
  Rotations.stopRotation();
}

function startPathingFromNodes(nodes) {
  if (!nodes || nodes.length === 0) return;

  movementState.splinePath = generateSplinePath(nodes);
  movementState.visitedNodes.clear();

  // map raw node -> closest spline index, this is used for rendering grey/green
  movementState.rawToSpline = nodes.map(n => 
    findClosestPointIndex(n, movementState.splinePath)
  );

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  movementState.currentNodeIndex = findClosestPointIndex(playerPos, movementState.splinePath);

  movementState.isWalking = true;
  movementState.lastPosition = { ...playerPos };
  movementState.stuckTimer = 0;
  movementState.lastRotation = { yaw: Player.getYaw(), pitch: Player.getPitch() };
  movementState.movementHeld = false;
  movementState.sprintHeld = false;

  ChatLib.chat(`&aStarting path from node ${movementState.currentNodeIndex}/${movementState.splinePath.length}`);
}


function updatePath() {
  if (!movementState.splinePath || movementState.splinePath.length === 0) {
    stopPathingMovement();
    return;
  }
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const onGround = Player.getPlayer()?.field_70122_E; // onGround field
  const isSprinting = Player.getPlayer()?.isSprinting();
  
  // Detect falling
  const wasFalling = movementState.isFalling;
  movementState.isFalling = !onGround;
  
  if (!wasFalling && movementState.isFalling) {
    movementState.fallStartY = playerPos.y;
  }
  
  // Check if we've reached the end
  if (movementState.currentNodeIndex >= movementState.splinePath.length - 1) {
    const finalNode = movementState.splinePath[movementState.splinePath.length - 1];
    const distToEnd = getDistance3D(playerPos, finalNode);
    
    if (distToEnd < NODE_REACH_DISTANCE) {
      ChatLib.chat("&aReached destination!");
      stopPathingMovement();
      return;
    }
  }
  
  const reachDistance = isSprinting ? NODE_REACH_DISTANCE_SPRINT : NODE_REACH_DISTANCE;
  
  // Update current position on path
  while (movementState.currentNodeIndex < movementState.splinePath.length - 1) {
    const currentNode = movementState.splinePath[movementState.currentNodeIndex];
    let distanceToNode;
    
    if (movementState.isFalling) {
      // When falling, only consider horizontal distance (ignore Y to stop going backwards)
      distanceToNode = getDistance2D(playerPos, currentNode);
    } else {
      distanceToNode = getDistance3D(playerPos, currentNode);
    }
    
    const nextNode = movementState.splinePath[Math.min(movementState.currentNodeIndex + 1, movementState.splinePath.length - 1)];
    const distToNext = getDistance3D(playerPos, nextNode);
    const distCurrentToNext = getDistance3D(currentNode, nextNode);
    
    // Mark as visited if we're close enough OR if we're closer to the next node than the current node is
    if (distanceToNode < reachDistance || (distToNext < distCurrentToNext && distanceToNode < reachDistance * 1.5)) {
      movementState.visitedNodes.add(movementState.currentNodeIndex);
      movementState.currentNodeIndex++;
    } else {
      break; // Haven't reached this node yet
    }
  }
  
  // Pure Pursuit thingy, find look-ahead point
  let targetPoint = null;
  let accumulatedDist = 0;
  // Reduce look-ahead when sprinting to stop overshooting
  const lookAheadDist = movementState.isFalling ? 
    movementState.lookAheadDistance * 1.5 : 
    (isSprinting ? movementState.lookAheadDistance * 0.7 : movementState.lookAheadDistance);
  
  // Start from current node and look ahead
  for (let i = movementState.currentNodeIndex; i < movementState.splinePath.length - 1; i++) {
    const node = movementState.splinePath[i];
    const nextNode = movementState.splinePath[i + 1];
    
    const segmentDist = getDistance3D(node, nextNode);
    
    if (accumulatedDist + segmentDist >= lookAheadDist) {
      // Interpolate to get look-ahead point
      const t = Math.max(0, Math.min(1, (lookAheadDist - accumulatedDist) / segmentDist));
      targetPoint = {
        x: node.x + (nextNode.x - node.x) * t,
        y: node.y + (nextNode.y - node.y) * t,
        z: node.z + (nextNode.z - node.z) * t
      };
      break;
    }
    
    accumulatedDist += segmentDist;
  }
  
  // If we didn't find a look-ahead point, use the last node
  if (!targetPoint) {
    targetPoint = movementState.splinePath[movementState.splinePath.length - 1];
  }
  
  movementState.targetPoint = targetPoint;
}

function updateRotations() {
  if (!movementState.isWalking || !movementState.targetPoint) return;
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const isSprinting = Player.getPlayer()?.isSprinting();
  
  let dx = movementState.targetPoint.x - playerPos.x;
  let dy = movementState.targetPoint.y - playerPos.y;
  let dz = movementState.targetPoint.z - playerPos.z;
  
  // When falling, reduce vertical look rotations
  if (movementState.isFalling) {
    dy *= 0.3;
  }
  
  const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const dist2D = Math.sqrt(dx * dx + dz * dz);
  let targetPitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);
  
  // Clamp pitch to reasonable values
  targetPitch = Math.max(-45, Math.min(45, targetPitch));
  
  // More aggressive smoothing when sprinting to prevent overshooting
  const smoothingFactor = movementState.isFalling ? 
    movementState.rotationSmoothing * 0.5 : 
    (isSprinting ? movementState.rotationSmoothing * 1.5 : movementState.rotationSmoothing);
    
  const smoothedRotation = smoothRotation(
    movementState.lastRotation.yaw,
    movementState.lastRotation.pitch,
    targetYaw,
    targetPitch,
    smoothingFactor
  );
  
  movementState.lastRotation = smoothedRotation;
  Rotations.rotateToAngles(smoothedRotation.yaw, smoothedRotation.pitch);
}

// Update movement on tick (for unstuck and path progression)
register('tick', () => {
  if (!movementState.isWalking) return;
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  
  const currentBlockPos = {
    x: Math.floor(playerPos.x),
    y: Math.floor(playerPos.y),
    z: Math.floor(playerPos.z)
  };
  
  if (movementState.lastPosition &&
      currentBlockPos.x === Math.floor(movementState.lastPosition.x) &&
      currentBlockPos.y === Math.floor(movementState.lastPosition.y) &&
      currentBlockPos.z === Math.floor(movementState.lastPosition.z) &&
      !movementState.isFalling) {
    movementState.stuckTimer++;
    
    if (movementState.stuckTimer >= STUCK_THRESHOLD) {
      ChatLib.chat("&cStuck detected, attempting to unstuck...");
      try {
        mc.options.jumpKey.setPressed(true);
        Client.scheduleTask(5, () => {
          mc.options.jumpKey.setPressed(false);
        });
      } catch (e) {}
      movementState.stuckTimer = 0;
    }
  } else {
    movementState.stuckTimer = 0;
  }
  
  movementState.lastPosition = { ...playerPos };
  
  updatePath();
  
  try {
    if (movementState.isWalking) {
      if (!movementState.movementHeld) {
        mc.options.forwardKey.setPressed(true);
        movementState.movementHeld = true;
      }
      
      const onGround = Player.getPlayer()?.field_70122_E;
      if (!movementState.isFalling && onGround && !movementState.sprintHeld) {
        mc.options.sprintKey.setPressed(true);
        movementState.sprintHeld = true;
      } else if (movementState.isFalling && movementState.sprintHeld) {
        mc.options.sprintKey.setPressed(false);
        movementState.sprintHeld = false;
      }
      
      // Only pulse movement for very large falls
      if (movementState.isFalling && playerPos.y - movementState.fallStartY > 10) {
        if (World.getTime() % 4 === 0) {
          mc.options.forwardKey.setPressed(false);
        } else {
          mc.options.forwardKey.setPressed(true);
        }
      }
    }
    
  } catch (e) {
    console.log("Movement key error:", e);
  }
});

register('renderWorld', () => {
  if (movementState.isWalking) {
    updateRotations();
  }

  // Draw raw path nodes
  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const splineIndexForThisNode = movementState.rawToSpline?.[i] ?? 0;
    const isVisited = splineIndexForThisNode < movementState.currentNodeIndex;

    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      false,
      isVisited
        ? new Color(0.5, 0.5, 0.5, 0.3) // grey
        : new Color(0.0, 1.0, 0.0, 0.8) // green
    );
  }

  // Draw key nodes (red)
  for (let node of keyNodes) {
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      new Color(1.0, 0.0, 0.0, 1.0)
    );
  }

  // Draw current target block (yellow)
  if (
    movementState.isWalking &&
    movementState.currentNodeIndex < movementState.splinePath.length
  ) {
    const currentTarget = movementState.splinePath[movementState.currentNodeIndex];
    RendererMain.drawWaypoint(
      new Vec3i(Math.floor(currentTarget.x), Math.floor(currentTarget.y), Math.floor(currentTarget.z)),
      true,
      new Color(1.0, 1.0, 0.0, 1.0)
    );
  }
});


function runProgram() {
  if (!FileLib.exists(path)) return
  stopProgram();
  keepAlive.register();

  console.log("Running program");

  const JavaProcessBuilder = java.lang.ProcessBuilder
  const JavaScanner = java.util.Scanner
  const JavaThread = java.lang.Thread

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
    } catch (e) {}
    lastKeepAlive = Date.now();
    console.log(`Keep-alive sent at ${Date.now()}`);
  }
}).unregister();

register('worldUnload', () => {
  stopPathingMovement();
});

register('worldLoad', runProgram);

register('gameUnload', () => {
  stopPathingMovement();
  stopProgram();
});

const Runtime = java.lang.Runtime
const runtime = Runtime.getRuntime();
runtime.addShutdownHook(new java.lang.Thread(() => {
  stopPathingMovement();
  stopProgram();
}));

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
      keyNodes = body.keynodes || [];

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
  ChatLib.chat("&cStopped pathfinding");
}).setName('stop');