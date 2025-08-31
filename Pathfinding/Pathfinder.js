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
  rotationSmoothing: 0.15,
  lookAheadDistance: 5.0,
  visitedNodes: new Set(),
  movementHeld: false,
  targetPoint: null,
  sprintHeld: false,

  lastJumpTick: 0,
  jumpCooldownTicks: 8,
  avoidCostThreshold: 8,
  
  groundedTicks: 0,
  recentlyJumped: false,
  
  isClimbingStairs: false,
  stairEndPoint: null,
  stairStartY: 0,
};

// Constants
const STUCK_THRESHOLD = 60;
const NODE_REACH_DISTANCE = 3.0;
const NODE_REACH_DISTANCE_SPRINT = 4.5;
const SPLINE_RESOLUTION = 4;
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
  splinePath.push(nodes[nodes.length - 1]);
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
  if (name.includes("water") || name.includes("lava")) return false;
  try {
    if (block.type.isSolid && block.type.isSolid()) return true;
  } catch (e) {}
  return !isTranslucent(block);
}

function isPassable(block) {
  if (!block || !block.type) return true;
  const name = getBlockTypeName(block);
  if (name.includes("air")) return true;
  if (name.includes("water") || name.includes("lava") || name.includes("web")) return false;
  if (name.includes("leaves")) return false;
  if (name.includes("slab") || name.includes("stairs")) {
    return false;
  }
  return isTranslucent(block);
}

function blockPenalty(block) {
  const name = getBlockTypeName(block);
  if (name.includes("web")) return 100;
  if (name.includes("water")) return 8;
  if (name.includes("lava")) return 200;
  if (name.includes("soul_sand")) return 5;
  if (name.includes("ice")) return 2;
  return 0;
}

function collidesAt(x, y, z) {
  const samples = [
    [0, 0],
    [PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH],
    [PLAYER_HALF_WIDTH, -PLAYER_HALF_WIDTH],
    [-PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH],
    [-PLAYER_HALF_WIDTH, -PLAYER_HALF_WIDTH]
  ];
  for (const [ox, oz] of samples) {
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

function getSurfaceYNear(x, z, hintY) {
  const fx = Math.floor(x), fz = Math.floor(z);
  let y = Math.floor(hintY);
  
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
  return y;
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
    return { walkable: true, cost: 0 };
  }

  let totalCost = 0;
  let prevY = getSurfaceYNear(cells[0][0] + 0.5, cells[0][1] + 0.5, yHint);

  for (let i = 0; i < cells.length; i++) {
    const [cx, cz] = cells[i];
    const worldX = cx + 0.5;
    const worldZ = cz + 0.5;

    const ySurface = getSurfaceYNear(worldX, worldZ, prevY);
    const blockedHere = collidesAt(worldX, ySurface, worldZ);

    const feetBlock = getBlockAt(Math.floor(worldX), Math.floor(ySurface), Math.floor(worldZ));
    totalCost += blockPenalty(feetBlock);

    if (blockedHere) {
      if (allowStepUp) {
        const stepUpY = ySurface + 1;
        const headClear = !collidesAt(worldX, stepUpY, worldZ);
        if (headClear) {
          prevY = stepUpY;
          continue; 
        }
      }
      return {
        walkable: false,
        reason: 'blocked',
        cost: totalCost
      };
    }

    const dy = ySurface - prevY;
    totalCost += Math.abs(dy) * 0.5;
    prevY = ySurface;
  }

  return { walkable: true, cost: totalCost };
}

function detectStairLine(playerPos) {
  const playerYaw = Player.getYaw() * Math.PI / 180;
  const lookDir = { x: Math.sin(playerYaw), z: Math.cos(playerYaw) };
  
  const checkX = playerPos.x + lookDir.x * 1.0;
  const checkZ = playerPos.z + lookDir.z * 1.0;
  
  const blockAhead = getBlockAt(
    Math.floor(checkX),
    Math.floor(playerPos.y),
    Math.floor(checkZ)
  );
  
  const blockName = getBlockTypeName(blockAhead);
  if (!blockName.includes("stair")) return null;
  
  let stairBlocks = [];
  let currentX = checkX;
  let currentZ = checkZ;
  let currentY = Math.floor(playerPos.y);
  let maxStairs = 20;
  
  for (let i = 0; i < maxStairs; i++) {
    const block = getBlockAt(
      Math.floor(currentX),
      currentY,
      Math.floor(currentZ)
    );
    
    const name = getBlockTypeName(block);
    
    if (name.includes("stair")) {
      stairBlocks.push({
        x: Math.floor(currentX),
        y: currentY,
        z: Math.floor(currentZ)
      });
      
      currentX += lookDir.x;
      currentZ += lookDir.z;
      
      const nextSame = getBlockAt(
        Math.floor(currentX),
        currentY,
        Math.floor(currentZ)
      );
      const nextUp = getBlockAt(
        Math.floor(currentX),
        currentY + 1,
        Math.floor(currentZ)
      );
      
      if (getBlockTypeName(nextUp).includes("stair")) {
        currentY += 1;
      } else if (!getBlockTypeName(nextSame).includes("stair")) {
        break;
      }
    } else {
      break;
    }
  }
  
  if (stairBlocks.length >= 2) {
    const lastStair = stairBlocks[stairBlocks.length - 1];
    return {
      start: stairBlocks[0],
      end: lastStair,
      length: stairBlocks.length,
      direction: lookDir,
      blocks: stairBlocks
    };
  }
  
  return null;
}

function detectJumpOpportunity(playerPos) {
  const player = Player.getPlayer();
  if (!player) return null;
  
  const playerYaw = Player.getYaw() * Math.PI / 180;
  
  let velocity, velocityZ;
  try {
    velocity = player.field_70159_w || player.motionX || 0;
    velocityZ = player.field_70179_y || player.motionZ || 0;
  } catch (e) {
    velocity = 0;
    velocityZ = 0;
  }
  
  const speed = Math.sqrt(velocity * velocity + velocityZ * velocityZ);
  const baseLookAhead = 0.7;
  const lookAhead = baseLookAhead + (speed * 2);
  
  const checkPoints = [
    { dist: 0.3, weight: 1.0 },
    { dist: 0.5, weight: 0.9 },
    { dist: lookAhead, weight: 0.7 }
  ];
  
  for (const check of checkPoints) {
    const checkX = playerPos.x + Math.sin(playerYaw) * check.dist;
    const checkZ = playerPos.z + Math.cos(playerYaw) * check.dist;
    
    const blocks = {
      feet: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y), Math.floor(checkZ)),
      knee: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y + 0.5), Math.floor(checkZ)),
      waist: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y + 1), Math.floor(checkZ)),
      head: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y + 1.5), Math.floor(checkZ)),
      above: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y + 2), Math.floor(checkZ)),
      ground: getBlockAt(Math.floor(checkX), Math.floor(playerPos.y - 1), Math.floor(checkZ))
    };
    
    const feetName = getBlockTypeName(blocks.feet);
    const kneeName = getBlockTypeName(blocks.knee);
    
    const feetSolid = isProbablySolid(blocks.feet);
    const kneeSolid = isProbablySolid(blocks.knee);
    const waistSolid = isProbablySolid(blocks.waist);
    const headClear = isPassable(blocks.head);
    const aboveClear = isPassable(blocks.above);
    
    const isPartialBlock = feetName.includes("slab") || feetName.includes("stair");
    
    if ((feetSolid || kneeSolid || isPartialBlock) && !waistSolid && headClear && aboveClear) {
      return { 
        type: 'step', 
        distance: check.dist, 
        confidence: check.weight,
        isPartial: isPartialBlock,
        blockName: feetSolid ? feetName : kneeName
      };
    }
    
    const groundAhead = blocks.ground;
    const groundSolid = isProbablySolid(groundAhead);
    
    if (!groundSolid && !feetSolid && headClear) {
      const farX = playerPos.x + Math.sin(playerYaw) * 2.5;
      const farZ = playerPos.z + Math.cos(playerYaw) * 2.5;
      
      let hasLanding = false;
      for (let yOff = -2; yOff <= 1; yOff++) {
        const farGround = getBlockAt(
          Math.floor(farX), 
          Math.floor(playerPos.y + yOff), 
          Math.floor(farZ)
        );
        if (isProbablySolid(farGround)) {
          hasLanding = true;
          break;
        }
      }
      
      if (hasLanding) {
        return { 
          type: 'gap', 
          distance: check.dist, 
          confidence: check.weight * 0.8 
        };
      } else if (speed > 0.15) {
        return { 
          type: 'edge', 
          distance: check.dist, 
          confidence: check.weight * 0.6 
        };
      }
    }
  }
  
  return null;
}

function executeJump(jumpOp) {
  if (!jumpOp) return false;
  
  const onGround = Player.getPlayer()?.field_70122_E;
  if (!onGround) return false;
  
  const isSprinting = Player.getPlayer()?.isSprinting();
  
  let threshold;
  if (jumpOp.type === 'step') {
    threshold = jumpOp.isPartial ? 0.5 : (isSprinting ? 0.6 : 0.45);
  } else if (jumpOp.type === 'gap') {
    threshold = isSprinting ? 0.8 : 0.65;
  } else {
    threshold = 0.5;
  }
  
  if (jumpOp.distance <= threshold) {
    try {
      mc.options.jumpKey.setPressed(true);
      movementState.lastJumpTick = World.getTime();
      movementState.recentlyJumped = true;
      
      const jumpDuration = jumpOp.type === 'gap' ? 4 : 3;
      
      Client.scheduleTask(jumpDuration, () => {
        try { 
          mc.options.jumpKey.setPressed(false);
          Client.scheduleTask(8, () => {
            movementState.recentlyJumped = false;
          });
        } catch (e) {}
      });
      
      return true;
    } catch (e) {}
  }
  
  return false;
}

function handleAutoJump(playerPos) {
  const player = Player.getPlayer();
  if (!player) return;
  
  let onGround = false;
  try {
    onGround = player.field_70122_E || player.onGround || false;
  } catch (e) {
    try {
      onGround = player.func_70090_H === false && player.field_70143_R === 0.0;
    } catch (e2) {}
  }
  
  if (!onGround) {
    movementState.groundedTicks = 0;
    return;
  }
  
  movementState.groundedTicks++;
  
  if (!movementState.isClimbingStairs) {
    const stairLine = detectStairLine(playerPos);
    if (stairLine && stairLine.length >= 3) {
      movementState.isClimbingStairs = true;
      movementState.stairEndPoint = stairLine.end;
      movementState.stairStartY = playerPos.y;
      ChatLib.chat(`&aClimbing ${stairLine.length} stairs`);
      return;
    }
  } else {
    const distToEnd = getDistance2D(playerPos, movementState.stairEndPoint);
    const climbed = playerPos.y - movementState.stairStartY;
    
    if (distToEnd < 1.5 || climbed > 10) {
      movementState.isClimbingStairs = false;
      movementState.stairEndPoint = null;
    } else {
      return;
    }
  }
  
  if (movementState.groundedTicks < 2) return;
  
  const tickNow = World.getTime();
  if (tickNow - movementState.lastJumpTick < movementState.jumpCooldownTicks) return;
  
  if (movementState.recentlyJumped) return;
  
  const jumpOp = detectJumpOpportunity(playerPos);
  if (jumpOp) {
    executeJump(jumpOp);
  }
}

function stopPathingMovement() {
  movementState.isWalking = false;
  movementState.visitedNodes.clear();
  movementState.currentNodeIndex = 0;
  movementState.movementHeld = false;
  movementState.sprintHeld = false;
  movementState.targetPoint = null;
  movementState.recentlyJumped = false;
  movementState.groundedTicks = 0;
  movementState.isClimbingStairs = false;
  movementState.stairEndPoint = null;

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

function startPathingFromKeyNodes(kNodes, rawNodesForRender = []) {
  if (!kNodes || kNodes.length === 0) return;

  movementState.splinePath = generateSplinePathFromKeyNodes(kNodes);
  movementState.visitedNodes.clear();

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
  movementState.recentlyJumped = false;
  movementState.groundedTicks = 0;
  movementState.isClimbingStairs = false;
  movementState.stairEndPoint = null;

  ChatLib.chat(`&aStarting spline path from key nodes at index ${movementState.currentNodeIndex}/${movementState.splinePath.length}`);
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
}

function updateRotations() {
  if (!movementState.isWalking || !movementState.targetPoint) return;
  
  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const isSprinting = Player.getPlayer()?.isSprinting();
  const onGround = Player.getPlayer()?.field_70122_E;

  let dx = movementState.targetPoint.x - playerPos.x;
  let dy = movementState.targetPoint.y - playerPos.y;
  let dz = movementState.targetPoint.z - playerPos.z;

  if (movementState.isFalling) {
    dy *= 0.3;
  } else {
    const dropAhead = playerPos.y - movementState.targetPoint.y;
    if (dropAhead > 0.6) {
      dy *= 0.1;
    }
  }

  const targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const dist2D = Math.sqrt(dx * dx + dz * dz);
  let targetPitch = -Math.atan2(dy, dist2D) * (180 / Math.PI);

  targetPitch = Math.max(-45, Math.min(45, targetPitch));

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

register('tick', () => {
  if (!movementState.isWalking) return;

  const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
  const currentBlockPos = {
    x: Math.floor(playerPos.x),
    y: Math.floor(playerPos.y),
    z: Math.floor(playerPos.z)
  };

  const hasVerticalMovement = movementState.lastPosition && 
    Math.abs(playerPos.y - movementState.lastPosition.y) > 0.1;

  if (
    movementState.lastPosition &&
    currentBlockPos.x === Math.floor(movementState.lastPosition.x) &&
    currentBlockPos.y === Math.floor(movementState.lastPosition.y) &&
    currentBlockPos.z === Math.floor(movementState.lastPosition.z) &&
    !movementState.isFalling &&
    !hasVerticalMovement
  ) {
    movementState.stuckTimer++;
    if (movementState.stuckTimer >= STUCK_THRESHOLD) {
      ChatLib.chat("&cStuck detected, attempting to unstuck...");
      try {
        mc.options.jumpKey.setPressed(true);
        mc.options.backKey.setPressed(true);
        Client.scheduleTask(5, () => {
          mc.options.jumpKey.setPressed(false);
          mc.options.backKey.setPressed(false);
          Client.scheduleTask(2, () => {
            mc.options.forwardKey.setPressed(true);
          });
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

  for (let node of keyNodes) {
    RendererMain.drawWaypoint(
      new Vec3i(node.x, node.y, node.z),
      true,
      new Color(1.0, 0.0, 0.0, 1.0)
    );
  }

  if (movementState.isWalking && movementState.currentNodeIndex < movementState.splinePath.length) {
    const currentTarget = movementState.targetPoint || movementState.splinePath[movementState.currentNodeIndex];
    RendererMain.drawWaypoint(
      new Vec3i(Math.floor(currentTarget.x), Math.floor(currentTarget.y), Math.floor(currentTarget.z)),
      true,
      new Color(1.0, 1.0, 0.0, 1.0)
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