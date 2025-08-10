import { Vector3 } from "./Vector3";

/**
 * Does a voxel traversal from the startPos (Or player eye coord by default) until it hits a non-air block.
 * @param {[Number, Number, Number] | null} startPos - The position to start at
 * @param {Vector3 | null} directionVector - The direction for the ray to travel in. Keep as null to use the player's look vector
 * @param {Number} distance
 * @param {BlockCheckFunction} blockCheckFunc
 * @param {Boolean} returnWhenTrue
 * @param {Boolean} stopWhenNotAir
 */
export const raytraceBlocks = (
  startPos = null,
  directionVector = null,
  distance = 60,
  blockCheckFunc = null,
  returnWhenTrue = false,
  stopWhenNotAir = true
) => {
  // Set default values to send a raycast from the player's eye pos, along the player's look vector.
  if (!startPos) startPos = getPlayerEyeCoords();
  if (!directionVector) directionVector = getPlayerLookVec();

  const endPos = directionVector
    .normalize()
    .multiply(distance)
    .add(startPos)
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

/**
 * Gets the player's look vector
 * @returns {Vector3}
 */
export const getPlayerLookVec = () => {
  let lookVec = Player.getPlayer().getRotationVector(); // .getLookVec()
  return new Vector3(lookVec.x, lookVec.y, lookVec.z);
};

/**
 * Quickly traverses the blocks from the start coordinate to the end coordinate.
 * @param {[Number, Number, Number]} start
 * @param {[Number, Number, Number]} end
 * @param {BlockCheckFunction} blockCheckFunc - Will stop traversal if this function returns true.
 * @param {Boolean} returnWhenTrue - Instead of returning the path, only return the block when the blockCheckFunc returns true. If the end is reached, return null instead.
 * @param {Boolean} stopWhenNotAir - Stops traversal when a block which isn't air is reached. This is checked after the blockCheckFunc.
 * @param {Boolean} returnIntersection - Also returns the point where the ray intersected the final block. Return an Object: {hit: [x, y, z], intersection: [x, y, z]}
 * @returns {Number[][] | [Number, Number, Number] | null | Object} - The coordinate(s) as integers, or null if miss.
 */
export const traverseVoxels = (
  start,
  end,
  blockCheckFunc = null,
  returnWhenTrue = false,
  stopWhenNotAir = false,
  returnIntersection = false
) => {
  // Initialize Shit
  const direction = end.map((v, i) => v - start[i]);
  const step = direction.map((a) => Math.sign(a));
  const thing = direction.map((a) => 1 / a);
  const tDelta = thing.map((v, i) => Math.min(v * step[i], 1));
  const tMax = thing.map((v, i) =>
    Math.abs((Math.floor(start[i]) + Math.max(step[i], 0) - start[i]) * v)
  );

  // Ints
  let currentPos = start.map((a) => Math.floor(a));
  let endPos = end.map((a) => Math.floor(a));
  let intersectionPoint = [...start];

  let path = [];
  let iters = 0;
  while (true && iters < 1000) {
    iters++;

    // Do block check function stuff
    let currentBlock = World.getBlockAt(...currentPos);
    if (blockCheckFunc && blockCheckFunc(currentBlock)) {
      // Return the hit block instead of the entire path
      if (returnWhenTrue) {
        // Return an Object which contains the hit block and the intersection point
        if (returnIntersection)
          return {
            hit: currentPos,
            intersection: intersectionPoint,
          };
        return currentPos;
      }
      break;
    }

    // Non-air block reached
    if (stopWhenNotAir && currentBlock.type.getID() !== 0) {
      if (returnIntersection)
        return {
          hit: currentPos,
          intersection: intersectionPoint,
        };
      break;
    }

    // Add the current position to the tarversed path
    path.push([...currentPos]);

    // End Reached
    if (currentPos.every((v, i) => v == endPos[i])) break;

    // Find the next direction to step in
    let minIndex = tMax.indexOf(Math.min(...tMax));
    tMax[minIndex] += tDelta[minIndex];
    currentPos[minIndex] += step[minIndex];

    // Update the intersection point
    intersectionPoint = start.map(
      (v, i) => v + tDelta[minIndex] * direction[i]
    );
  }
  if (returnWhenTrue) return null;
  return path;
};
