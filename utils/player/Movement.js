import { Utils } from '../Utils';

let lastActionTime = Date.now();

function setKeysBasedOnYaw(yaw, shouldJump) {
    if (Client.isInGui() && !Client.isInChat()) {
        Client.stopMovement();
        return;
    }

    Client.setKey('w', yaw > -50 && yaw < 50);
    Client.setKey('a', yaw > -135.5 && yaw < -7);
    Client.setKey('d', yaw > 7 && yaw < 135.5);
    Client.setKey('s', yaw > 135.5 || yaw < -135.5);

    const motionScale = Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ());
    const jump = shouldJump && motionScale < 0.04 && Date.now() - lastActionTime > 500 && Utils.playerIsCollided();
    Client.setKey('space', jump);
    if (jump) lastActionTime = Date.now();
}

function setKeysForStraightLine(yaw, shouldJump, ignoreBottomSlab) {
    if (Client.isInGui() && !Client.isInChat()) {
        Client.stopMovement();
        return;
    }

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

    const keys = quadrants.find(({ min, max }) => yaw >= min && yaw <= max)?.keys ?? [];
    ['w', 'a', 's', 'd'].forEach((key) => Client.setKey(key, keys.includes(key)));

    Client.setKey('space', !!shouldJump && Utils.playerIsCollided(!!ignoreBottomSlab));
}

function setKeysForStraightLineCoords(x, y, z, shouldJump, ignoreBottomSlab) {
    const dx = x - Player.getX();
    const dz = z - Player.getZ();
    let angle = -(Math.atan2(dx, dz) * (180 / Math.PI)) - Player.getYaw();

    while (angle < -180) angle += 360;
    while (angle > 180) angle -= 360;

    setKeysForStraightLine(angle, shouldJump, ignoreBottomSlab);
}

export const Movement = { setKeysBasedOnYaw, setKeysForStraightLine, setKeysForStraightLineCoords };
