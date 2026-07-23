import { Utils } from '../Utils';

let lastActionTime = Date.now();

function setKeysBasedOnYaw(yaw, shouldJump) {
    Client.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;

    if (yaw > -50 && yaw < 50) Client.setKey('w', true);
    if (yaw > -135.5 && yaw < -7) Client.setKey('a', true);
    if (yaw > 7 && yaw < 135.5) Client.setKey('d', true);
    if (yaw > 135.5 || yaw < -135.5) Client.setKey('s', true);

    const motionScale = Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ());
    if (shouldJump && motionScale < 0.04 && Date.now() - lastActionTime > 500 && Utils.playerIsCollided()) {
        Client.setKey('space', true);
        lastActionTime = Date.now();
    }
}

function setKeysForStraightLine(yaw, shouldJump, ignoreBottomSlab) {
    Client.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;

    const quadrants = [
        { min: -22.5, max: 22.5, keys: ['w'] },
        { min: -67.5, max: -22.5, keys: ['w', 'a'] },
        { min: -112.5, max: -67.5, keys: ['a'] },
        { min: -157.5, max: -112.5, keys: ['a', 's'] },
        { min: -180, max: -157.5, keys: ['s'] },
        { min: 157.5, max: 180, keys: ['s'] },
        { min: 22.5, max: 67.5, keys: ['w', 'd'] },
        { min: 67.5, max: 112.5, keys: ['d'] },
        { min: 112.5, max: 157.5, keys: ['s', 'd'] },
    ];

    for (const { min, max, keys } of quadrants) {
        if (yaw >= min && yaw <= max) {
            keys.forEach((key) => Client.setKey(key, true));
            break;
        }
    }

    Client.setKey('space', !!shouldJump && Utils.playerIsCollided(!!ignoreBottomSlab));
}

function setKeysForStraightLineCoords(x, y, z, shouldJump, ignoreBottomSlab) {
    if (Client.isInGui() && !Client.isInChat()) return;

    const dx = x - Player.getX();
    const dz = z - Player.getZ();
    let angle = -(Math.atan2(dx, dz) * (180 / Math.PI)) - Player.getYaw();

    while (angle < -180) angle += 360;
    while (angle > 180) angle -= 360;

    setKeysForStraightLine(angle, shouldJump, ignoreBottomSlab);
}

export const Movement = { setKeysBasedOnYaw, setKeysForStraightLine, setKeysForStraightLineCoords };
