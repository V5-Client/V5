class vec {
  constructor(x, y, z) {
    if (x instanceof BlockPos) {
      this.x = x.getX();
      this.y = x.getY();
      this.z = x.getZ();
    } else if (x instanceof Entity) {
      this.x = x.getX();
      this.y = x.getY();
      this.z = x.getZ();
    } else if (x instanceof Player || x instanceof ServerPlayer) {
      this.x = x.getX();
      this.y = x.getY();
      this.z = x.getZ();
    } else if (x instanceof Array) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
    } else {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
    }
  }

  /**
   * Adds values or a vec to this vector, returns a new vec.
   * @param {number|vec} x
   * @param {number} y
   * @param {number} z
   * @returns {vec}
   */
  add(x, y, z) {
    if (x instanceof vec) {
      return new vec(this.x + x.x, this.y + x.y, this.z + x.z);
    } else {
      return new vec(this.x + x, this.y + y, this.z + z);
    }
  }

  /**
   * Returns a BlockPos (integer block coordinates) based on this vector.
   */
  getBlockPos() {
    return new BlockPos(
      Math.floor(this.x),
      Math.floor(this.y),
      Math.floor(this.z)
    );
  }

  /**
   * Calculates Euclidean distance to another vec or coords.
   * @param {vec|number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  getDistance(x, y, z) {
    let targetX, targetY, targetZ;
    if (x instanceof vec) {
      targetX = x.x;
      targetY = x.y;
      targetZ = x.z;
    } else {
      targetX = x;
      targetY = y;
      targetZ = z;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dz = targetZ - this.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Returns Minecraft Vec3 instance.
   * @returns {Vec3}
   */
  toMC() {
    return new Vec3(this.x, this.y, this.z);
  }

  /**
   * Checks equality with another vec.
   * @param {vec} other
   * @returns {boolean}
   */
  equals(other) {
    return (
      other && this.x === other.x && this.y === other.y && this.z === other.z
    );
  }

  /**
   * Hashcode for this vector.
   */
  hashCode() {
    // Same hash as Java BlockPos does internally
    const prime = 31;
    let result = 1;
    result = prime * result + Math.floor(this.x);
    result = prime * result + Math.floor(this.y);
    result = prime * result + Math.floor(this.z);
    return result;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  toString() {
    return `Vector(x=${this.x}, y=${this.y}, z=${this.z})`;
  }
}

global.Vector = vec;
