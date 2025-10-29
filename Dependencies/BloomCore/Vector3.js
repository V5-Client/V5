export class Vector3 {
    static fromCoords = (x0, y0, z0, x1, y1, z1) => new Vector3(x1 - x0, y1 - y0, z1 - z0);

    static fromPitchYaw = (pitch, yaw) => {
        const f = Math.cos(-yaw * 0.017453292 - Math.PI);
        const f1 = Math.sin(-yaw * 0.017453292 - Math.PI);
        const f2 = -Math.cos(-pitch * 0.017453292);
        const f3 = Math.sin(-pitch * 0.017453292);
        return new Vector3(f1 * f2, f3, f * f2).normalize();
    };

    constructor(x, y, z) {
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.z = z ?? 0;
    }

    getComponents() {
        return [this.x, this.y, this.z];
    }

    subtract(vector3) {
        return new Vector3(this.x - vector3.x, this.y - vector3.y, this.z - vector3.z);
    }

    add(vector3) {
        if (vector3 instanceof Vector3) {
            return new Vector3(this.x + vector3.x, this.y + vector3.y, this.z + vector3.z);
        }
        return new Vector3(this.x + vector3[0], this.y + vector3[1], this.z + vector3[2]);
    }

    dotProduct(vector3) {
        return this.x * vector3.x + this.y * vector3.y + this.z * vector3.z;
    }

    crossProduct(vector3) {
        return new Vector3(this.y * vector3.z - this.z * vector3.y, this.z * vector3.x - this.x * vector3.z, this.x * vector3.y - this.y * vector3.x);
    }

    getLength() {
        return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }

    getAngleRad(vector3) {
        return Math.acos(this.dotProduct(vector3) / (this.getLength() * vector3.getLength()));
    }

    getAngleDeg(vector3) {
        return (180 / Math.PI) * this.getAngleRad(vector3);
    }

    getPlaneEquation(point1, point2, point3) {
        let d1 = new Vector3(point2[0] - point1[0], point2[1] - point1[1], point2[2] - point1[2]);
        let d2 = new Vector3(point3[0] - point1[0], point3[1] - point1[1], point3[2] - point1[2]);
        let normal = d1.crossProduct(d2);
        return [...normal.getComponents(), -new Vector3(...point1).dotProduct(normal)];
    }

    normalize() {
        const len = this.getLength();
        if (len === 0) return new Vector3(0, 0, 0); // Prevent division by zero
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }

    multiply(factor) {
        return new Vector3(this.x * factor, this.y * factor, this.z * factor);
    }

    rotate(degrees, reverse = false) {
        if (reverse) degrees = (360 - degrees) % 360;
        let newX = this.x;
        let newZ = this.z;
        switch (degrees) {
            case 90:
                [newX, newZ] = [this.z, -this.x];
                break;
            case 180:
                [newX, newZ] = [-this.x, -this.z];
                break;
            case 270:
                [newX, newZ] = [-this.z, this.x];
                break;
        }
        return new Vector3(newX, this.y, newZ);
    }

    getYaw() {
        const normalized = this.normalize();
        return (180 / Math.PI) * -Math.atan2(normalized.x, normalized.z);
    }

    getPitch() {
        const normalized = this.normalize();
        return (180 / Math.PI) * -Math.asin(normalized.y);
    }

    toString() {
        return `Vector3(x=${this.x},y=${this.y},z=${this.z})`;
    }

    getX() {
        return this.x;
    }
    getY() {
        return this.y;
    }
    getZ() {
        return this.z;
    }

    copy() {
        return new Vector3(this.x, this.y, this.z);
    }
}
