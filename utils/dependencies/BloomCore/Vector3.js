export class Vector3 {
    constructor(x, y, z) {
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.z = z ?? 0;
    }

    getComponents() {
        return [this.x, this.y, this.z];
    }

    add(vector3) {
        if (vector3 instanceof Vector3) {
            return new Vector3(this.x + vector3.x, this.y + vector3.y, this.z + vector3.z);
        }
        return new Vector3(this.x + vector3[0], this.y + vector3[1], this.z + vector3[2]);
    }

    getLength() {
        return Math.hypot(this.x, this.y, this.z);
    }

    normalize() {
        const len = this.getLength();
        if (len === 0) return new Vector3(0, 0, 0); // Prevent division by zero
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }

    multiply(factor) {
        return new Vector3(this.x * factor, this.y * factor, this.z * factor);
    }
}
