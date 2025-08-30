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
  rawToSpline: [],
  lastPosition: null,
  stuckTimer: 0,
  isFalling: false,
  fallStartY: 0,
  lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
  rotationSmoothing: 0.15, // Smoothing factor for rotations
  lookAheadDistance: 5.0, // Pure pursuit look-ahead distance (base)
  visitedNodes: new Set(),
  movementHeld: false,
  targetPoint: null,
  sprintHeld: false,

  // Walkability + autojump
  predictedJump: null, // { type: 'step'|'edge', at: {x,y,z}, lead: number }
  lastJumpTick: 0,
  jumpCooldownTicks: 8,
  avoidCostThreshold: 8
};

// Constants
const STUCK_THRESHOLD = 60;
const NODE_REACH_DISTANCE = 3.0; // How close to a node to consider it "reached"
const NODE_REACH_DISTANCE_SPRINT = 4.5; // more lenient when sprinting
const SPLINE_RESOLUTION = 4; // Points between each key node for spline (higher = smoother)
const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

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

// Catmull-Rom spline interpolation
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
  };
}

function generateSplinePathFromKeyNodes(kNodes) {
  if (!kNodes || kNodes.length < 2) return kNodes || [];
  const nodes = kNodes;
  const splinePath = [];

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
  splinePath.push(nodes[nodes.length - 1]); // exact last point
  return splinePath;
}

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

function smoothRotation(currentYaw, currentPitch, targetYaw, targetPitch, smoothing) {
  let yawDiff = targetYaw - currentYaw;
  while (yawDiff > 180) yawDiff -= 360;
  while (yawDiff < -180) yawDiff += 360;

  const smoothedYaw = currentYaw + yawDiff * smoothing;
  const smoothedPitch = currentPitch + (targetPitch - currentPitch) * smoothing;

  return { yaw: smoothedYaw, pitch: smoothedPitch };
}

function getBlockAt(x, y, z) {
  try {
    return World.getBlockAt(x, y, z);
  } catch (e) {
    return null;
  }
}

function getBlockTypeName(block) {
  try {
    if (!block || !block.type) return "";
    // Try a few ways to get a consistent name string
    const t = block.type;
    if (t.getRegistryName) return String(t.getRegistryName());
    if (t.getName) return String(t.getName()).toLowerCase();
    if (t.getUnlocalizedName) return String(t.getUnlocalizedName()).toLowerCase();
    return String(t).toLowerCase();
  } catch (e) {
    return "";
  }
}

function isTranslucent(block) {
  try {
    return !!(block && block.type && block.type.isTranslucent && block.type.isTranslucent());
  } catch (e) {
    return false;
  }
}

function isProbablySolid(block) {
  if (!block || !block.type) return false;
  const name = getBlockTypeName(block);
  if (name.includes("air")) return false;
  if (name.includes("water") || name.includes("lava")) return false; // liquids treated as non-solid but penalized
  // non-translucent OR explicitly solid
  try {
    if (block.type.isSolid && block.type.isSolid()) return true;
  } catch (e) {}
  return !isTranslucent(block);
}

function isPassable(block) {
  if (!block || !block.type) return true;
  const name = getBlockTypeName(block);
  if (name.includes("air")) return true;
  if (name.includes("water") || name.includes("lava") || name.includes("web")) return false; // prefer to avoid
  // Leaves are translucent; treat as non-passable to avoid headbonks
  if (name.includes("leaves")) return false;
  if (name.includes("slab") || name.includes("stairs")) {
    // We treat slabs/stairs as solid for collision, but jumpable
    return false;
  }
  return isTranslucent(block);
}

function blockPenalty(block) {
  const name = getBlockTypeName(block);
  if (name.includes("web")) return 100; // avoid completely
  if (name.includes("water")) return 8;  // avoid water
  if (name.includes("lava")) return 200; // never
  if (name.includes("soul_sand")) return 5;
  if (name.includes("ice")) return 2;
  return 0;
}

// Check if any part of player box at [x,z] and vertical extent [y, y+PLAYER_HEIGHT] collides with solids
function collidesAt(x, y, z) {
  // sample center + 4 corners of the player AABB at this location
  const samples = [
    [0, 0], // center
    [PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH],
    [PLAYER_HALF_WIDTH, -PLAYER_HALF_WIDTH],
    [-PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH],
    [-PLAYER_HALF_WIDTH, -PLAYER_HALF_WIDTH]
  ];
  for (const [ox, oz] of samples) {
    // sample at multiple vertical points: feet, mid, head
    const sx = Math.floor(x + ox);
    const sz = Math.floor(z + oz);
    const y0 = Math.floor(y);
    const y1 = Math.floor(y + 0.9);
    const y2 = Math.floor(y + PLAYER_HEIGHT - 0.05);
    const b0 = getBlockAt(sx, y0, sz);
    const b1 = getBlockAt(sx, y1, sz);
    const b2 = getBlockAt(sx, y2, sz);
    if (isProbablySolid(b0) || isProbablySolid(b1) || isProbablySolid(b2)) return true;
  }
  return false;
}

// Find surface Y around a hint by scanning down/up a bit
function getSurfaceYNear(x, z, hintY) {
  const fx = Math.floor(x), fz = Math.floor(z);
  let y = Math.floor(hintY);
  // Try to land player at first passable space above solid ground.
  // Scan downward a bit to find solid below
  for (let d = 0; d <= 3; d++) {
    const yBelow = y - d - 1;
    if (yBelow < 0) break;
    const ground = getBlockAt(fx, yBelow, fz);
    const feet = getBlockAt(fx, y - d, fz);
    const head = getBlockAt(fx, y - d + 1, fz);
    if (isProbablySolid(ground) && isPassable(feet) && isPassable(head)) {
      return y - d;
    }
  }
  for (let u = 1; u <= 3; u++) {
    const yFeet = y + u;
    const ground = getBlockAt(fx, yFeet - 1, fz);
    const feet = getBlockAt(fx, yFeet, fz);
    const head = getBlockAt(fx, yFeet + 1, fz);
    if (isProbablySolid(ground) && isPassable(feet) && isPassable(head)) {
      return yFeet;
    }
  }
  for (let d = 0; d < 5; d++) {
    const candidateGroundY = y - d - 1;
    const ground = getBlockAt(fx, candidateGroundY, fz);
    if (isProbablySolid(ground)) return candidateGroundY + 1;
  }
  return y; // as a last resort
}

function bresenhamLineXZ(x0, z0, x1, z1) {
  let x = Math.floor(x0), z = Math.floor(z0);
  const xEnd = Math.floor(x1), zEnd = Math.floor(z1);

  const dx = Math.abs(xEnd - x);
  const dz = Math.abs(zEnd - z);
  const sx = x < xEnd ? 1 : -1;
  const sz = z < zEnd ? 1 : -1;
  let err = (dx > dz ? dx : -dz) / 2;

  const cells = [];
  while (true) {
    cells.push([x, z]);
    if (x === xEnd && z === zEnd) break;
    const e2 = err;
    if (e2 > -dx) { err -= dz; x += sx; }
    if (e2 < dz)  { err += dx; z += sz; }
  }
  return cells;
}

function isWalkableSegment(from, to, options = {}) {
  const yHint = options.yHint ?? from.y;
  const allowStepUp = options.allowStepUp !== false;
  const allowEdgeJump = options.allowEdgeJump !== false;

  const cells = bresenhamLineXZ(from.x, from.z, to.x, to.z);
  if (!cells.length) {
    return { walkable: true, cost: 0, jump: null };
  }

  let totalCost = 0;
  let prevY = getSurfaceYNear(cells[0][0] + 0.5, cells[0][1] + 0.5, yHint);
  let predictedJump = null;
  let accumulatedHoriz = 0;

  const horizTotal = getDistance2D(from, to);
  const stepLen = horizTotal / Math.max(1, cells.length - 1);

  for (let i = 0; i < cells.length; i++) {
    const [cx, cz] = cells[i];
    const worldX = cx + 0.5;
    const worldZ = cz + 0.5;

    // Project along path for horizontal distance traveled so far
    if (i > 0) accumulatedHoriz += stepLen;

    const ySurface = getSurfaceYNear(worldX, worldZ, prevY);

    const blockedHere = collidesAt(worldX, ySurface, worldZ);

    const feetBlock = getBlockAt(Math.floor(worldX), Math.floor(ySurface), Math.floor(worldZ));
    totalCost += blockPenalty(feetBlock);

    if (blockedHere) {
      if (allowStepUp) {
        const stepUpY = ySurface + 1;
        const headClear = !collidesAt(worldX, stepUpY, worldZ);
        if (headClear) {
          if (!predictedJump) {
            predictedJump = {
              type: 'step',
              at: { x: worldX, y: ySurface, z: worldZ },
              lead: 0.45 
            };
          }
          prevY = stepUpY;
          continue; 
        }
      }
      return {
        walkable: false,
        reason: 'blocked',
        cost: totalCost,
        jump: predictedJump
      };
    }

    // Check vertical changes between steps to predict edge jumps
    const dy = ySurface - prevY;

    if (dy > 0.51 && dy < 1.26 && allowStepUp && !predictedJump) {
      predictedJump = {
        type: 'step',
        at: { x: worldX, y: ySurface - dy, z: worldZ },
        lead: 0.40
      };
    }

    if (allowEdgeJump && i < cells.length - 1) {
      const [nx, nz] = cells[i + 1];
      const nxw = nx + 0.5, nzw = nz + 0.5;
      const yNext = getSurfaceYNear(nxw, nzw, ySurface);
      const drop = yNext - ySurface; // negative for drop
      if (drop <= -1.01 && !predictedJump) {
        predictedJump = {
          type: 'edge',
          at: { x: worldX, y: ySurface, z: worldZ }, // jump at the edge
          lead: 0.30 // jump right before the edge
        };
      }
    }

    // Penalize variance in Y to prefer smoother ground
    totalCost += Math.abs(dy) * 0.5;

    prevY = ySurface;
  }

  return { walkable: true, cost: totalCost, jump: predictedJump };
}

function stopPathingMovement() {
  movementState.isWalking = false;
  movementState.visitedNodes.clear();
  movementState.currentNodeIndex = 0;
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.targetPoint = null;
  movementState.predictedJump = null;

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

// Start pathing by building a spline from KEY NODES and following only the spline.
function startPathingFromKeyNodes(kNodes, rawNodesForRender = []) {
  if (!kNodes || kNodes.length === 0) return;

  movementState.splinePath = generateSplinePathFromKeyNodes(kNodes);
  movementState.visitedNodes.clear();

  // Map raw nodes -> closest spline index (for rendering grey/green)
  movementState.rawToSpline = (rawNodesForRender || []).map(n =>
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
  movementState.predictedJump = null;

  ChatLib.chat(`&aStarting spline path from key nodes at index ${movementState.currentNodeIndex}/${movementState.splinePath.length}`);
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

  // End check
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

  // Progress current node index along spline
  while (movementState.currentNodeIndex < movementState.splinePath.length - 1) {
    const currentNode = movementState.splinePath[movementState.currentNodeIndex];
    const nextNode = movementState.splinePath[Math.min(movementState.currentNodeIndex + 1, movementState.splinePath.length - 1)];

    let distanceToNode;
    if (movementState.isFalling) {
      distanceToNode = getDistance2D(playerPos, currentNode);
    } else {
      distanceToNode = getDistance3D(playerPos, currentNode);
    }

    const distToNext = getDistance3D(playerPos, nextNode);
    const distCurrentToNext = getDistance3D(currentNode, nextNode);

    if (distanceToNode < reachDistance || (distToNext < distCurrentToNext && distanceToNode < reachDistance * 1.5)) {
      movementState.visitedNodes.add(movementState.currentNodeIndex);
      movementState.currentNodeIndex++;
    } else {
      break;
    }
  }

  const baseLA = movementState.lookAheadDistance;
  const lookAheadDist = movementState.isFalling
    ? baseLA * 1.5
    : (isSprinting ? baseLA * 0.7 : baseLA);

  // Walk along spline from current index and seek lookahead target
  let targetPoint = null;
  let accumulatedDist = 0;
  for (let i = movementState.currentNodeIndex; i < movementState.splinePath.length - 1; i++) {
    const node = movementState.splinePath[i];
    const nextNode = movementState.splinePath[i + 1];
    const segmentDist = getDistance3D(node, nextNode);

    if (accumulatedDist + segmentDist >= lookAheadDist) {
      const t = clamp((lookAheadDist - accumulatedDist) / segmentDist, 0, 1);
      targetPoint = {
        x: node.x + (nextNode.x - node.x) * t,
        y: node.y + (nextNode.y - node.y) * t,
        z: node.z + (nextNode.z - node.z) * t
      };
      break;
    }
    accumulatedDist += segmentDist;
  }
  if (!targetPoint) targetPoint = movementState.splinePath[movementState.splinePath.length - 1];

  // If obstruction or too costly, shorten lookahead until walkable segment is found.
  let evalResult = isWalkableSegment(playerPos, targetPoint, {
    yHint: playerPos.y,
    allowStepUp: true,
    allowEdgeJump: true
  });

  let attempts = 0;
  let laFactor = 0.75;
  while ((!evalResult.walkable || evalResult.cost > movementState.avoidCostThreshold) && attempts < 4) {
    attempts++;
    const shorterLA = lookAheadDist * Math.pow(laFactor, attempts);
    accumulatedDist = 0;
    targetPoint = null;
    for (let i = movementState.currentNodeIndex; i < movementState.splinePath.length - 1; i++) {
      const node = movementState.splinePath[i];
      const nextNode = movementState.splinePath[i + 1];
      const segmentDist = getDistance3D(node, nextNode);

      if (accumulatedDist + segmentDist >= shorterLA) {
        const t = clamp((shorterLA - accumulatedDist) / segmentDist, 0, 1);
        targetPoint = {
          x: node.x + (nextNode.x - node.x) * t,
          y: node.y + (nextNode.y - node.y) * t,
          z: node.z + (nextNode.z - node.z) * t
        };
        break;
      }
      accumulatedDist += segmentDist;
    }
    if (!targetPoint) targetPoint = movementState.splinePath[Math.min(movementState.currentNodeIndex + 1, movementState.splinePath.length - 1)];
    evalResult = isWalkableSegment(playerPos, targetPoint, { yHint: playerPos.y, allowStepUp: true, allowEdgeJump: true });
  }

  movementState.targetPoint = targetPoint;
  movementState.predictedJump = evalResult?.jump || null;
}

function updateRotations() {
  if (!movementState.isWalking || !movementState.targetPoint) return;
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const isSprinting = Player.getPlayer()?.isSprinting();
  const onGround = Player.getPlayer()?.field_70122_E;

  let dx = movementState.targetPoint.x - playerPos.x;
  let dy = movementState.targetPoint.y - playerPos.y;
  let dz = movementState.targetPoint.z - playerPos.z;

  // When falling, reduce vertical rotations
  if (movementState.isFalling) {
    dy *= 0.3;
  } else {
    // If there's a drop ahead and we're still on ground, largely ignore vertical change
    const dropAhead = playerPos.y - movementState.targetPoint.y;
    if (dropAhead > 0.6) {
      dy *= 0.1; // keep head almost level until we actually fall
    }
  }

  const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const dist2D = Math.sqrt(dx * dx + dz * dz);
  let targetPitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);

  // Clamp pitch to reasonable values
  targetPitch = Math.max(-45, Math.min(45, targetPitch));

  // don't look down much while still on ground (feels more human)
  if (onGround && targetPitch < -8) {
    targetPitch = -8;
  }

  const smoothingFactor = movementState.isFalling
    ? movementState.rotationSmoothing * 0.5
    : (isSprinting ? movementState.rotationSmoothing * 1.5 : movementState.rotationSmoothing);

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

function handleAutoJump(playerPos) {
  if (!movementState.predictedJump) return;
  const onGround = Player.getPlayer()?.field_70122_E;
  if (!onGround || movementState.isFalling) return;

  // Cooldown to avoid spam
  const tickNow = World.getTime();
  if (tickNow - movementState.lastJumpTick < movementState.jumpCooldownTicks) return;

  const jumpAt = movementState.predictedJump.at;
  const distH = getDistance2D(playerPos, jumpAt);
  const isSprinting = Player.getPlayer()?.isSprinting();
  // Lead distance: ensure jump is triggered slightly before reaching obstacle/edge
  const lead = movementState.predictedJump.lead + (isSprinting ? 0.10 : 0.0);

  if (distH <= Math.max(0.2, lead + 0.1)) {
    try {
      mc.options.jumpKey.setPressed(true);
      movementState.lastJumpTick = tickNow;
      // Release after 2 ticks
      Client.scheduleTask(2, () => {
        try { mc.options.jumpKey.setPressed(false); } catch (e) {}
      });
    } catch (e) {}
    // Consume this prediction so we don't re-trigger
    movementState.predictedJump = null;
  }
}

register('tick', () => {
  if (!movementState.isWalking) return;

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const currentBlockPos = {
    x: Math.floor(playerPos.x),
    y: Math.floor(playerPos.y),
    z: Math.floor(playerPos.z)
  };

  if (
    movementState.lastPosition &&
    currentBlockPos.x === Math.floor(movementState.lastPosition.x) &&
    currentBlockPos.y === Math.floor(movementState.lastPosition.y) &&
    currentBlockPos.z === Math.floor(movementState.lastPosition.z) &&
    !movementState.isFalling
  ) {
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

      if (!movementState.sprintHeld) {
        mc.options.sprintKey.setPressed(true); 
        movementState.sprintHeld = true;
      }

      handleAutoJump(playerPos);
    }
  } catch (e) {
    console.log("Movement key error:", e);
  }
});

register('renderWorld', () => {
  if (movementState.isWalking) {
    updateRotations();
  }

  // Draw raw path nodes (grey when "passed", green otherwise)
  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const splineIndexForThisNode = movementState.rawToSpline?.[i] ?? 0;
    const isVisited = splineIndexForThisNode < movementState.currentNodeIndex;

    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      false,
      isVisited
        ? new Color(0.5, 0.5, 0.5, 0.3)
        : new Color(0.0, 1.0, 0.0, 0.8)
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

  // Draw current target point on the spline (yellow)
  if (movementState.isWalking && movementState.currentNodeIndex < movementState.splinePath.length) {
    const currentTarget = movementState.targetPoint || movementState.splinePath[movementState.currentNodeIndex];
    RendererMain.drawWaypoint(
      new Vec3i(Math.floor(currentTarget.x), Math.floor(currentTarget.y), Math.floor(currentTarget.z)),
      true,
      new Color(1.0, 1.0, 0.0, 1.0)
    );
  }

  // draw predicted jump point (cyan)
  if (movementState.predictedJump) {
    const p = movementState.predictedJump.at;
    RendererMain.drawWaypoint(
      new Vec3i(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)),
      true,
      new Color(0.0, 1.0, 1.0, 0.9)
    );
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

const Runtime = java.lang.Runtime;
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

      // Follow spline built ONLY from key nodes (fallback to nodes if key nodes missing)
      const splineKeys = (keyNodes.length > 1) ? keyNodes : pathNodes;
      startPathingFromKeyNodes(splineKeys, pathNodes);

      ChatLib.chat(
        `§aPath found with ${pathNodes.length} nodes and ${keyNodes.length} key nodes. Following spline from key nodes.`
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