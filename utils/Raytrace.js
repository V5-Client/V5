import { Vec3d } from './Constants';
import { wrapTo180 } from './Math';
import { raytraceBlocks } from './dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from './dependencies/BloomCore/Vector3';

const SAMPLE_POINTS_PER_FACE = 9;
const MAX_DDA_ITERATIONS = 300;
const AIR_BLOCK_ID = 0;
const PASSABLE_BLOCKS = new Set([0, 513]);

const RaycastContext = net.minecraft.world.level.ClipContext;
const faceOffsets = [[0.5, 0.5, 0.5]];
let eyeCache = { pos: null, time: 0 };

for (const { axis, value, otherAxes } of [
    { axis: 0, value: 0.05, otherAxes: [1, 2] },
    { axis: 0, value: 0.95, otherAxes: [1, 2] },
    { axis: 1, value: 0.05, otherAxes: [0, 2] },
    { axis: 1, value: 0.95, otherAxes: [0, 2] },
    { axis: 2, value: 0.05, otherAxes: [0, 1] },
    { axis: 2, value: 0.95, otherAxes: [0, 1] },
]) {
    const step = 0.8 / (SAMPLE_POINTS_PER_FACE - 1);
    for (let first = 0; first < SAMPLE_POINTS_PER_FACE; first++) {
        for (let second = 0; second < SAMPLE_POINTS_PER_FACE; second++) {
            const point = [0.5, 0.5, 0.5];
            point[axis] = value;
            point[otherAxes[0]] = 0.1 + first * step;
            point[otherAxes[1]] = 0.1 + second * step;
            faceOffsets.push(point);
        }
    }
}

export function getPlayerEyePosition() {
    const now = Date.now();
    if (eyeCache.pos && now - eyeCache.time < 50) return eyeCache.pos;
    const eye = Player.getPlayer()?.getEyePosition();
    if (!eye) return null;
    eyeCache = { pos: { x: eye.x(), y: eye.y(), z: eye.z() }, time: now };
    return eyeCache.pos;
}

const testPointNative = (targetX, targetY, targetZ, point, eye) => {
    try {
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world) return false;
        const result = world.clip(
            new RaycastContext(new Vec3d(eye.x, eye.y, eye.z), new Vec3d(...point), RaycastContext.Block.OUTLINE, RaycastContext.Fluid.NONE, player)
        );
        if (!result || String(result.getType?.()) === 'MISS') return false;
        const hit = result.getBlockPos();
        return hit?.getX() === targetX && hit?.getY() === targetY && hit?.getZ() === targetZ;
    } catch (error) {
        console.error(error);
        return false;
    }
};

export function testPointVisibility(targetX, targetY, targetZ, point, eye) {
    try {
        const dx = point[0] - eye.x;
        const dy = point[1] - eye.y;
        const dz = point[2] - eye.z;
        const distance = Math.hypot(dx, dy, dz);
        if (!distance) return false;
        const hit = raytraceBlocks(
            [eye.x, eye.y, eye.z],
            new Vector3(dx / distance, dy / distance, dz / distance),
            distance + 0.2,
            (block) => !!block?.type && block.type.getID() !== AIR_BLOCK_ID,
            true
        );
        return hit && hit[0] === targetX && hit[1] === targetY && hit[2] === targetZ;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export function getVisiblePoint(blockX, blockY, blockZ, useNative = true) {
    const eye = getPlayerEyePosition();
    if (!eye || Math.hypot(blockX + 0.5 - eye.x, blockY + 0.5 - eye.y, blockZ + 0.5 - eye.z) > 64) return null;

    for (const offset of faceOffsets) {
        const point = [blockX + offset[0], blockY + offset[1], blockZ + offset[2]];
        if (useNative ? testPointNative(blockX, blockY, blockZ, point, eye) : testPointVisibility(blockX, blockY, blockZ, point, eye)) return point;
    }
    return null;
}

export const getPointOnBlock = (block, useNative = true) => getVisiblePoint(block.x, block.y, block.z, useNative);

export function isLineClear(startX, startY, startZ, endX, endY, endZ, ignoreX, ignoreY, ignoreZ) {
    let x = Math.floor(startX);
    let y = Math.floor(startY);
    let z = Math.floor(startZ);
    const goalX = Math.floor(endX);
    const goalY = Math.floor(endY);
    const goalZ = Math.floor(endZ);
    if (x === goalX && y === goalY && z === goalZ) return true;

    const dx = endX - startX;
    const dy = endY - startY;
    const dz = endZ - startZ;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);
    const deltaX = dx ? Math.abs(1 / dx) : Infinity;
    const deltaY = dy ? Math.abs(1 / dy) : Infinity;
    const deltaZ = dz ? Math.abs(1 / dz) : Infinity;
    let maxX = dx ? (stepX > 0 ? x + 1 - startX : startX - x) / Math.abs(dx) : Infinity;
    let maxY = dy ? (stepY > 0 ? y + 1 - startY : startY - y) / Math.abs(dy) : Infinity;
    let maxZ = dz ? (stepZ > 0 ? z + 1 - startZ : startZ - z) / Math.abs(dz) : Infinity;

    for (let iterations = 0; iterations < MAX_DDA_ITERATIONS; iterations++) {
        if (maxX <= maxY && maxX <= maxZ) {
            x += stepX;
            maxX += deltaX;
        } else if (maxY <= maxZ) {
            y += stepY;
            maxY += deltaY;
        } else {
            z += stepZ;
            maxZ += deltaZ;
        }

        if (x !== ignoreX || y !== ignoreY || z !== ignoreZ) {
            const block = World.getBlockAt(x, y, z);
            if (!block?.type || !PASSABLE_BLOCKS.has(block.type.getID())) return false;
        }
        if (x === goalX && y === goalY && z === goalZ) return true;
    }
    return false;
}

export function getLookingAt(distance = 5) {
    try {
        const position = Player.getPlayer()?.pick(distance, 0, false)?.getBlockPos();
        if (!position) return null;
        const block = World.getBlockAt(position.getX(), position.getY(), position.getZ());
        return block?.type && block.type.getID() !== AIR_BLOCK_ID ? block : null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

const playerLookDirection = () => {
    const player = Player.getPlayer();
    if (!player) return null;
    const yaw = (-wrapTo180(player.getYRot()) * Math.PI) / 180;
    const pitch = (-player.getXRot() * Math.PI) / 180;
    const cosPitch = Math.cos(pitch);
    return { x: Math.sin(yaw) * cosPitch, y: Math.sin(pitch), z: Math.cos(yaw) * cosPitch };
};

const rayIntersectsBox = (origin, direction, box, maxDistance) => {
    let minDistance = 0;
    let max = maxDistance;
    for (const [position, delta, min, upper] of [
        [origin.x, direction.x, box.minX, box.maxX],
        [origin.y, direction.y, box.minY, box.maxY],
        [origin.z, direction.z, box.minZ, box.maxZ],
    ]) {
        if (Math.abs(delta) < 1e-8) {
            if (position < min || position > upper) return false;
            continue;
        }
        const first = (min - position) / delta;
        const second = (upper - position) / delta;
        minDistance = Math.max(minDistance, Math.min(first, second));
        max = Math.min(max, Math.max(first, second));
        if (minDistance > max) return false;
    }
    return minDistance <= max;
};

export function isLookingAtEntity(entity, maxDistance = 6) {
    const eye = getPlayerEyePosition();
    const direction = playerLookDirection();
    if (!eye || !direction) return false;
    try {
        const box = (entity.toMC ? entity.toMC() : entity).getBoundingBox();
        return !!box && rayIntersectsBox(eye, direction, box, maxDistance);
    } catch (error) {
        console.error(error);
        return false;
    }
}
