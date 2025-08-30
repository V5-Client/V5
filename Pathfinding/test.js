import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";
import { Rotations } from "../Utility/Rotations";

const Color = java.awt.Color;

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
  targetRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
  baseRotationSpeed: 230.0,
  currentRotationSpeed: 260.0,
  rotationSmoothing: 2.25,
  lookAheadDistance: 4.0,
  visitedKeyNodes: new Set(),
  movementHeld: false,
  targetPoint: null,
  sprintHeld: false,
  lastUpdateTime: Date.now(),
  keyNodeIndices: [],
  pathCurvatures: [],
  hasReachedEnd: false,
  jumpCooldown: 0
};

// Constants
const STUCK_THRESHOLD = 2000;
const NODE_REACH_DISTANCE = 2.5;
const NODE_REACH_DISTANCE_SPRINT = 3.5;
const END_REACH_DISTANCE = 1.5;
const SPLINE_SEGMENTS = 10;
const JUMP_COOLDOWN_TICKS = 10;
const VERTICAL_LOOK_FACTOR = 0.02;

// Generate spline using key nodes 
function generateKeyNodeSpline(keyNodes, allNodes) {
  if (!keyNodes || keyNodes.length < 2) {
    return simplifyPath(allNodes, 1.0);
  }
  
  const splinePoints = [];
  const curvatures = [];
  
  for (let i = 0; i < keyNodes.length - 1; i++) {
    const startKey = keyNodes[i];
    const endKey = keyNodes[i + 1];
    
    const startIdx = findClosestNodeIndex(startKey, allNodes);
    const endIdx = findClosestNodeIndex(endKey, allNodes);
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const segmentNodes = allNodes.slice(startIdx, endIdx + 1);
      const simplified = simplifyPath(segmentNodes, 0.5);
      
      for (let j = 0; j < simplified.length - 1; j++) {
        const p0 = simplified[Math.max(0, j - 1)];
        const p1 = simplified[j];
        const p2 = simplified[j + 1];
        const p3 = simplified[Math.min(simplified.length - 1, j + 2)];
        
        const segments = (j === 0 || j === simplified.length - 2) ? SPLINE_SEGMENTS : 5;
        
        for (let t = 0; t < segments; t++) {
          const tNorm = t / segments;
          const point = catmullRomPoint(p0, p1, p2, p3, tNorm);
          splinePoints.push(point);
          
          const curvature = calculateCurvature(p0, p1, p2, p3, tNorm);
          curvatures.push(curvature);
        }
      }
    } else {
      for (let t = 0; t <= SPLINE_SEGMENTS; t++) {
        const tNorm = t / SPLINE_SEGMENTS;
        const point = {
          x: startKey.x + (endKey.x - startKey.x) * tNorm,
          y: startKey.y + (endKey.y - startKey.y) * tNorm,
          z: startKey.z + (endKey.z - startKey.z) * tNorm
        };
        splinePoints.push(point);
        curvatures.push(0.1);
      }
    }
  }
  
  splinePoints.push(keyNodes[keyNodes.length - 1]);
  curvatures.push(0);
  
  movementState.pathCurvatures = curvatures;
  
  return splinePoints;
}

// Calculate curvature using second derivative
function calculateCurvature(p0, p1, p2, p3, t) {
  const dx_dt = 0.5 * (
    (-p0.x + p2.x) +
    2 * t * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) +
    3 * t * t * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x)
  );
  
  const dz_dt = 0.5 * (
    (-p0.z + p2.z) +
    2 * t * (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) +
    3 * t * t * (-p0.z + 3 * p1.z - 3 * p2.z + p3.z)
  );
  
  const d2x_dt2 = 0.5 * (
    2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) +
    6 * t * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x)
  );
  
  const d2z_dt2 = 0.5 * (
    2 * (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) +
    6 * t * (-p0.z + 3 * p1.z - 3 * p2.z + p3.z)
  );
  
  const speed = Math.sqrt(dx_dt * dx_dt + dz_dt * dz_dt);
  if (speed < 0.001) return 0;
  
  const crossProduct = Math.abs(dx_dt * d2z_dt2 - dz_dt * d2x_dt2);
  const curvature = crossProduct / Math.pow(speed, 3);
  
  return Math.min(1, curvature * 10);
}

// Check if block requires jumping (not slab, not stair)
function shouldJumpForBlock(playerPos, targetPos) {
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  if (dist > 2.0) return false; // Too far to check
  
  // Check if there's a block in front at foot level
  const checkX = Math.floor(playerPos.x + dx * 0.5);
  const checkY = Math.floor(playerPos.y);
  const checkZ = Math.floor(playerPos.z + dz * 0.5);
  
  const blockInFront = World.getBlockAt(checkX, checkY, checkZ);
  const blockAbove = World.getBlockAt(checkX, checkY + 1, checkZ);
  
  if (!blockInFront || blockInFront.type.isAir()) return false;
  if (blockAbove && !blockAbove.type.isAir()) return false; // Can't jump if blocked above
  
  const blockName = blockInFront.type.getName().toLowerCase();
  
  // Don't jump for slabs or stairs
  if (blockName.includes("slab") || blockName.includes("stair")) {
    return false;
  }
  
  // Check if we need to jump (solid block in front)
  if (!blockInFront.type.isAir() && targetPos.y > playerPos.y - 0.5) {
    return true;
  }
  
  return false;
}

// Simplify path using Ramer-Douglas-Peucker algorithm
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  
  let maxDist = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  } else {
    return [points[0], points[points.length - 1]];
  }
}

// Calculate perpendicular distance from point to line
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const dz = lineEnd.z - lineStart.z;
  
  const lineLengthSq = dx * dx + dy * dy + dz * dz;
  if (lineLengthSq === 0) return getDistance3D(point, lineStart);
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy + (point.z - lineStart.z) * dz) / lineLengthSq
  ));
  
  const projection = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
    z: lineStart.z + t * dz
  };
  
  return getDistance3D(point, projection);
}

// Find closest node index
function findClosestNodeIndex(target, nodes) {
  let bestIdx = -1;
  let bestDist = Infinity;
  
  for (let i = 0; i < nodes.length; i++) {
    const dist = getDistance3D(target, nodes[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  
  return bestIdx;
}

// Catmull-Rom spline point calculation
function catmullRomPoint(p0, p1, p2, p3, t) {
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

// Helper functions
function getDistance3D(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}

function getDistance2D(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  );
}

// Find closest point on path
function findClosestPointOnPath(playerPos, path) {
  let closestIdx = 0;
  let closestDist = Infinity;
  
  for (let i = 0; i < path.length; i++) {
    const dist = getDistance3D(playerPos, path[i]);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  
  return { index: closestIdx, distance: closestDist };
}

// Get look-ahead point with changing distance
function getLookAheadPoint(currentIdx, path, baseDistance) {
  if (currentIdx >= path.length - 1) {
    return path[path.length - 1];
  }
  
  const curvature = movementState.pathCurvatures[currentIdx] || 0;
  const adjustedDistance = baseDistance * (1 - curvature * 0.5);
  
  let accumulatedDist = 0;
  let targetPoint = path[currentIdx];
  
  for (let i = currentIdx; i < path.length - 1; i++) {
    const segmentDist = getDistance3D(path[i], path[i + 1]);
    
    if (accumulatedDist + segmentDist >= adjustedDistance) {
      const t = (adjustedDistance - accumulatedDist) / segmentDist;
      targetPoint = {
        x: path[i].x + (path[i + 1].x - path[i].x) * t,
        y: path[i].y + (path[i + 1].y - path[i].y) * t,
        z: path[i].z + (path[i + 1].z - path[i].z) * t
      };
      break;
    }
    
    accumulatedDist += segmentDist;
    if (i === path.length - 2) {
      targetPoint = path[path.length - 1];
    }
  }
  
  return targetPoint;
}

function stopPathingMovement() {
  movementState.isWalking = false;
  movementState.visitedKeyNodes.clear();
  movementState.currentNodeIndex = 0;
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.targetPoint = null;
  movementState.hasReachedEnd = false;
  movementState.jumpCooldown = 0;
  
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

  movementState.splinePath = generateKeyNodeSpline(keyNodes, nodes);
  
  movementState.keyNodeIndices = [];
  for (let keyNode of keyNodes) {
    const closest = findClosestPointOnPath(keyNode, movementState.splinePath);
    if (closest.distance < 2.0) {
      movementState.keyNodeIndices.push(closest.index);
    }
  }
  
  movementState.visitedKeyNodes.clear();

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  
  const closest = findClosestPointOnPath(playerPos, movementState.splinePath);
  movementState.currentNodeIndex = closest.index;

  movementState.isWalking = true;
  movementState.lastPosition = { ...playerPos };
  movementState.stuckTimer = 0;
  movementState.lastRotation = { yaw: Player.getYaw(), pitch: Player.getPitch() };
  movementState.targetRotation = { yaw: Player.getYaw(), pitch: Player.getPitch() };
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.lastUpdateTime = Date.now();
  movementState.hasReachedEnd = false;
  movementState.jumpCooldown = 0;

  ChatLib.chat(`&aStarting optimized path from node ${movementState.currentNodeIndex}/${movementState.splinePath.length}`);
}

function updatePath() {
  if (!movementState.splinePath || movementState.splinePath.length === 0) {
    stopPathingMovement();
    return;
  }
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const onGround = Player.getPlayer()?.field_70122_E;
  const isSprinting = Player.getPlayer()?.isSprinting();
  
  const wasFalling = movementState.isFalling;
  movementState.isFalling = !onGround;
  
  if (!wasFalling && movementState.isFalling) {
    movementState.fallStartY = playerPos.y;
  }
  
  const finalNode = movementState.splinePath[movementState.splinePath.length - 1];
  const distToEnd = getDistance3D(playerPos, finalNode);
  
  if (distToEnd < END_REACH_DISTANCE && !movementState.hasReachedEnd) {
    movementState.hasReachedEnd = true;
    ChatLib.chat("&aReached destination!");
    stopPathingMovement();
    return;
  }
  
  const reachDistance = isSprinting ? NODE_REACH_DISTANCE_SPRINT : NODE_REACH_DISTANCE;
  
  while (movementState.currentNodeIndex < movementState.splinePath.length - 1) {
    const currentNode = movementState.splinePath[movementState.currentNodeIndex];
    const nextNode = movementState.splinePath[Math.min(movementState.currentNodeIndex + 1, movementState.splinePath.length - 1)];
    
    const distanceToNode = movementState.isFalling ? 
      getDistance2D(playerPos, currentNode) : 
      getDistance3D(playerPos, currentNode);
    
    const distanceToNext = movementState.isFalling ?
      getDistance2D(playerPos, nextNode) :
      getDistance3D(playerPos, nextNode);
    
    const nodeToNext = getDistance3D(currentNode, nextNode);
    
    // Advance if:
    // We're within reach distance of current node
    // We're closer to the next node than the current node
    // We've passed the current node (closer to next than current is to next)
    if (distanceToNode < reachDistance || 
        distanceToNext < distanceToNode || 
        (distanceToNext < nodeToNext && distanceToNode < reachDistance * 2)) {
      movementState.currentNodeIndex++;
      
      const keyIdx = movementState.keyNodeIndices.indexOf(movementState.currentNodeIndex);
      if (keyIdx !== -1) {
        movementState.visitedKeyNodes.add(keyIdx);
      }
    } else {
      break;
    }
  }
  
  const currentCurvature = movementState.pathCurvatures[movementState.currentNodeIndex] || 0;
  movementState.currentRotationSpeed = movementState.baseRotationSpeed * (1 - currentCurvature * 0.4);
  
  const baseDistance = isSprinting ? movementState.lookAheadDistance * 1.3 : movementState.lookAheadDistance;
  movementState.targetPoint = getLookAheadPoint(movementState.currentNodeIndex, movementState.splinePath, baseDistance);
}

function updateRotations() {
  if (!movementState.isWalking || !movementState.targetPoint) return;
  
  const now = Date.now();
  const deltaTime = Math.min((now - movementState.lastUpdateTime) / 1000.0, 0.05);
  
  const playerPos = Player.getPlayer().getEyePos();
  const playerPosObj = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
  
  let dx = movementState.targetPoint.x - playerPosObj.x;
  let dy = movementState.targetPoint.y - playerPosObj.y;
  let dz = movementState.targetPoint.z - playerPosObj.z;
  
  if (!movementState.isFalling) {
    dy *= VERTICAL_LOOK_FACTOR; 
  } else {
    dy *= 0.3; 
  }
  
  const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const dist2D = Math.sqrt(dx * dx + dz * dz);
  let targetPitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);
  
  // Clamp pitch to reasonable values
  targetPitch = Math.max(-10, Math.min(10, targetPitch));
  
  movementState.targetRotation = { yaw: targetYaw, pitch: targetPitch };
  
  let yawDiff = movementState.targetRotation.yaw - movementState.lastRotation.yaw;
  while (yawDiff > 180) yawDiff -= 360;
  while (yawDiff < -180) yawDiff += 360;
  
  let pitchDiff = movementState.targetRotation.pitch - movementState.lastRotation.pitch;
  
  const maxRotation = movementState.currentRotationSpeed * deltaTime;
  
  // Apply smoothing
  const smoothedYawDiff = yawDiff * movementState.rotationSmoothing;
  const smoothedPitchDiff = pitchDiff * movementState.rotationSmoothing;
  
  const yawChange = Math.sign(smoothedYawDiff) * Math.min(Math.abs(smoothedYawDiff), maxRotation);
  const pitchChange = Math.sign(smoothedPitchDiff) * Math.min(Math.abs(smoothedPitchDiff), maxRotation * 0.5);
  
  movementState.lastRotation.yaw += yawChange;
  movementState.lastRotation.pitch += pitchChange;
  
  while (movementState.lastRotation.yaw > 180) movementState.lastRotation.yaw -= 360;
  while (movementState.lastRotation.yaw < -180) movementState.lastRotation.yaw += 360;
  
  Rotations.rotateToAngles(movementState.lastRotation.yaw, movementState.lastRotation.pitch);
}

// Stuck detection and movement control
let lastStuckCheck = Date.now();
let lastBlockPos = null;

register('tick', () => {
  if (!movementState.isWalking) return;
  
  const now = Date.now();
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  
  // Update jump cooldown
  if (movementState.jumpCooldown > 0) {
    movementState.jumpCooldown--;
  }
  
  const currentBlockPos = {
    x: Math.floor(playerPos.x),
    y: Math.floor(playerPos.y),
    z: Math.floor(playerPos.z)
  };
  
  if (now - lastStuckCheck > 100) {
    if (lastBlockPos &&
        currentBlockPos.x === lastBlockPos.x &&
        currentBlockPos.y === lastBlockPos.y &&
        currentBlockPos.z === lastBlockPos.z &&
        !movementState.isFalling) {
      movementState.stuckTimer += (now - lastStuckCheck);
      
      if (movementState.stuckTimer >= STUCK_THRESHOLD) {
        ChatLib.chat("&cStuck detected, attempting to unstuck...");
        
        try {
          mc.options.jumpKey.setPressed(true);
          Client.scheduleTask(5, () => {
            mc.options.jumpKey.setPressed(false);
          });
          movementState.jumpCooldown = JUMP_COOLDOWN_TICKS;
        } catch (e) {}
        
        movementState.stuckTimer = 0;
      }
    } else {
      movementState.stuckTimer = 0;
    }
    
    lastBlockPos = { ...currentBlockPos };
    lastStuckCheck = now;
  }
  
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
      
      // Auto-jump for non-slab/non-stair blocks
      if (onGround && movementState.jumpCooldown === 0 && movementState.targetPoint) {
        if (shouldJumpForBlock(playerPos, movementState.targetPoint)) {
          mc.options.jumpKey.setPressed(true);
          Client.scheduleTask(2, () => {
            mc.options.jumpKey.setPressed(false);
          });
          movementState.jumpCooldown = JUMP_COOLDOWN_TICKS;
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
  
  movementState.lastUpdateTime = Date.now();

  keyNodes.forEach((node, idx) => {
    const isVisited = movementState.visitedKeyNodes.has(idx);
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      isVisited ?
        new Color(0.5, 0.5, 0.5, 0.5) :
        new Color(1.0, 0.0, 0.0, 1.0)
    );
  });

  if (movementState.targetPoint) {
    RendererMain.drawWaypoint(
      new Vec3i(
        Math.floor(movementState.targetPoint.x),
        Math.floor(movementState.targetPoint.y),
        Math.floor(movementState.targetPoint.z)
      ),
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