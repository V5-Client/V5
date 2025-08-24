import { Vector3 } from "./Vector3";

export const raytraceBlocks = (
  startPos = null,
  directionVector = null,
  distance = 60,
  blockCheckFunc = null,
  returnWhenTrue = false,
  stopWhenNotAir = true
) => {
  if (!startPos) startPos = getPlayerEyeCoords();
  if (!directionVector) directionVector = getPlayerLookVec();

  const endPos = directionVector
    .normalize()
    .multiply(distance)
    .add(new Vector3(...startPos)) // Use new Vector3 for addition
    .getComponents();

  return traverseVoxels(
    startPos,
    endPos,
    blockCheckFunc,
    returnWhenTrue,
    stopWhenNotAir
  );
};

export const getPlayerEyeCoords = (forceSneak = false) => {
  let x = Player.getX();
  let y = Player.getY() + Player.getPlayer().getEyeHeight();
  let z = Player.getZ();

  if (forceSneak && !Player.isSneaking()) y -= 0.08;
  return [x, y, z];
};

export const getPlayerLookVec = () => {
  let lookVec = Player.getPlayer().getRotationVector();
  return new Vector3(lookVec.x, lookVec.y, lookVec.z);
};

export const traverseVoxels = (
  start,
  end,
  blockCheckFunc = null,
  returnWhenTrue = false,
  stopWhenNotAir = false,
  returnIntersection = false
) => {
  const direction = end.map((v, i) => v - start[i]);
  const step = direction.map((a) => Math.sign(a));

  // Handle division by zero for axis-aligned rays
  const tDelta = direction.map(d => d === 0 ? Number.MAX_VALUE : Math.abs(1 / d));

  const tMax = tDelta.map((td, i) => {
    if (td === Number.MAX_VALUE) return Number.MAX_VALUE;
    const startCoord = start[i];
    const stepDir = step[i];
    const currentVoxel = Math.floor(startCoord);
    // Distance to the next voxel boundary
    const distToBoundary = stepDir > 0 ? (currentVoxel + 1 - startCoord) : (startCoord - currentVoxel);
    return distToBoundary * td;
  });

  let currentPos = start.map((a) => Math.floor(a));
  const endPos = end.map((a) => Math.floor(a));
  let intersectionPoint = [...start];

  const path = [];
  let iters = 0;
  // Safety break to prevent infinite loops
  while (iters < 1000) {
    iters++;

    // Do block check function stuff
    const currentBlock = World.getBlockAt(...currentPos);
    if (blockCheckFunc && blockCheckFunc(currentBlock)) {
      if (returnWhenTrue) {
        if (returnIntersection) return { hit: currentPos, intersection: intersectionPoint };
        return currentPos;
      }
      break;
    }

    if (stopWhenNotAir && currentBlock.type.getID() !== 0) {
      // The `intersectionPoint` was already calculated for the entry into this block.
      if (returnIntersection) return { hit: currentPos, intersection: intersectionPoint };
      break; // Stop but return path
    }

    path.push([...currentPos]);

    if (currentPos.every((v, i) => v === endPos[i])) break;

    const minIndex = tMax.indexOf(Math.min(...tMax));
    
    // Calculate intersection point before advancing tMax.
    // This gives the point where the ray entered the current block.
    if (returnIntersection) {
        intersectionPoint = start.map((v, i) => v + tMax[minIndex] * direction[i]);
    }

    tMax[minIndex] += tDelta[minIndex];
    currentPos[minIndex] += step[minIndex];
  }

  if (returnWhenTrue) return null;
  // If we stopped due to a non-air block, the last block in the path is the one we want.
  // Otherwise, return the full path.
  if (stopWhenNotAir) {
      const lastBlock = World.getBlockAt(...currentPos);
      if (lastBlock.type.getID() !== 0) {
          if (returnWhenTrue) return returnIntersection ? { hit: currentPos, intersection: intersectionPoint } : currentPos;
          return [currentPos];
      }
  }

  return path;
};