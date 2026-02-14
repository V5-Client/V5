import { Utils } from './Utils';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

class Point3D {
    constructor(x, y, z) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }

    distSq(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return dx * dx + dy * dy + dz * dz;
    }

    dist(other) {
        return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    horizontalDistSq(other) {
        const dx = this.x - other.x;
        const dz = this.z - other.z;
        return dx * dx + dz * dz;
    }

    horizontalDist(other) {
        return Math.hypot(this.x - other.x, this.z - other.z);
    }
}

class DistanceCalculator {
    constructor() {}

    getPointFromInput(input, y, z) {
        if (typeof input === 'number') {
            return new Point3D(input, y, z);
        }
        const vec = Utils.convertToVector(input);
        return new Point3D(vec.x ?? vec.getX(), vec.y ?? vec.getY(), vec.z ?? vec.getZ());
    }

    getPlayerPos() {
        return new Point3D(Player.getX(), Player.getY(), Player.getZ());
    }

    getPlayerEyes() {
        const eyePos = Player.getPlayer()?.getEyePos();
        if (!eyePos) return null;
        return new Point3D(eyePos.x, eyePos.y, eyePos.z);
    }

    computeDistance(p1, p2) {
        const point1 = new Point3D(p1[0], p1[1], p1[2]);
        const point2 = new Point3D(p2[0], p2[1], p2[2]);

        const d = point1.dist(point2);
        const df = point1.horizontalDist(point2);

        return {
            distance: d,
            distanceFlat: df,
            distanceY: point1.y - point2.y,
            differenceY: point1.y - point2.y,
        };
    }
}

class AngleCalculator {
    constructor() {}

    wrapAngle180(angle) {
        angle %= 360;
        if (angle >= 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    }

    calculateRelativeAngles(targetVec) {
        const eyes = Player.getPlayer()?.getEyePos();
        if (!eyes) return { yaw: 0, pitch: 0 };

        const dx = targetVec.x - eyes.x;
        const dy = targetVec.y - eyes.y;
        const dz = targetVec.z - eyes.z;

        const horizontalDist = Math.hypot(dx, dz);

        let pitch = -Math.atan2(dy, horizontalDist) * RAD_TO_DEG;
        let yaw = Math.atan2(dz, dx) * RAD_TO_DEG - 90;

        let relativeYaw = this.wrapAngle180(yaw - Player.getYaw());
        let relativePitch = pitch - Player.getPitch();

        return { yaw: relativeYaw, pitch: relativePitch };
    }

    calculateAbsoluteAngles(targetVec) {
        const eyes = Player.getPlayer()?.getEyePos();
        if (!eyes) return { yaw: 0, pitch: 0 };

        const dx = targetVec.x - eyes.x;
        const dy = targetVec.y - eyes.y;
        const dz = targetVec.z - eyes.z;

        const horizontalDist = Math.hypot(dx, dz);

        let pitch = -Math.atan2(dy, horizontalDist) * RAD_TO_DEG;
        let yaw = Math.atan2(dz, dx) * RAD_TO_DEG - 90;

        return {
            yaw: this.wrapAngle180(yaw),
            pitch: Math.max(-90, Math.min(90, pitch)),
        };
    }
}

const distCalc = new DistanceCalculator();
const angleCalc = new AngleCalculator();

export const MathUtils = {
    distanceToPlayerPoint: function (point) {
        const eyes = distCalc.getPlayerEyes();
        const target = distCalc.getPointFromInput(point);
        return eyes ? eyes.dist(target) : 0;
    },

    distanceToPlayer: function (point) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        const target = new Point3D(point[0], point[1], point[2]);
        return distCalc.computeDistance([eyes.x, eyes.y, eyes.z], [target.x, target.y, target.z]);
    },

    distanceToPlayerFeet: function (point) {
        const feet = distCalc.getPlayerPos();
        const target = new Point3D(point[0], point[1], point[2]);
        return distCalc.computeDistance([feet.x, feet.y, feet.z], [target.x, target.y, target.z]);
    },

    distanceToPlayerCenter: function (point) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        const centerY = Player.getY() + Player.asPlayerMP().getHeight() / 2;
        const target = new Point3D(point[0], point[1], point[2]);
        return distCalc.computeDistance([eyes.x, centerY, eyes.z], [target.x, target.y, target.z]);
    },

    distanceToPlayerCT: function (entity) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        return distCalc.computeDistance([eyes.x, eyes.y, eyes.z], [entity.getX(), entity.getY(), entity.getZ()]);
    },

    distanceToPlayerMC: function (entity) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        return distCalc.computeDistance([eyes.x, eyes.y, eyes.z], [entity.getX(), entity.getY(), entity.getZ()]);
    },

    calculateDistanceBP: function (pos1, pos2) {
        const p1 = distCalc.getPointFromInput(pos1);
        const p2 = distCalc.getPointFromInput(pos2);
        return {
            distance: p1.dist(p2),
            distanceFlat: p1.horizontalDist(p2),
            distanceY: p1.y - p2.y,
        };
    },

    calculateDistance: function (p1, p2) {
        return distCalc.computeDistance(p1, p2);
    },

    getDistanceToPlayer: function (x, y, z) {
        const feet = distCalc.getPlayerPos();
        const target = distCalc.getPointFromInput(x, y, z);
        return distCalc.computeDistance([feet.x, feet.y, feet.z], [target.x, target.y, target.z]);
    },

    getDistanceToPlayerEyes: function (x, y, z) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return { distance: 0, distanceFlat: 0, differenceY: 0 };
        const target = distCalc.getPointFromInput(x, y, z);
        return distCalc.computeDistance([eyes.x, eyes.y, eyes.z], [target.x, target.y, target.z]);
    },

    getDistance: function (x1, y1, z1, x2, y2, z2) {
        const p1 = distCalc.getPointFromInput(x1, y1, z1);
        const p2 = distCalc.getPointFromInput(x2, y2, z2);
        return distCalc.computeDistance([p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]);
    },

    fastDistance: function (x1, y1, z1, x2, y2, z2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const dz = z1 - z2;
        return Math.hypot(dx, dy, dz);
    },

    toFixed: function (val) {
        return Math.round(val * 10) / 10;
    },

    angleToPlayer: function (point) {
        const target = new Point3D(point[0], point[1], point[2]);
        const rel = angleCalc.calculateRelativeAngles(target);
        const dist = Math.hypot(rel.yaw, rel.pitch);
        return {
            distance: dist,
            yaw: rel.yaw,
            pitch: rel.pitch,
            yawAbs: Math.abs(rel.yaw),
            pitchAbs: Math.abs(rel.pitch),
        };
    },

    degreeToRad: function (deg) {
        return deg * DEG_TO_RAD;
    },

    getAngleDifference: function (cur, target) {
        return angleCalc.wrapAngle180(target - cur);
    },

    wrapTo180: function (angle) {
        return angleCalc.wrapAngle180(angle);
    },

    calculateAngles: function (vec) {
        const target = distCalc.getPointFromInput(vec);
        return angleCalc.calculateRelativeAngles(target);
    },

    calculateAbsoluteAngles: function (vec) {
        const target = distCalc.getPointFromInput(vec);
        return angleCalc.calculateAbsoluteAngles(target);
    },

    getNumbersFromString: function (str) {
        if (!str) return 0;
        const match = str.match(/\d+/g);
        return match ? Number.parseInt(match.join('')) : 0;
    },
};
