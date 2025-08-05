import { raytraceBlocks } from "./BloomCore/RaytraceBlocks";
import Vector3 from "./BloomCore/Vector3";

let Vec3 = Java.type("net.minecraft.world.phys.Vec3");
let BP = Java.type("net.minecraft.util.math.BlockPos");

export default class RayTrace {
  constructor() {
    this.sides = [
      [0.01, 0.5, 0.5],
      [0.99, 0.5, 0.5],
      [0.5, 0.5, 0.01],
      [0.5, 0.5, 0.99],
      [0.5, 0.01, 0.5],
      [0.5, 0.99, 0.5],
    ];
  }

  setSides(sides) {
    this.sides = sides;
  }

  returnPointsFromSides(sides, blockPos) {
    let returnArray = [
      [blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5],
      [blockPos.x + 0.5, blockPos.y + 0.3, blockPos.z + 0.5],
      [blockPos.x + 0.5, blockPos.y + 0.7, blockPos.z + 0.5],
    ];
    sides.forEach((side) => {
      returnArray.push([
        blockPos.x + side[0],
        blockPos.y + side[1],
        blockPos.z + side[2],
      ]);
    });
    let eyes = Player.getPlayer().getEyePos(1);
    for (let v = 0; v < sides.length; v++) {
      let x = blockPos.x;
      let y = blockPos.y;
      let z = blockPos.z;
      let [sideX, sideY, sideZ] = sides[v];
      if (sideX === 0.99 && x + sideX > eyes.field_1352) {
        continue;
      }
      if (sideX === 0.01 && x + sideX < eyes.field_1352) {
        continue;
      }
      if (sideY === 0.99 && y + sideY > eyes.field_1351) {
        continue;
      }
      if (sideY === 0.01 && y + sideY < eyes.field_1351) {
        continue;
      }
      if (sideZ === 0.99 && z + sideZ > eyes.field_1350) {
        continue;
      }
      if (sideZ === 0.01 && z + sideZ < eyes.field_1350) {
        continue;
      }
      for (let i = 0; i <= 8; i++) {
        let point = 0.1 * i + 0.1;

        if (sideZ === 0.01 || sideZ === 0.99) {
          for (let s = 0; s <= 8; s++) {
            let pointZ = 0.1 * s + 0.1;
            returnArray.push([x + pointZ, y + point, z + sideZ]);
          }
        }
        if (sideY === 0.01 || sideY === 0.99) {
          for (let s = 0; s <= 8; s++) {
            let pointY = 0.1 * s + 0.1;
            returnArray.push([x + point, y + sideY, z + pointY]);
          }
        }
        if (sideX === 0.01 || sideX === 0.99) {
          for (let s = 0; s <= 8; s++) {
            let pointX = 0.1 * s + 0.1;
            returnArray.push([x + sideX, y + point, z + pointX]);
          }
        }
      }
    }
    return returnArray;
  }

  getLittlePointsOnBlock(pos) {
    let returnArray = [];
    let sides = [
      [0.5, 0.5, 0.5],
      [0.5, 0.25, 0.5],
      [0.5, 0.75, 0.5],
      [0.05, 0.5, 0.5],
      [0.95, 0.5, 0.5],
      [0.5, 0.5, 0.05],
      [0.5, 0.5, 0.95],
      [0.5, 0.05, 0.5],
      [0.5, 0.95, 0.5],
    ];
    sides.forEach((side) => {
      returnArray.push([pos.x + side[0], pos.y + side[1], pos.z + side[2]]);
    });
    return returnArray;
  }

  check(block) {
    return block.type.getID() != 0.0;
  }

  toFloat(number) {
    return parseFloat(number.toFixed(2));
  }

  /**
   * @param {BlockPos} blockPos
   * @param {Vec3} vector
   * @returns {Array}
   */
  getPointOnBlock = (
    blockPos,
    vector = Player.getPlayer().getEyePos(1),
    mcCast = false,
    performance = false
  ) => {
    let points = performance
      ? this.getLittlePointsOnBlock(blockPos)
      : this.returnPointsFromSides(this.sides, blockPos);
    for (let i = 0; i < points.length; i++) {
      let point = points[i];
      if (mcCast) {
        if (this.canSeePointMC(blockPos, point, vector)) {
          return point;
        }
        continue;
      }
      if (this.canSeePoint(blockPos, point, vector)) {
        return point;
      }
    }
    return null;
  };

  /**
   * @param {BlockPos} blockPos
   * @param {Array} point
   * @param {Vec3} vector
   * @returns {Boolean}
   */
  canSeePoint(blockPos, point, vector = Player.getPlayer().func_174824_e(1)) {
    let vectorX = this.toFloat(point[0]) - vector.field_1352;
    let vectorY = this.toFloat(point[1]) - vector.field_1351;
    let vectorZ = this.toFloat(point[2]) - vector.field_1350;
    let castResult = raytraceBlocks(
      [vector.field_1352, vector.field_1351, vector.field_1350],
      new Vector3(vectorX, vectorY, vectorZ),
      61,
      this.check,
      true
    );
    if (
      castResult &&
      castResult[0] === blockPos.x &&
      castResult[1] === blockPos.y &&
      castResult[2] === blockPos.z
    ) {
      return true;
    }
    return false;
  }

  /**
   * @param {BlockPos} blockPos
   * @param {Array} point
   * @param {Vec3} vector
   * @returns {Boolean}
   */
  canSeePointMC(blockPos, point, vector = Player.getPlayer().getEyePos(1)) {
    let castResult = World.getWorld().raycast(
      vector,
      new Vec3(point[0], point[1], point[2])
    );
    if (castResult && castResult.getBlockPos().equals(blockPos.toMCBlock())) {
      return true;
    }
    return false;
  }

  canHitVec3(Vector1, Vector2) {
    let castResult = World.getWorld().raycast(Vector1, Vector2);
    if (castResult && castResult.getBlockPos().equals(new BP(Vector2))) {
      return true;
    }
    return false;
  }

  /**
   * Returns the list of blocks in the player sight
   * @param {Number} Reach
   * @param {Function} checkFunction
   * @returns {Array}
   */
  rayTracePlayerBlocks(Reach = 60, checkFunction = null) {
    let eyes = Player.getPlayer().getEyePos(1);
    return raytraceBlocks(
      [eyes.field_1352, eyes.field_1351, eyes.field_1350],
      null,
      Reach,
      checkFunction,
      false,
      false
    );
  }

  /**
   * Returns all blocks between begin and end
   * @param {Array<[x,y,z]>} begin
   * @param {Array<[x,y,z]>} end
   * @returns {Array<[x,y,z]>}
   */
  rayTraceBetweenPoints(begin, end) {
    let vectorX = end[0] - begin[0];
    let vectorY = end[1] - begin[1];
    let vectorZ = end[2] - begin[2];
    let distance = Math.ceil(
      Math.sqrt(vectorX * vectorX + vectorY * vectorY + vectorZ * vectorZ)
    );
    return raytraceBlocks(
      [begin[0], begin[1], begin[2]],
      new Vector3(vectorX, vectorY, vectorZ),
      distance,
      null,
      false,
      false
    );
  }

  /**
   * @param {Number} Reach
   * @param {Array} vec
   * @param {Array} direction
   * @returns {Array}
   */
  rayTraceBlocks(Reach, vec, direction) {
    return raytraceBlocks(
      vec,
      new Vector3(direction[0], direction[1], direction[2]),
      Reach,
      null,
      false,
      false
    );
  }

  /**
   * Raytraces the specified distance and returns the block at the end of the ray
   * @param {Number} dist the distance to raytrace
   * @returns {Block} the block at the end of the ray, or null if out of range
   */
  raytrace(dist) {
    const vecAng = Player.getPlayer().raycast(dist, 0.0);
    if (!vecAng) return null;
    const blockPos = vecAng?.getBlockPos();
    if (!blockPos) return null;
    const blockAt = World.getBlockAt(new BlockPos(blockPos));
    if (!blockAt || !blockAt.type.getID()) return null;
    return blockAt;
  }
}
