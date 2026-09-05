import { playerIsCollided } from '../Utils';

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

    Client.setKey('space', !!shouldJump && playerIsCollided(!!ignoreBottomSlab));
}

export function setKeysForStraightLineCoords(x, y, z, shouldJump, ignoreBottomSlab) {
    if (Client.isInGui() && !Client.isInChat()) return;

    const dx = x - Player.getX();
    const dz = z - Player.getZ();
    let angle = -(Math.atan2(dx, dz) * (180 / Math.PI)) - Player.getYaw();

    while (angle < -180) angle += 360;
    while (angle > 180) angle -= 360;

    setKeysForStraightLine(angle, shouldJump, ignoreBottomSlab);
}
