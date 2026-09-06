import { Utils } from './Utils';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const point = (x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class DistanceCalculator {
    getPointFromInput(input, y, z) {
        if (typeof input === 'number') {
            return point(input, y, z);
        }
        const vec = Utils.convertToVector(input);
        return vec ? point(vec.x(), vec.y(), vec.z()) : null;
    }

    getPlayerPos() {
        return Player.getPlayer() ? point(Player.getX(), Player.getY(), Player.getZ()) : null;
    }

    getPlayerEyes() {
        const eyePos = Player.getPlayer()?.getEyePosition();
        return eyePos ? point(eyePos.x(), eyePos.y(), eyePos.z()) : null;
    }

    computeDistance(point1, point2) {
        return {
            distance: distance(point1, point2),
            distanceFlat: horizontalDistance(point1, point2),
            distanceY: point1.y - point2.y,
            differenceY: point1.y - point2.y,
        };
    }
}

class AngleCalculator {
    wrapAngle180(angle) {
        angle %= 360;
        if (angle >= 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    }

    calculateRelativeAngles(targetVec) {
        if (!targetVec) return { yaw: 0, pitch: 0 };
        const eyes = Player.getPlayer()?.getEyePosition();
        if (!eyes) return { yaw: 0, pitch: 0 };

        const dx = targetVec.x - eyes.x();
        const dy = targetVec.y - eyes.y();
        const dz = targetVec.z - eyes.z();

        const horizontalDist = Math.hypot(dx, dz);

        let pitch = -Math.atan2(dy, horizontalDist) * RAD_TO_DEG;
        let yaw = Math.atan2(dz, dx) * RAD_TO_DEG - 90;

        let relativeYaw = this.wrapAngle180(yaw - Player.getYaw());
        let relativePitch = pitch - Player.getPitch();

        return { yaw: relativeYaw, pitch: relativePitch };
    }

    calculateAbsoluteAngles(targetVec) {
        if (!targetVec) return { yaw: 0, pitch: 0 };
        const eyes = Player.getPlayer()?.getEyePosition();
        if (!eyes) return { yaw: 0, pitch: 0 };

        const dx = targetVec.x - eyes.x();
        const dy = targetVec.y - eyes.y();
        const dz = targetVec.z - eyes.z();

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
        return eyes && target ? distance(eyes, target) : 0;
    },

    distanceToPlayer: function (point) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        const target = distCalc.getPointFromInput(point);
        if (!target) return 0;
        return distCalc.computeDistance(eyes, target);
    },

    distanceToPlayerFeet: function (point) {
        const feet = distCalc.getPlayerPos();
        if (!feet) return 0;
        const target = distCalc.getPointFromInput(point);
        if (!target) return 0;
        return distCalc.computeDistance(feet, target);
    },

    distanceToPlayerCenter: function (targetPoint) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return 0;
        const target = distCalc.getPointFromInput(targetPoint);
        if (!target) return 0;
        const centerY = Player.getY() + Player.asPlayerMP().getHeight() / 2;
        return distCalc.computeDistance(point(eyes.x, centerY, eyes.z), target);
    },

    distanceToPlayerCT: function (entity) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes || !entity) return 0;
        return distCalc.computeDistance(eyes, point(entity.getX(), entity.getY(), entity.getZ()));
    },

    distanceToPlayerMC: function (entity) {
        return MathUtils.distanceToPlayerCT(entity);
    },

    calculateDistanceBP: function (pos1, pos2) {
        const p1 = distCalc.getPointFromInput(pos1);
        const p2 = distCalc.getPointFromInput(pos2);
        if (!p1 || !p2) return { distance: 0, distanceFlat: 0, distanceY: 0 };
        return {
            distance: distance(p1, p2),
            distanceFlat: horizontalDistance(p1, p2),
            distanceY: p1.y - p2.y,
        };
    },

    calculateDistance: function (p1, p2) {
        const point1 = distCalc.getPointFromInput(p1);
        const point2 = distCalc.getPointFromInput(p2);
        if (!point1 || !point2) return { distance: 0, distanceFlat: 0, distanceY: 0 };
        return distCalc.computeDistance(point1, point2);
    },

    getDistanceToPlayer: function (x, y, z) {
        const feet = distCalc.getPlayerPos();
        const target = distCalc.getPointFromInput(x, y, z);
        if (!feet || !target) return { distance: 0, distanceFlat: 0, distanceY: 0 };
        return distCalc.computeDistance(feet, target);
    },

    getDistanceToPlayerEyes: function (x, y, z) {
        const eyes = distCalc.getPlayerEyes();
        if (!eyes) return { distance: 0, distanceFlat: 0, differenceY: 0 };
        const target = distCalc.getPointFromInput(x, y, z);
        if (!target) return { distance: 0, distanceFlat: 0, differenceY: 0 };
        return distCalc.computeDistance(eyes, target);
    },

    getDistance: function (x1, y1, z1, x2, y2, z2) {
        const p1 = distCalc.getPointFromInput(x1, y1, z1);
        const p2 = distCalc.getPointFromInput(x2, y2, z2);
        if (!p1 || !p2) return { distance: 0, distanceFlat: 0, distanceY: 0 };
        return distCalc.computeDistance(p1, p2);
    },

    fastDistance: function (x1, y1, z1, x2, y2, z2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const dz = z1 - z2;
        return Math.hypot(dx, dy, dz);
    },

    blockCenter: function (x, y, z) {
        return point(x + 0.5, y + 0.5, z + 0.5);
    },

    distanceToBlockCenter: function (x, y, z) {
        return MathUtils.distanceToPlayerFeet(MathUtils.blockCenter(x, y, z));
    },

    distanceToBox: function (pos, min, max) {
        const p = distCalc.getPointFromInput(pos);
        const lo = distCalc.getPointFromInput(min);
        const hi = distCalc.getPointFromInput(max);
        if (!p || !lo || !hi) return 0;
        const dx = Math.max(lo.x - p.x, 0, p.x - hi.x);
        const dy = Math.max(lo.y - p.y, 0, p.y - hi.y);
        const dz = Math.max(lo.z - p.z, 0, p.z - hi.z);
        return Math.hypot(dx, dy, dz);
    },

    toFixed: function (val) {
        return Math.round(val * 10) / 10;
    },

    angleToPlayer: function (point) {
        const target = distCalc.getPointFromInput(point);
        if (!target) return { distance: 0, yaw: 0, pitch: 0, yawAbs: 0, pitchAbs: 0 };
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
        if (!target) return { yaw: 0, pitch: 0 };
        return angleCalc.calculateRelativeAngles(target);
    },

    calculateAbsoluteAngles: function (vec) {
        const target = distCalc.getPointFromInput(vec);
        if (!target) return { yaw: 0, pitch: 0 };
        return angleCalc.calculateAbsoluteAngles(target);
    },

    offsetPitch: function (point, degrees) {
        const target = distCalc.getPointFromInput(point);
        const eyes = distCalc.getPlayerEyes();
        if (!target || !eyes) return point;
        const horizontal = Math.hypot(target.x - eyes.x, target.z - eyes.z);
        if (!horizontal) return point;
        const pitch = angleCalc.calculateAbsoluteAngles(target).pitch + degrees;
        return { ...point, y: eyes.y - horizontal * Math.tan(pitch * DEG_TO_RAD) };
    },

    getNumbersFromString: function (str) {
        if (!str) return 0;
        const match = str.match(/\d+/g);
        return match ? Number.parseInt(match.join('')) : 0;
    },
};
