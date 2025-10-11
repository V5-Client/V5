//et { Vec3, Vector, Utils } = global.export

import { Vec3d } from './Constants';
import { Utils } from './Utils';

class MathUtilsClass {
    /**
     * Accesses .x .y .z from the input
     */
    distanceToPlayerPoint(Point) {
        const eyes = Player.getPlayer().getEyePos().y;
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
        const eyes = Player.getPlayer().getEyePos().y;
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
        const eyes = Player.getPlayer().getEyePos().y;
        if (!eyes) return 0;
        return this.calculateDistance(
            [
                eyes.x,
                Player.getY() + Player.asPlayerMP().getHeight() / 2,
                eyes.z,
            ],
            Point
        );
    }

    /**
     * @param {Entity} Entity
     */
    distanceToPlayerCT(Entity) {
        const eyes = Player.getPlayer().getEyePos().y;
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
        const eyes = Player.getPlayer().getEyePos().y;
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
        const distanceFlat = Math.hypot(diffX, diffZ);
        const distance = Math.hypot(diffX, diffY, diffZ);
        return {
            distance: distance,
            distanceFlat: distanceFlat,
            distanceY: diffY,
        };
    }

    /**
     * @param {Array} p1
     * @param {Array} p2
     */
    calculateDistance(p1, p2) {
        const diffX = p1[0] - p2[0];
        const diffY = p1[1] - p2[1];
        const diffZ = p1[2] - p2[2];
        const distanceFlat = Math.hypot(diffX, diffZ);
        const distance = Math.hypot(diffX, diffY, diffZ);
        return {
            distance: distance,
            distanceFlat: distanceFlat,
            distanceY: diffY,
        };
    }

    getDistanceToPlayer(xInput, yInput, zInput) {
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
        let eyeVector = Player.getPlayer().getEyePos();
        return this.getDistance(eyeVector.x, eyeVector.y, eyeVector.z, x, y, z);
    }

    getDistance(xInput1, yInput1, zInput1, xInput2, yInput2, zInput2) {
        let x1, y1, z1;
        let x2, y2, z2;

        // First point
        if (typeof xInput1 === 'number') {
            x1 = xInput1;
            y1 = yInput1;
            z1 = zInput1;
        } else {
            let vector = Utils.convertToVector(xInput1);
            x1 = vector.x ?? vector.getX();
            y1 = vector.y ?? vector.getY();
            z1 = vector.z ?? vector.getZ();
        }

        // Second point
        if (typeof xInput2 === 'number') {
            x2 = xInput2;
            y2 = yInput2;
            z2 = zInput2;
        } else {
            let vector = Utils.convertToVector(xInput2);
            x2 = vector.x ?? vector.getX();
            y2 = vector.y ?? vector.getY();
            z2 = vector.z ?? vector.getZ();
        }

        // Differences
        let diffX = x1 - x2;
        let diffY = y1 - y2;
        let diffZ = z1 - z2;

        // Distances
        const disFlat = Math.hypot(diffX, diffZ);
        const dis = Math.hypot(diffX, diffY, diffZ);

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
        let angles = this.calculateAngles(
            new Vec3i(Point[0], Point[1], Point[2])
        );
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
        if (vector instanceof Vec3d) {
            vecX = vector.x;
            vecY = vector.y;
            vecZ = vector.z;
        }
        if (
            //vector instanceof Vector ||
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
        let eyes = Player.getPlayer().getEyePos();
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

    calculateAbsoluteAngles(vector) {
        let vecX = 0;
        let vecY = 0;
        let vecZ = 0;

        if (vector instanceof Vec3d) {
            vecX = vector.x;
            vecY = vector.y;
            vecZ = vector.z;
        }
        if (vector instanceof BlockPos || vector instanceof Vec3i) {
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

        let eyes = Player.getPlayer().getEyePos();
        if (!eyes) return { yaw: 0, pitch: 0 };

        let diffX = vecX - eyes.x;
        let diffY = vecY - eyes.y;
        let diffZ = vecZ - eyes.z;

        let dist = Math.sqrt(diffX * diffX + diffZ * diffZ);
        let TargetPitchRadians = Math.atan2(diffY, dist);
        let TargetYawRadians = Math.atan2(diffZ, diffX);
        let Pitch = (-TargetPitchRadians * 180.0) / Math.PI;
        let Yaw = (TargetYawRadians * 180.0) / Math.PI - 90.0;

        Pitch = Math.max(-90, Math.min(90, Pitch));
        Yaw %= 360.0;
        while (Yaw >= 180.0) Yaw -= 360.0;
        while (Yaw <= -180.0) Yaw += 360.0;

        return { yaw: Yaw, pitch: Pitch };
    }

    getNumbersFromString(str) {
        const num = str.replace(/\D/g, ''); // \D matches any non-digit character
        return parseInt(num);
    }
}

export const MathUtils = new MathUtilsClass();
