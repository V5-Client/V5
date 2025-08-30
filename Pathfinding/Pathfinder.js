import request from "requestV2";
import RendererMain from "../Rendering/RendererMain";
import { Rotations } from "../Utility/Rotations";

const Color = java.awt.Color;

let pathNodes = [];
let keyNodes = [];
let process = null;
const path = "./config/ChatTriggers/assets/Pathfinding.exe";
const mc = Client.getMinecraft();

const STUCK_THRESHOLD = 2000;
const END_REACH_DISTANCE = 1.5;
const SPLINE_SEGMENTS = 10;
const JUMP_PRESS_DURATION = 6; // Ticks to hold jump
const JUMP_COOLDOWN = 15;
const PURE_PURSUIT_LOOKAHEAD_BASE = 3.5;
const PURE_PURSUIT_LOOKAHEAD_SPRINT = 5.0;
const MIN_PROGRESS_INCREMENT = 0.01; // Minimum progress per tick

let movementState = {
  // Path following
  isWalking: false,
  purePursuitProgress: 0.0, // Current progress along spline (always increasing)
  lastValidProgress: 0.0, // Last known good progress
  splinePath: [],
  splineLength: 0, 
  
  lastPosition: null,
  stuckTimer: 0,
  
  isFalling: false,
  movementHeld: false,
  sprintHeld: false,
  jumpHeld: false,
  jumpReleaseTimer: 0,
  jumpCooldown: 0,
  
  currentYaw: Player.getYaw(),
  currentPitch: Player.getPitch(),
  targetPoint: null,
  
  lastUpdateTime: Date.now(),
  
  keyNodeProgress: [],
  visitedKeyNodes: new Set(),
  
  pathCurvatures: []
};

const getDistance3D = (pos1, pos2) => {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const getDistance2D = (pos1, pos2) => {
  const dx = pos1.x - pos2.x;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dz * dz);
};

function bresenham3D(x0, y0, z0, x1, y1, z1) {
  const points = [];
  
  x0 = Math.floor(x0);
  y0 = Math.floor(y0);
  z0 = Math.floor(z0);
  x1 = Math.floor(x1);
  y1 = Math.floor(y1);
  z1 = Math.floor(z1);
  
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const dz = Math.abs(z1 - z0);
  
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  
  const dm = Math.max(dx, dy, dz);
  let i = dm;
  let x1t = y1 = z1 = dm / 2;
  
  let x = x0, y = y0, z = z0;
  
  while (i-- >= 0) {
    points.push({ x, y, z });
    
    x1t -= dx;
    if (x1t < 0) {
      x1t += dm;
      x += sx;
    }
    
    y1 -= dy;
    if (y1 < 0) {
      y1 += dm;
      y += sy;
    }
    
    z1 -= dz;
    if (z1 < 0) {
      z1 += dm;
      z += sz;
    }
  }
  
  return points;
}

function isWalkable(x, y, z) {
  const blockBelow = World.getBlockAt(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
  const blockAtFeet = World.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z));
  const blockAtHead = World.getBlockAt(Math.floor(x), Math.floor(y) + 1, Math.floor(z));
  
  if (!blockBelow || !blockAtFeet || !blockAtHead) return false;
  
  const belowName = blockBelow.type.getRegistryName();
  const feetName = blockAtFeet.type.getRegistryName();
  const headName = blockAtHead.type.getRegistryName();
  
  const hasGround = belowName !== "minecraft:air" && 
                    belowName !== "minecraft:water" &&
                    belowName !== "minecraft:lava";
  
  const feetClear = feetName === "minecraft:air" || 
                    feetName.includes("carpet") ||
                    feetName.includes("rail");
                    
  const headClear = headName === "minecraft:air";
  
  return hasGround && feetClear && headClear;
}

function shouldJump(playerPos, targetPos) {
  if (targetPos.y > playerPos.y + 0.6) {
    return true;
  }
  
  // Forward obstacle check
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  if (dist < 0.5 || dist > 3) return false;
  
  // Check multiple points ahead for obstacles
  const checks = [0.5, 1.0, 1.5];
  for (let checkDist of checks) {
    if (checkDist > dist) break;
    
    const ratio = checkDist / dist;
    const checkX = Math.floor(playerPos.x + dx * ratio);
    const checkY = Math.floor(playerPos.y);
    const checkZ = Math.floor(playerPos.z + dz * ratio);
    
    const blockAtFeet = World.getBlockAt(checkX, checkY, checkZ);
    const blockAbove = World.getBlockAt(checkX, checkY + 1, checkZ);
    
    if (blockAtFeet && blockAtFeet.type.getRegistryName() !== "minecraft:air") {
      const blockName = blockAtFeet.type.getRegistryName().toLowerCase();
      
      // Don't jump for partial blocks
      if (blockName.includes("slab") || 
          blockName.includes("stair") || 
          blockName.includes("carpet")) {
        continue;
      }
      
      // Check if we can jump over it
      if (blockAbove && blockAbove.type.getRegistryName() === "minecraft:air") {
        return true;
      }
    }
  }
  
  return false;
}

// Check path walkability using Bresenham's
function canWalkBetween(fromPos, toPos) {
  const points = bresenham3D(
    fromPos.x, fromPos.y, fromPos.z,
    toPos.x, toPos.y, toPos.z
  );
  
  for (let point of points) {
    // Check at multiple heights
    const walkableHeights = [
      point.y,
      point.y + 1,
      point.y - 1,
      point.y + 0.5
    ];
    
    let foundWalkable = false;
    for (let y of walkableHeights) {
      if (isWalkable(point.x, y, point.z)) {
        foundWalkable = true;
        break;
      }
    }
    
    if (!foundWalkable) return false;
  }
  
  return true;
}

function purePursuitFindTarget(playerPos, splinePath, currentProgress, lookaheadDist) {
  // Ensure we never go backwards
  const startProgress = Math.max(currentProgress, 0);
  const maxProgress = splinePath.length - 1;
  
  // Find the furthest reachable point within lookahead distance
  let targetProgress = startProgress;
  let targetPoint = getProgressPoint(startProgress, splinePath);
  let accumulatedDist = 0;
  
  // Start from current progress and look ahead
  const stepSize = 0.2; // Check every 0.2 units of progress
  let checkProgress = startProgress;
  
  while (checkProgress < maxProgress && accumulatedDist < lookaheadDist) {
    checkProgress = Math.min(checkProgress + stepSize, maxProgress);
    const checkPoint = getProgressPoint(checkProgress, splinePath);
    
    const segmentDist = getDistance3D(
      getProgressPoint(checkProgress - stepSize, splinePath),
      checkPoint
    );
    
    if (accumulatedDist + segmentDist > lookaheadDist) {
      // Interpolate to exact lookahead distance
      const remainingDist = lookaheadDist - accumulatedDist;
      const t = remainingDist / segmentDist;
      const prevPoint = getProgressPoint(checkProgress - stepSize, splinePath);
      
      targetPoint = {
        x: prevPoint.x + (checkPoint.x - prevPoint.x) * t,
        y: prevPoint.y + (checkPoint.y - prevPoint.y) * t,
        z: prevPoint.z + (checkPoint.z - prevPoint.z) * t
      };
      targetProgress = checkProgress - stepSize + stepSize * t;
      break;
    }
    
    // Check if we can reach this point
    if (canWalkBetween(playerPos, checkPoint)) {
      targetPoint = checkPoint;
      targetProgress = checkProgress;
      accumulatedDist += segmentDist;
    } else {
      // Can't reach further, use last valid point
      break;
    }
  }
  
  return { point: targetPoint, progress: targetProgress };
}

// Get point on spline at specific progress
function getProgressPoint(progress, splinePath) {
  if (!splinePath || splinePath.length === 0) return null;
  
  progress = Math.max(0, Math.min(progress, splinePath.length - 1));
  
  const idx = Math.floor(progress);
  const t = progress - idx;
  
  if (idx >= splinePath.length - 1) {
    return splinePath[splinePath.length - 1];
  }
  
  const p1 = splinePath[idx];
  const p2 = splinePath[idx + 1];
  
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
    z: p1.z + (p2.z - p1.z) * t
  };
}

// Find closest progress on spline - ALWAYS FORWARD
function getClosestProgressForward(point, splinePath, minProgress) {
  let bestProgress = minProgress;
  let bestDist = Infinity;
  
  // Only search forward from minimum progress
  const startIdx = Math.floor(minProgress);
  
  for (let i = startIdx; i < splinePath.length - 1; i++) {
    const p1 = splinePath[i];
    const p2 = splinePath[i + 1];
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    
    if (lengthSq === 0) continue;
    
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy + (point.z - p1.z) * dz) / lengthSq;
    
    // For first segment, respect minimum progress
    if (i === startIdx) {
      const minT = minProgress - i;
      t = Math.max(minT, Math.min(1, t));
    } else {
      t = Math.max(0, Math.min(1, t));
    }
    
    const projection = {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
      z: p1.z + t * dz
    };
    
    const dist = getDistance3D(point, projection);
    
    // Prefer closer points but with forward bias
    const progress = i + t;
    const forwardBias = (progress - minProgress) * 0.1; // Slight preference for forward progress
    const adjustedDist = dist - forwardBias;
    
    if (adjustedDist < bestDist && progress >= minProgress) {
      bestDist = adjustedDist;
      bestProgress = progress;
    }
  }
  
  // Always move forward at least a little bit
  return Math.max(bestProgress, minProgress + MIN_PROGRESS_INCREMENT);
}

function calculateHumanizedRotation(currentYaw, currentPitch, targetPoint, playerPos, isFalling) {
  const dx = targetPoint.x - playerPos.x;
  const dy = targetPoint.y - (playerPos.y + 1.62);
  const dz = targetPoint.z - playerPos.z;
  
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  
  // Target yaw
  let targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  
  // Target pitch with human-like adjustments
  let targetPitch = 0;
  
  if (!isFalling && horizontalDist > 0.5) {
    // Natural pitch based on distance and height difference
    const angleToTarget = Math.atan2(-dy, horizontalDist) * (180 / Math.PI);
    
    if (horizontalDist < 2) {
      // Very close - minimal pitch adjustment
      targetPitch = angleToTarget * 0.1;
    } else if (horizontalDist < 5) {
      // Medium distance - moderate pitch
      targetPitch = angleToTarget * 0.25;
    } else {
      // Far distance - look mostly straight
      targetPitch = -3 + angleToTarget * 0.1;
    }
    
    targetPitch = Math.max(-20, Math.min(10, targetPitch));
  }
  
  // Calculate shortest rotation path
  let yawDiff = targetYaw - currentYaw;
  while (yawDiff > 180) yawDiff -= 360;
  while (yawDiff < -180) yawDiff += 360;
  
  // Dynamic smoothing based on angle difference
  const yawSmoothing = Math.abs(yawDiff) > 90 ? 0.4 : 
                       Math.abs(yawDiff) > 45 ? 0.3 : 0.2;
  const pitchSmoothing = 0.15;
  
  return {
    yaw: currentYaw + yawDiff * yawSmoothing,
    pitch: currentPitch + (targetPitch - currentPitch) * pitchSmoothing
  };
}

function generateKeyNodeSpline(keyNodes, allNodes) {
  if (!keyNodes || keyNodes.length < 2) {
    return simplifyPath(allNodes, 1.0);
  }
  
  const splinePoints = [];
  const curvatures = [];
  movementState.keyNodeProgress = [];
  
  for (let i = 0; i < keyNodes.length - 1; i++) {
    const startKey = keyNodes[i];
    const endKey = keyNodes[i + 1];
    
    const startIdx = findClosestNodeIndex(startKey, allNodes);
    const endIdx = findClosestNodeIndex(endKey, allNodes);
    
    if (i === 0) {
      movementState.keyNodeProgress.push(splinePoints.length);
    }
    
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
          curvatures.push(0.1); // Simplified curvature
        }
      }
    } else {
      // Linear interpolation
      for (let t = 0; t <= SPLINE_SEGMENTS; t++) {
        const tNorm = t / SPLINE_SEGMENTS;
        splinePoints.push({
          x: startKey.x + (endKey.x - startKey.x) * tNorm,
          y: startKey.y + (endKey.y - startKey.y) * tNorm,
          z: startKey.z + (endKey.z - startKey.z) * tNorm
        });
        curvatures.push(0.1);
      }
    }
    
    movementState.keyNodeProgress.push(splinePoints.length - 1);
  }
  
  splinePoints.push(keyNodes[keyNodes.length - 1]);
  curvatures.push(0);
  
  movementState.pathCurvatures = curvatures;
  movementState.splineLength = splinePoints.length;
  
  return splinePoints;
}

// Catmull-Rom spline interpolation
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

// Path simplification
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
  }
  
  return [points[0], points[points.length - 1]];
}

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

function stopPathingMovement() {
  movementState.isWalking = false;
  movementState.visitedKeyNodes.clear();
  movementState.purePursuitProgress = 0;
  movementState.lastValidProgress = 0;
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.jumpHeld = false;
  movementState.targetPoint = null;
  movementState.jumpCooldown = 0;
  movementState.jumpReleaseTimer = 0;
  
  try {
    mc.options.forwardKey.setPressed(false);
    mc.options.jumpKey.setPressed(false);
    mc.options.sprintKey.setPressed(false);
  } catch (e) {}
  
  Rotations.stopRotation();
}

function startPathingFromNodes(nodes) {
  if (!nodes || nodes.length === 0) return;

  movementState.splinePath = generateKeyNodeSpline(keyNodes, nodes);
  movementState.visitedKeyNodes.clear();

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  
  let bestProgress = 0;
  let bestDist = Infinity;
  
  for (let i = 0; i < movementState.splinePath.length - 1; i++) {
    const p1 = movementState.splinePath[i];
    const dist = getDistance3D(playerPos, p1);
    if (dist < bestDist) {
      bestDist = dist;
      bestProgress = i;
    }
  }
  
  movementState.purePursuitProgress = bestProgress;
  movementState.lastValidProgress = bestProgress;
  movementState.isWalking = true;
  movementState.lastPosition = { ...playerPos };
  movementState.stuckTimer = 0;
  movementState.currentYaw = Player.getYaw();
  movementState.currentPitch = Player.getPitch();
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.jumpHeld = false;
  movementState.lastUpdateTime = Date.now();
  movementState.jumpCooldown = 0;
  movementState.jumpReleaseTimer = 0;

  ChatLib.chat(`&aStarting path from progress ${movementState.purePursuitProgress.toFixed(1)}/${movementState.splinePath.length}`);
}

function updatePath() {
  if (!movementState.splinePath || movementState.splinePath.length === 0) {
    stopPathingMovement();
    return;
  }
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const onGround = Player.getPlayer()?.field_70122_E;
  const isSprinting = Player.getPlayer()?.isSprinting();
  
  movementState.isFalling = !onGround;
  
  // Check if reached end
  const finalNode = movementState.splinePath[movementState.splinePath.length - 1];
  const distToEnd = getDistance3D(playerPos, finalNode);
  
  if (distToEnd < END_REACH_DISTANCE || movementState.purePursuitProgress >= movementState.splinePath.length - 1) {
    ChatLib.chat("&aReached destination!");
    stopPathingMovement();
    return;
  }
  
  const newProgress = getClosestProgressForward(
    playerPos, 
    movementState.splinePath, 
    movementState.lastValidProgress
  );
  
  // Only update if moving forward
  if (newProgress > movementState.purePursuitProgress) {
    movementState.purePursuitProgress = newProgress;
    movementState.lastValidProgress = newProgress;
  }
  
  // Check visited key nodes
  for (let i = 0; i < movementState.keyNodeProgress.length; i++) {
    if (movementState.purePursuitProgress >= movementState.keyNodeProgress[i]) {
      movementState.visitedKeyNodes.add(i);
    }
  }
  
  const lookaheadDist = isSprinting ? PURE_PURSUIT_LOOKAHEAD_SPRINT : PURE_PURSUIT_LOOKAHEAD_BASE;
  const pursuitTarget = purePursuitFindTarget(
    playerPos,
    movementState.splinePath,
    movementState.purePursuitProgress,
    lookaheadDist
  );
  
  movementState.targetPoint = pursuitTarget.point;
}

let lastStuckCheck = Date.now();
let lastBlockPos = null;

register('tick', () => {
  if (!movementState.isWalking) return;
  
  const now = Date.now();
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  
  // Update jump timers
  if (movementState.jumpCooldown > 0) {
    movementState.jumpCooldown--;
  }
  
  if (movementState.jumpReleaseTimer > 0) {
    movementState.jumpReleaseTimer--;
    if (movementState.jumpReleaseTimer === 0 && movementState.jumpHeld) {
      mc.options.jumpKey.setPressed(false);
      movementState.jumpHeld = false;
    }
  }
  
  // Stuck detection
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
        ChatLib.chat("&cStuck detected, jumping...");
        
        if (!movementState.jumpHeld && movementState.jumpCooldown === 0) {
          mc.options.jumpKey.setPressed(true);
          movementState.jumpHeld = true;
          movementState.jumpReleaseTimer = JUMP_PRESS_DURATION;
          movementState.jumpCooldown = JUMP_COOLDOWN;
        }
        
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
      
      if (onGround && !movementState.jumpHeld && movementState.jumpCooldown === 0 && movementState.targetPoint) {
        if (shouldJump(playerPos, movementState.targetPoint)) {
          mc.options.jumpKey.setPressed(true);
          movementState.jumpHeld = true;
          movementState.jumpReleaseTimer = JUMP_PRESS_DURATION;
          movementState.jumpCooldown = JUMP_COOLDOWN;
        }
      }
    }
  } catch (e) {
    console.log("Movement key error:", e);
  }
});

register('renderWorld', () => {
  if (movementState.isWalking && movementState.targetPoint) {
    const playerPos = { 
      x: Player.getX(), 
      y: Player.getY(), 
      z: Player.getZ() 
    };
    
    const newRotation = calculateHumanizedRotation(
      movementState.currentYaw,
      movementState.currentPitch,
      movementState.targetPoint,
      playerPos,
      movementState.isFalling
    );
    
    movementState.currentYaw = newRotation.yaw;
    movementState.currentPitch = newRotation.pitch;
    
    // Normalize yaw
    while (movementState.currentYaw > 180) movementState.currentYaw -= 360;
    while (movementState.currentYaw < -180) movementState.currentYaw += 360;
    
    Rotations.rotateToAngles(movementState.currentYaw, movementState.currentPitch);
  }
  
  movementState.lastUpdateTime = Date.now();

  // Render key nodes
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

  // Render current target
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
  
  // Debug: render current progress point
  if (movementState.isWalking && movementState.splinePath.length > 0) {
    const progressPoint = getProgressPoint(movementState.purePursuitProgress, movementState.splinePath);
    if (progressPoint) {
      RendererMain.drawWaypoint(
        new Vec3i(
          Math.floor(progressPoint.x),
          Math.floor(progressPoint.y),
          Math.floor(progressPoint.z)
        ),
        true,
        new Color(0.0, 1.0, 1.0, 1.0)
      );
    }
  }
});

function loadMap(map) {
  const url = `http://localhost:3000/api/loadmap?map=${map}`;
  request({
      url: url,
      timeout: 5000, 
  }).then(() => {
      ChatLib.chat(`&6[Pathfinder] &aSuccessfully preloaded map '${map}'.`);
  }).catch(err => {
      console.log(`Failed to preload map '${map}': ${err}`);
      ChatLib.chat(`&6[Pathfinder] &cError preloading map '${map}'. See console for details.`);
  });
}

function runProgram() {
  if (!FileLib.exists(path)) {
    console.log("Pathfinding.exe not found. Pathfinding will not work.");
    ChatLib.chat("&cPathfinding.exe not found. Pathfinding will not work.");
    return;
  }
  stopProgram();
  keepAlive.register();

  console.log("Starting Pathfinder.exe...");

  const JavaProcessBuilder = java.lang.ProcessBuilder;
  const JavaScanner = java.util.Scanner;
  const JavaThread = java.lang.Thread;

  new JavaThread(() => {
    try {
      process = new JavaProcessBuilder(path).start();
      const sc = new JavaScanner(process.getInputStream());
      console.log("Process started");

      while (process !== null && process.isAlive()) {
        JavaThread.sleep(50);
        while (sc.hasNextLine()) {
          console.log(sc.nextLine());
        }
      }

      if (process !== null) process.waitFor();
      console.log("Process finished.");
    } catch (e) {
      console.log(`Error running pathfinder process: ${e}`);
      process = null; 
    }
  }).start();

  let attempts = 0;
  const maxAttempts = 10; 

  const poller = register('tick', () => {
    if (process !== null && !process.isAlive()) {
      console.log("Process terminated prematurely.");
      ChatLib.chat("&cPathfinder stopped unexpectedly.");
      poller.unregister();
      stopProgram();
      return;
    }

    if (attempts >= maxAttempts) {
      console.log("Server failed to respond in time.");
      ChatLib.chat("&cPathfinder failed to start");
      poller.unregister();
      stopProgram(); 
      return;
    }

    attempts++;
    console.log(`Pinging server (Attempt ${attempts}/${maxAttempts})`);

    request({ url: "http://localhost:3000/keepalive", timeout: 500 })
      .then(() => {
        console.log("Server is connected.");
        poller.unregister();
        loadMap("mines");
      })
      .catch(() => {});
  });
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