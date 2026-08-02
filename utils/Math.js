import { convertToVector } from './Utils';

const RAD_TO_DEG = 180 / Math.PI;
const point = (x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const toPoint = (input, y, z) => {
    if (typeof input === 'number') return point(input, y, z);
    const vec = convertToVector(input);
    return vec ? point(vec.x(), vec.y(), vec.z()) : null;
};

const playerPosition = () => (Player.getPlayer() ? point(Player.getX(), Player.getY(), Player.getZ()) : null);

const playerEyes = () => {
    const eyes = Player.getPlayer()?.getEyePosition();
    return eyes ? point(eyes.x(), eyes.y(), eyes.z()) : null;
};

const distances = (a, b) => ({
    distance: distance(a, b),
    distanceFlat: horizontalDistance(a, b),
    distanceY: a.y - b.y,
    differenceY: a.y - b.y,
});

const emptyDistance = () => ({ distance: 0, distanceFlat: 0, distanceY: 0 });

export function wrapTo180(angle) {
    angle %= 360;
    if (angle >= 180) angle -= 360;
    if (angle < -180) angle += 360;
    return angle;
}

export function distanceToPlayerPoint(targetInput) {
    const eyes = playerEyes();
    const target = toPoint(targetInput);
    return eyes && target ? distance(eyes, target) : 0;
}

export function distanceToPlayerFeet(targetInput) {
    const feet = playerPosition();
    const target = toPoint(targetInput);
    return feet && target ? distances(feet, target) : 0;
}

export function calculateDistance(a, b) {
    const first = toPoint(a);
    const second = toPoint(b);
    return first && second ? distances(first, second) : emptyDistance();
}

export function getDistanceToPlayer(x, y, z) {
    const feet = playerPosition();
    const target = toPoint(x, y, z);
    return feet && target ? distances(feet, target) : emptyDistance();
}

export function getDistanceToPlayerEyes(x, y, z) {
    const eyes = playerEyes();
    const target = toPoint(x, y, z);
    return eyes && target ? distances(eyes, target) : { distance: 0, distanceFlat: 0, differenceY: 0 };
}

export function getDistance(x1, y1, z1, x2, y2, z2) {
    const first = toPoint(x1, y1, z1);
    const second = toPoint(x2, y2, z2);
    return first && second ? distances(first, second) : emptyDistance();
}

export const fastDistance = (x1, y1, z1, x2, y2, z2) => Math.hypot(x1 - x2, y1 - y2, z1 - z2);

export const blockCenter = (x, y, z) => point(x + 0.5, y + 0.5, z + 0.5);

const relativeAngles = (target) => {
    const eyes = Player.getPlayer()?.getEyePosition();
    if (!target || !eyes) return { yaw: 0, pitch: 0 };

    const dx = target.x - eyes.x();
    const dy = target.y - eyes.y();
    const dz = target.z - eyes.z();
    return {
        yaw: wrapTo180(Math.atan2(dz, dx) * RAD_TO_DEG - 90 - Player.getYaw()),
        pitch: -Math.atan2(dy, Math.hypot(dx, dz)) * RAD_TO_DEG - Player.getPitch(),
    };
};

export function angleToPlayer(targetInput) {
    const target = toPoint(targetInput);
    if (!target) return { distance: 0, yaw: 0, pitch: 0, yawAbs: 0, pitchAbs: 0 };
    const { yaw, pitch } = relativeAngles(target);
    return { distance: Math.hypot(yaw, pitch), yaw, pitch, yawAbs: Math.abs(yaw), pitchAbs: Math.abs(pitch) };
}

export const getAngleDifference = (current, target) => wrapTo180(target - current);

export function calculateAngles(vec) {
    const target = toPoint(vec);
    return target ? relativeAngles(target) : { yaw: 0, pitch: 0 };
}

export function calculateAbsoluteAngles(vec) {
    const target = toPoint(vec);
    const eyes = Player.getPlayer()?.getEyePosition();
    if (!target || !eyes) return { yaw: 0, pitch: 0 };

    const dx = target.x - eyes.x();
    const dy = target.y - eyes.y();
    const dz = target.z - eyes.z();
    return {
        yaw: wrapTo180(Math.atan2(dz, dx) * RAD_TO_DEG - 90),
        pitch: Math.max(-90, Math.min(90, -Math.atan2(dy, Math.hypot(dx, dz)) * RAD_TO_DEG)),
    };
}
