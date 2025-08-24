import { raytraceBlocks } from "../Dependencies/BloomCore/RaytraceBlocks";
import { Vector3 } from "../Dependencies/BloomCore/Vector3";

let Vec3 = Java.type("net.minecraft.util.math.Vec3d");
let BP = Java.type("net.minecraft.util.math.BlockPos");
let ClipContext = Java.type("net.minecraft.world.phys.ClipContext"); 

class rayTraceUtils {
  constructor() {
    // These are the points on the center of each face of a block
    this.sides = [
      [0.01, 0.5, 0.5], [0.99, 0.5, 0.5],
      [0.5, 0.5, 0.01], [0.5, 0.5, 0.99],
      [0.5, 0.01, 0.5], [0.5, 0.99, 0.5],
    ];
  }

  setSides(sides) {
    this.sides = sides;
  }

  /**
   * @warning This function is EXTREMELY performance-intensive and should be avoided.
   * It generates hundreds of points to test for visibility, which is almost never necessary.
   * The 'getLittlePointsOnBlock' method is the recommended alternative.
   */
  returnPointsFromSides(sides, blockPos) {
    let returnArray = [
        [blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5],
        [blockPos.x + 0.5, blockPos.y + 0.3, blockPos.z + 0.5],
        [blockPos.x + 0.5, blockPos.y + 0.7, blockPos.z + 0.5],
    ];
    sides.forEach((side) => {
      returnArray.push([ blockPos.x + side[0], blockPos.y + side[1], blockPos.z + side[2] ]);
    });
    return returnArray;
  }

  /**
   * Generates a small, reasonable number of points on a block to check for visibility.
   * This is the preferred method for performance.
   */
  getLittlePointsOnBlock(pos) {
    const points = [
      [0.5, 0.5, 0.5], [0.5, 0.25, 0.5], [0.5, 0.75, 0.5],
      [0.05, 0.5, 0.5], [0.95, 0.5, 0.5], [0.5, 0.5, 0.05],
      [0.5, 0.5, 0.95], [0.5, 0.05, 0.5], [0.5, 0.95, 0.5],
    ];
    return points.map(p => [pos.x + p[0], pos.y + p[1], pos.z + p[2]]);
  }

  // A simple check function to see if a block is not air.
  check(block) {
    return block.type.getID() !== 0;
  }

  toFloat(number) {
    return parseFloat(number.toFixed(2));
  }

  /**
   * Finds a visible point on a block from a given vector (e.g., player's eyes).
   * @param {BlockPos} blockPos The block to check.
   * @param {Vec3} vector The starting position of the raycast (e.g., Player.getPlayer().getEyePos(1)).
   * @param {boolean} mcCast - If true, uses Minecraft's faster native raycast. Defaults to true.
   * @param {boolean} performance - If true, uses a small, optimized set of points to check. Defaults to true.
   * @returns {Array | null} The [x, y, z] coordinates of the visible point, or null if none are found.
   */
  getPointOnBlock = (
    blockPos,
    vector = Player.getPlayer().getEyePos(1),
    mcCast = true, // OPTIMIZATION: Default to the faster, native raycast.
    performance = true // OPTIMIZATION: Default to the performant point generation.
  ) => {
    const points = performance
      ? this.getLittlePointsOnBlock(blockPos)
      : this.returnPointsFromSides(this.sides, blockPos);

    for (const point of points) {
      const isVisible = mcCast
        ? this.canSeePointMC(blockPos, point, vector)
        : this.canSeePoint(blockPos, point, vector);
      
      if (isVisible) {
        return point;
      }
    }
    return null;
  };

  /**
   * Checks visibility using the custom JS raytracer. Slower, but allows for custom block checks.
   */
  canSeePoint(blockPos, point, vector = Player.getPlayer().getEyePos(1)) {
    const direction = new Vector3(point[0] - vector.x, point[1] - vector.y, point[2] - vector.z);
    
    const castResult = raytraceBlocks(
      [vector.x, vector.y, vector.z],
      direction, // FIX: Pass the newly created Vector3 instance
      61,
      this.check,
      true
    );
    
    return castResult &&
      castResult[0] === blockPos.x &&
      castResult[1] === blockPos.y &&
      castResult[2] === blockPos.z;
  }

  /**
   * Checks visibility using Minecraft's native raytracer. Faster and more accurate.
   */
  canSeePointMC(blockPos, point, vector = Player.getPlayer().getEyePos(1)) {
    const start = vector;
    const end = new Vec3(point[0], point[1], point[2]);

    const clipContext = new ClipContext(
      start, end,
      ClipContext.Block.OUTLINE,
      ClipContext.Fluid.NONE,
      Player.getPlayer()
    );
    const castResult = World.getWorld().clip(clipContext);
    return castResult && castResult.getBlockPos().equals(blockPos.toMCBlock());
  }
  
  /**
   * Returns the list of blocks in the player's line of sight.
   */
  rayTracePlayerBlocks(Reach = 60, checkFunction = null) {
    const eyes = Player.getPlayer().getEyePos(1);
    return raytraceBlocks(
      [eyes.x, eyes.y, eyes.z], null, Reach, checkFunction, false, false
    );
  }

  /**
   * Returns all block coordinates traversed between two points.
   */
  rayTraceBetweenPoints(begin, end) {
    const direction = new Vector3(end[0] - begin[0], end[1] - begin[1], end[2] - begin[2]);
    const distance = direction.getLength();
    
    return raytraceBlocks(
      begin,
      direction, // FIX: Pass the newly created Vector3 instance
      distance, null, false, false
    );
  }

  /**
   * Raytraces from a specific vector with a specific direction.
   */
  rayTraceBlocks(Reach, vec, direction) {
    return raytraceBlocks(
      vec,
      new Vector3(direction[0], direction[1], direction[2]), // FIX: Use 'new Vector3'
      Reach, null, false, false
    );
  }

  /**
   * Uses the player's built-in raycast to find the block they are looking at.
   */
  raytrace(dist) {
    const castResult = Player.getPlayer().raycast(dist, 0.0);
    if (!castResult) return null;
    
    const blockPos = castResult.getBlockPos();
    if (!blockPos) return null;

    const blockAt = World.getBlockAt(blockPos);
    return (blockAt && blockAt.type.getID() !== 0) ? blockAt : null;
  }
}

export const RayTrace = new rayTraceUtils();