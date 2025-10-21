import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { Keybind } from '../../Utility/Keybinding';
import { PathfindingMessages } from '../PathConfig';
import {
    IGNORED_BLOCK_PATTERNS,
    PARTIAL_HEIGHT_BLOCKS,
} from '../PathConstants';

const STEP_HEIGHT = 0.6;

const mc = Client.getMinecraft();

const blockCache = new Map();
let cacheFrame = 0;

let currentJumpPoints = [];
const persistentJumpPoints = [];

register('tick', () => {
    cacheFrame++;
    if (blockCache.size > 1000) blockCache.clear();
});

function getCachedBlock(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(
        z
    )},${cacheFrame}`;
    if (!blockCache.has(key)) {
        blockCache.set(
            key,
            World.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z))
        );
    }
    return blockCache.get(key);
}

function isBlockPassable(block) {
    if (!block) return true;

    const id = block.type.getID();
    if (id === 0) return true;

    const registryName = block.type.getRegistryName().toLowerCase();

    for (const pattern of IGNORED_BLOCK_PATTERNS) {
        if (registryName == pattern) {
            return true;
        }
    }

    return false;
}

function isSolid(block) {
    if (!block) return false;
    const id = block.type.getID();
    if (id === 0) return false;

    const registryName = block.type.getRegistryName().toLowerCase();
    if (registryName.includes('water') || registryName.includes('lava'))
        return false;

    return !isBlockPassable(block);
}

function getBlockHeight(block) {
    if (!block) return 0;

    const id = block.type.getID();
    if (id === 0) return 0;

    if (isBlockPassable(block)) return 0;

    const registryName = block.type.getRegistryName().toLowerCase();

    for (const [key, height] of Object.entries(PARTIAL_HEIGHT_BLOCKS)) {
        if (registryName.includes(key)) {
            if (key === 'slab' && registryName.includes('double')) {
                return 1.0;
            }
            return height;
        }
    }

    return 1.0;
}

function getGroundHeight(x, y, z) {
    let block = getCachedBlock(x, y, z);
    if (isSolid(block)) {
        return y + getBlockHeight(block);
    }

    block = getCachedBlock(x, y - 1, z);
    if (isSolid(block)) {
        return y - 1 + getBlockHeight(block);
    }

    return y;
}

function hasLowCeiling(x, y, z) {
    const block2 = getCachedBlock(x, y + 2, z);
    const block3 = getCachedBlock(x, y + 3, z);

    if (isSolid(block2)) {
        const registryName = block2.type.getRegistryName().toLowerCase();
        if (registryName.includes('stair')) return false;

        const height2 = getBlockHeight(block2);
        if (height2 >= 0.9) return true;
    }

    if (isSolid(block3)) {
        const registryName = block3.type.getRegistryName().toLowerCase();
        if (registryName.includes('stair')) return false;

        const height3 = getBlockHeight(block3);
        if (height3 >= 0.9) return true;
    }

    return false;
}

function getPlayerFacingDirection() {
    const yaw = Player.getYaw();
    const radians = (yaw + 90) * (Math.PI / 180);

    const dirX = Math.cos(radians);
    const dirZ = Math.sin(radians);

    const dist2D = Math.sqrt(dirX * dirX + dirZ * dirZ);

    if (dist2D < 0.1) {
        return { dirX: 0, dirZ: 0 };
    }

    return {
        dirX: dirX / dist2D,
        dirZ: dirZ / dist2D,
    };
}

function checkStepUpRefactored(checkX, checkY, checkZ, currentGroundHeight) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    const blockHead = getCachedBlock(checkX, checkY + 1, checkZ);
    const blockBelow = getCachedBlock(checkX, checkY - 1, checkZ);

    if (isSolid(blockHead)) {
        return { shouldJump: false, reason: 'Ceiling block' };
    }

    let actualHeightDiff = 0;
    let targetGroundY = checkY;
    let targetBlockHeight = 0;
    let isStepUp = false;
    let blockToCheck = null;

    if (isSolid(blockFoot)) {
        targetBlockHeight = getBlockHeight(blockFoot);
        targetGroundY = checkY;
        blockToCheck = blockFoot;
        actualHeightDiff =
            targetGroundY + targetBlockHeight - currentGroundHeight;
        isStepUp = true;
    } else if (isSolid(blockBelow)) {
        targetBlockHeight = getBlockHeight(blockBelow);
        targetGroundY = checkY - 1;
        blockToCheck = blockBelow;
        actualHeightDiff =
            targetGroundY + targetBlockHeight - currentGroundHeight;
        isStepUp = true;
    }

    if (isStepUp) {
        if (blockToCheck) {
            const registryName = blockToCheck.type
                .getRegistryName()
                .toLowerCase();

            if (
                registryName.includes('stair') ||
                (registryName.includes('slab') && targetBlockHeight <= 0.5)
            ) {
                return { shouldJump: false, reason: 'Walkable stair/slab' };
            }
        }

        if (actualHeightDiff > STEP_HEIGHT) {
            return {
                shouldJump: true,
                reason: `step up ${actualHeightDiff.toFixed(2)}m`,
            };
        }
        return { shouldJump: false, reason: 'Walkable step' };
    }

    return { shouldJump: false, reason: null };
}

function checkGapRefactored(checkX, checkY, checkZ, currentGroundHeight) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    const blockBelow = getCachedBlock(checkX, checkY - 1, checkZ);

    if (isSolid(blockFoot) || isSolid(blockBelow)) {
        return { shouldJump: false, reason: null };
    }

    let fallDepth = 0;
    let destinationHeight = checkY;
    let destinationBlockHeight = 0;

    for (let d = 1; d <= 10; d++) {
        const blockAtDepth = getCachedBlock(checkX, checkY - d, checkZ);
        if (isSolid(blockAtDepth)) {
            fallDepth = d - 1;
            const destinationY = checkY - d;
            destinationBlockHeight = getBlockHeight(blockAtDepth);
            destinationHeight = destinationY + destinationBlockHeight;
            break;
        }
        fallDepth = d;
    }

    const actualHeightDiff = destinationHeight - currentGroundHeight;

    if (fallDepth === 0) {
        if (actualHeightDiff >= -0.5) {
            return {
                shouldJump: true,
                reason: `1-block horizontal gap/small drop`,
            };
        }
    }

    return { shouldJump: false, reason: null };
}

export function shouldJump() {
    if (!Player.getPlayer().isOnGround())
        return { shouldJump: false, jumpPoints: [] };

    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    const pX = Math.floor(playerPos.x);
    const pY = Math.floor(playerPos.y);
    const pZ = Math.floor(playerPos.z);

    if (hasLowCeiling(pX, pY, pZ)) return { shouldJump: false, jumpPoints: [] };

    const currentGroundHeight = getGroundHeight(pX, pY, pZ);
    const { dirX, dirZ } = getPlayerFacingDirection();

    if (dirX === 0 && dirZ === 0) return { shouldJump: false, jumpPoints: [] };

    const checkPoints = [
        { x: dirX * 0.7, z: dirZ * 0.7 },
        { x: dirX * 1.0, z: dirZ * 1.0 },
    ];

    const jumpPoints = [];

    for (let i = 0; i < checkPoints.length; i++) {
        const offset = checkPoints[i];
        const checkX = Math.floor(playerPos.x + offset.x);
        const checkZ = Math.floor(playerPos.z + offset.z);

        if (checkX === pX && checkZ === pZ) continue;
        if (hasLowCeiling(checkX, pY, checkZ)) continue;

        const stepResult = checkStepUpRefactored(
            checkX,
            pY,
            checkZ,
            currentGroundHeight
        );
        if (stepResult.shouldJump) {
            const blockFoot = getCachedBlock(checkX, pY, checkZ);
            const targetY = isSolid(blockFoot) ? pY : pY - 1;
            jumpPoints.push({ x: checkX, y: targetY, z: checkZ });
        }

        const gapResult = checkGapRefactored(
            checkX,
            pY,
            checkZ,
            currentGroundHeight
        );

        if (gapResult.shouldJump) {
            jumpPoints.push({ x: checkX, y: pY, z: checkZ });
        }
    }

    if (jumpPoints.length > 0) {
        return { shouldJump: true, jumpPoints };
    }

    return { shouldJump: false, jumpPoints: [] };
}

export function pathMovement() {
    const player = Player.getPlayer();
    if (!player) {
        currentJumpPoints = [];
        return { running: false };
    }

    const jumpCheckResult = shouldJump();

    currentJumpPoints = jumpCheckResult.jumpPoints;

    if (jumpCheckResult.shouldJump) {
        PathfindingMessages('Detected a jump position!');
        Keybind.setKey('space', true);
        Keybind.setKey('w', true);

        jumpCheckResult.jumpPoints.forEach((point) => {
            const key = `${point.x},${point.y},${point.z}`;
            if (
                !persistentJumpPoints.some(
                    (p) => `${p.x},${p.y},${p.z}` === key
                )
            ) {
                persistentJumpPoints.push(point);
            }
        });
    } else {
        Keybind.setKey('space', false);
        mc.options.sprintKey.setPressed(false);
    }

    return { running: true };
}

export function stopMovement() {
    try {
        mc.options.forwardKey.setPressed(false);
        mc.options.jumpKey.setPressed(false);
        mc.options.sprintKey.setPressed(true);
    } catch (e) {
        console.error('[PathMovement] Error stopping movement:', e);
    }
}

register('postRenderWorld', () => {
    if (persistentJumpPoints.length > 0) {
        persistentJumpPoints.forEach((point) => {
            const vec3d = new Vec3d(point.x, point.y, point.z);
            RenderUtils.drawBox(vec3d, [255, 0, 0, 255]);
        });
    }

    if (currentJumpPoints.length > 0) {
        currentJumpPoints.forEach((point) => {
            const vec3d = new Vec3d(point.x, point.y, point.z);
            RenderUtils.drawBox(vec3d, [0, 255, 0, 255]);
        });
    }
});
