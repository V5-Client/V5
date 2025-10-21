import { pathState } from './PathState';
import { PathfindingMessages } from '../PathConfig';
import { detectAndRecoverStuck } from './PathStuckRecovery';

const STEP_HEIGHT = 0.6;
const MIN_TICKS_BETWEEN_JUMPS = 3;

const IGNORED_BLOCK_PATTERNS = [
    'minecraft:air',
    'minecraft:portal',
    'minecraft:end_portal',
    'minecraft:fire',
    'minecraft:web',
    'minecraft:tallgrass',
    'minecraft:double_plant',
    'minecraft:yellow_flower',
    'minecraft:red_flower',
    'minecraft:brown_mushroom',
    'minecraft:red_mushroom',
    'minecraft:sapling',
    'minecraft:reeds',
    'minecraft:wheat',
    'minecraft:carrots',
    'minecraft:potatoes',
    'minecraft:beetroots',
    'minecraft:melon_stem',
    'minecraft:pumpkin_stem',
    'minecraft:nether_wart',
    'minecraft:deadbush',
    'minecraft:vine',
    'minecraft:ladder',
    'minecraft:torch',
    'minecraft:wall_torch',
    'minecraft:redstone_torch',
    'minecraft:lever',
    'minecraft:stone_button',
    'minecraft:wooden_button',
    'minecraft:sign',
    'minecraft:wall_sign',
    'minecraft:tripwire',
    'minecraft:tripwire_hook',
    'minecraft:string',
    'minecraft:carpet',
    'minecraft:flower_pot',
    'minecraft:skull',
    'minecraft:item_frame',
    'minecraft:painting',
    'minecraft:lily_pad',
    'minecraft:rail',
    'minecraft:player_head',
];

const PARTIAL_HEIGHT_BLOCKS = {
    slab: 0.5,
    snow_layer: 0.5,
    snow: 0.5,
    farmland: 0.9375,
    grass_path: 0.9375,
    dirt_path: 0.9375,
    carpet: 0.0625,
    pressure_plate: 0.0625,
    enchanting_table: 0.75,
    daylight_detector: 0.375,
    waterlily: 0.015625,
    lily_pad: 0.015625,
    cauldron: 0.3125,
    bed: 0.5625,
    chest: 0.875,
    ender_chest: 0.875,
    trapped_chest: 0.875,
    hopper: 0.625,
    soul_sand: 0.875,
    honey_block: 1.0,
    composter: 0.9375,
    lectern: 0.875,
    grindstone: 0.875,
    stonecutter: 0.5625,
    bell: 1.0,
    anvil: 1.0,
};

const mc = Client.getMinecraft();

const blockCache = new Map();
let cacheFrame = 0;

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
        if (registryName.includes('stairs')) return false;

        const height2 = getBlockHeight(block2);
        if (height2 >= 0.9) return true;
    }

    if (isSolid(block3)) {
        const registryName = block3.type.getRegistryName().toLowerCase();
        if (registryName.includes('stairs')) return false;

        const height3 = getBlockHeight(block3);
        if (height3 >= 0.9) return true;
    }

    return false;
}

function getDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);

    if (dist2D < 0.1) {
        return { dirX: 0, dirZ: 0 };
    }

    return {
        dirX: dx / dist2D,
        dirZ: dz / dist2D,
    };
}

function checkStepUp(checkX, checkY, checkZ, currentGroundHeight) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    const blockHead = getCachedBlock(checkX, checkY + 1, checkZ);

    if (!isSolid(blockFoot) || isSolid(blockHead)) {
        return { shouldJump: false, reason: null };
    }

    const targetGroundHeight = checkY + getBlockHeight(blockFoot);
    const actualHeightDiff = targetGroundHeight - currentGroundHeight;

    if (actualHeightDiff > STEP_HEIGHT) {
        return {
            shouldJump: true,
            reason: `step up ${actualHeightDiff.toFixed(2)}m`,
        };
    }

    return { shouldJump: false, reason: null };
}

function checkGap(checkX, checkY, checkZ, currentGroundHeight) {
    const blockFoot = getCachedBlock(checkX, checkY, checkZ);
    const blockBelow = getCachedBlock(checkX, checkY - 1, checkZ);

    if (isSolid(blockFoot) || isSolid(blockBelow)) {
        return { shouldJump: false, reason: null };
    }

    let fallDepth = 0;
    let destinationHeight = checkY;

    for (let d = 1; d <= 10; d++) {
        const blockAtDepth = getCachedBlock(checkX, checkY - d, checkZ);
        if (isSolid(blockAtDepth)) {
            fallDepth = d - 1;
            destinationHeight = checkY - d + getBlockHeight(blockAtDepth);
            break;
        }
        fallDepth = d;
    }

    const actualHeightDiff = destinationHeight - currentGroundHeight;

    if (actualHeightDiff > -STEP_HEIGHT || fallDepth > 2) {
        const { boxPositions, currentBoxIndex } = pathState;
        const nextBox =
            boxPositions[
                Math.min(currentBoxIndex + 1, boxPositions.length - 1)
            ];

        if (nextBox) {
            const playerY = Player.getY();
            const pathYDiff = nextBox.y - playerY;

            if (pathYDiff > STEP_HEIGHT || fallDepth > 2) {
                return {
                    shouldJump: true,
                    reason: `gap with ${fallDepth} block fall`,
                };
            }
        }
    }

    return { shouldJump: false, reason: null };
}

function shouldJump() {
    if (
        !pathState.isOnGround ||
        pathState.ticksSinceLastJump < MIN_TICKS_BETWEEN_JUMPS
    ) {
        return false;
    }

    const { boxPositions, currentBoxIndex } = pathState;
    if (!boxPositions || currentBoxIndex >= boxPositions.length - 1) {
        return false;
    }

    const playerPos = {
        x: Player.getX(),
        y: Player.getY(),
        z: Player.getZ(),
    };

    const pX = Math.floor(playerPos.x);
    const pY = Math.floor(playerPos.y);
    const pZ = Math.floor(playerPos.z);

    if (hasLowCeiling(pX, pY, pZ)) {
        return false;
    }

    const currentGroundHeight = getGroundHeight(pX, pY - 1, pZ);
    const targetBox =
        boxPositions[Math.min(currentBoxIndex + 2, boxPositions.length - 1)];
    const { dirX, dirZ } = getDirection(playerPos, targetBox);

    if (dirX === 0 && dirZ === 0) {
        return false;
    }

    const checkPoints = [
        { x: dirX * 0.5, z: dirZ * 0.5 },
        { x: dirX * 0.7, z: dirZ * 0.7 },
        { x: dirX * 1.0, z: dirZ * 1.0 },
        { x: dirX * 0.5 + dirZ * 0.3, z: dirZ * 0.5 - dirX * 0.3 },
        { x: dirX * 0.5 - dirZ * 0.3, z: dirZ * 0.5 + dirX * 0.3 },
    ];

    for (const offset of checkPoints) {
        const checkX = Math.floor(playerPos.x + offset.x);
        const checkZ = Math.floor(playerPos.z + offset.z);

        if (checkX === pX && checkZ === pZ) continue;
        if (hasLowCeiling(checkX, pY, checkZ)) continue;

        const stepResult = checkStepUp(checkX, pY, checkZ, currentGroundHeight);
        if (stepResult.shouldJump) {
            PathfindingMessages(`§e[Jump] ${stepResult.reason}`);
            return true;
        }

        const gapResult = checkGap(checkX, pY, checkZ, currentGroundHeight);
        if (gapResult.shouldJump) {
            PathfindingMessages(`§e[Jump] ${gapResult.reason}`);
            return true;
        }
    }

    return false;
}

function updateGroundState() {
    const player = Player.getPlayer();
    if (!player) return;

    const onGround = player.isOnGround();

    if (!onGround) {
        pathState.wasInAir = true;
        pathState.isOnGround = false;
    } else if (pathState.wasInAir) {
        pathState.wasInAir = false;
        pathState.isOnGround = true;
        pathState.ticksSinceLastJump = 0;
        PathfindingMessages('§a[Movement] Landed');
    } else {
        pathState.isOnGround = true;
    }

    pathState.ticksSinceLastJump++;
}

export function pathMovement() {
    if (!pathState.isWalking) {
        return { complete: false, stuck: false, recovered: false };
    }

    const player = Player.getPlayer();
    if (!player) {
        return { complete: false, stuck: false, recovered: false };
    }

    if (pathState.currentBoxIndex >= pathState.boxPositions.length - 1) {
        stopMovement();
        return { complete: true, stuck: false, recovered: false };
    }

    updateGroundState();

    mc.options.forwardKey.setPressed(true);
    mc.options.sprintKey.setPressed(true);

    if (shouldJump()) {
        mc.options.jumpKey.setPressed(true);
        pathState.ticksSinceLastJump = 0;
    } else {
        mc.options.jumpKey.setPressed(false);
    }

    const { stuck, recovered } = detectAndRecoverStuck();

    return { complete: false, stuck, recovered };
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
