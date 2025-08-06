//et { Vec3, Vector, Utils } = global.export

class MathUtilsClass {
  /**
   * Accesses .x .y .z from the input
   */
  distanceToPlayerPoint(Point) {
    const eyes = Player.getPlayer().getEyePos(1);
    if (!eyes) return 0;
    return this.calculateDistance(
      [eyes.x, eyes.y, eyes.z],
      [Point.x, Point.y, Point.z]
    );
  }

  /**
   * @param {Array} Point
   */
  distanceToPlayer(Point) {
    const eyes = Player.getPlayer().getEyePos(1);
    if (!eyes) return 0;
    return this.calculateDistance([eyes.x, eyes.y, eyes.z], Point);
  }

  /**
   * @param {Array} Point
   */
  distanceToPlayerFeet(Point) {
    return this.calculateDistance(
      [Player.getX(), Player.getY(), Player.getZ()],
      Point
    );
  }

  /**
   * @param {Array} Point
   */
  distanceToPlayerCenter(Point) {
    const eyes = Player.getPlayer().getEyePos(1);
    if (!eyes) return 0;
    return this.calculateDistance(
      [eyes.x, Player.getY() + Player.asPlayerMP().getHeight() / 2, eyes.z],
      Point
    );
  }

  /**
   * @param {Entity} Entity
   */
  distanceToPlayerCT(Entity) {
    const eyes = Player.getPlayer().getEyePos(1);
    if (!eyes) return 0;
    return this.calculateDistance(
      [eyes.x, eyes.y, eyes.z],
      [Entity.getX(), Entity.getY(), Entity.getZ()]
    );
  }

  /**
   * @param {EntityLivingBase} Entity
   */
  distanceToPlayerMC(Entity) {
    const eyes = Player.getPlayer().getEyePos(1);
    if (!eyes) return 0;
    return this.calculateDistance(
      [eyes.x, eyes.y, eyes.z],
      [Entity.getX(), Entity.getY(), Entity.getZ()]
    );
  }
  /**
   * @param {BlockPos} pos1
   * @param {BlockPos} pos2
   */
  calculateDistanceBP(pos1, pos2) {
    const diffX = pos1.x - pos2.x;
    const diffY = pos1.y - pos2.y;
    const diffZ = pos1.z - pos2.z;
    let distanceFlat = Math.sqrt(diffX * diffX + diffZ * diffZ);
    let distance = Math.sqrt(distanceFlat * distanceFlat + diffY * diffY);
    return { distance: distance, distanceFlat: distanceFlat, distanceY: diffY };
  }

  /**
   * @param {Array} p1
   * @param {Array} p2
   */
  calculateDistance(p1, p2) {
    const diffX = p1[0] - p2[0];
    const diffY = p1[1] - p2[1];
    const diffZ = p1[2] - p2[2];
    let distanceFlat = Math.sqrt(diffX * diffX + diffZ * diffZ);
    let distance = Math.sqrt(distanceFlat * distanceFlat + diffY * diffY);
    return { distance: distance, distanceFlat: distanceFlat, distanceY: diffY };
  }

  /*getDistanceToPlayer(xInput, yInput, zInput) {
    let x = xInput;
    let y = yInput;
    let z = zInput;
    if (!Utils.isNumber(xInput)) {
      let vector = Utils.convertToVector(xInput);
      x = vector.x;
      y = vector.y;
      z = vector.z;
    }
    return this.getDistance(
      Player.getX(),
      Player.getY(),
      Player.getZ(),
      x,
      y,
      z
    );
  }

  getDistanceToPlayerEyes(xInput, yInput, zInput) {
    let x = xInput;
    let y = yInput;
    let z = zInput;
    if (!Utils.isNumber(xInput)) {
      let vector = Utils.convertToVector(xInput);
      x = vector.x;
      y = vector.y;
      z = vector.z;
    }
    let eyeVector = Utils.convertToVector(Player.getEyePosition());
    return this.getDistance(eyeVector.x, eyeVector.y, eyeVector.z, x, y, z);
  }

  getDistance(xInput1, yInput1, zInput1, xInput2, yInput2, zInput2) {
    let x1 = xInput1;
    let y1 = yInput1;
    let z1 = zInput1;
    let x2 = xInput2;
    let y2 = yInput2;
    let z2 = zInput2;
    if (!Utils.isNumber(xInput1)) {
      let vector = Utils.convertToVector(xInput1);
      x1 = vector.x;
      y1 = vector.y;
      z1 = vector.z;
    }
    if (!Utils.isNumber(yInput1)) {
      let vector = Utils.convertToVector(yInput1);
      x2 = vector.x;
      y2 = vector.y;
      z2 = vector.z;
    }
    let diffX = x1 - x2;
    let diffY = y1 - y2;
    let diffZ = z1 - z2;
    let disFlat = Math.sqrt(diffX * diffX + diffZ * diffZ);
    let dis = Math.sqrt(diffY * diffY + disFlat * disFlat);
    return { distance: dis, distanceFlat: disFlat, differenceY: diffY };
  }

  fastDistance(x1, y1, z1, x2, y2, z2) {
    return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
  }

  /**
   * @param {Number} input
   */
  toFixed(input) {
    return parseInt(input.toFixed(1));
  }

  /**
   * @param {Array} Point
   */
  angleToPlayer(Point) {
    let angles = this.calculateAngles(new Vec3(Point[0], Point[1], Point[2]));
    let yaw = angles.yaw;
    let pitch = angles.pitch;
    let distance = Math.sqrt(yaw * yaw + pitch * pitch);
    return {
      distance: distance,
      yaw: yaw,
      pitch: pitch,
      yawAbs: Math.abs(yaw),
      pitchAbs: Math.abs(pitch),
    };
  }

  degreeToRad(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
  }

  wrapTo180(yaw) {
    while (yaw > 180) yaw -= 360;
    while (yaw < -180) yaw += 360;
    return yaw;
  }

  /**
   * @param {vec} vector
   */
  calculateAngles(vector) {
    let vecX = 0;
    let vecY = 0;
    let vecZ = 0;
    if (vector instanceof Vec3) {
      vecX = vector.x;
      vecY = vector.y;
      vecZ = vector.z;
    }
    if (
      vector instanceof Vector ||
      vector instanceof BlockPos ||
      vector instanceof Vec3i
    ) {
      vecX = vector.x;
      vecY = vector.y;
      vecZ = vector.z;
    }
    if (vector instanceof Array) {
      vecX = vector[0];
      vecY = vector[1];
      vecZ = vector[2];
    }
    if (vector instanceof Entity) {
      vecX = vector.getX();
      vecY = vector.getY();
      vecZ = vector.getZ();
    }
    let eyes = Player.getEyePosition();
    if (!eyes) return { yaw: 0, pitch: 0 };
    let diffX = vecX - eyes.x;
    let diffY = vecY - eyes.y;
    let diffZ = vecZ - eyes.z;
    let dist = Math.sqrt(diffX * diffX + diffZ * diffZ);
    let Pitch = -Math.atan2(dist, diffY);
    let Yaw = Math.atan2(diffZ, diffX);
    Pitch = ((Pitch * 180.0) / Math.PI + 90.0) * -1.0 - Player.getPitch();
    Pitch %= 180;
    while (Pitch >= 180) Pitch -= 180;
    while (Pitch < -180) Pitch += 180;
    Yaw = (Yaw * 180.0) / Math.PI - 90.0 - Player.getYaw();
    Yaw %= 360.0;
    while (Yaw >= 180.0) Yaw -= 360.0;
    while (Yaw <= -180.0) Yaw += 360.0;
    return { yaw: Yaw, pitch: Pitch };
  }

  getNumbersFromString(str) {
    const num = str.replace(/\D/g, ""); // \D matches any non-digit character
    return parseInt(num);
  }
}

export const Calcs = new MathUtilsClass();
