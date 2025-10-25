import { raytraceBlocks } from '../Dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from '../Dependencies/BloomCore/Vector3';

const Vec3 = net.minecraft.util.math.Vec3d;

class rayTraceUtils {
    constructor() {
        this.defaultPoints = [
            [0.5, 0.5, 0.5], // Center
            [0.1, 0.5, 0.5],
            [0.9, 0.5, 0.5], // X-axis
            [0.5, 0.1, 0.5],
            [0.5, 0.9, 0.5], // Y-axis
            [0.5, 0.5, 0.1],
            [0.5, 0.5, 0.9], // Z-axis
        ];
    }

    /**
     * Generates optimized points on a block for visibility checking.
     * @param {BlockPos} pos - The block position
     * @returns {Array} Array of [x, y, z] points
     */
    getPointsOnBlock(pos) {
        return this.defaultPoints.map((p) => [
            pos.x + p[0],
            pos.y + p[1],
            pos.z + p[2],
        ]);
    }

    /**
     * Checks if a block is not air.
     * @param {Block} block - The block to check
     * @returns {boolean} True if block is not air
     */
    check(block) {
        return block && block.type.getID() !== 0;
    }

    /**
     * Finds a visible point on a block from the player's eye position.
     * @param {BlockPos} blockPos - The block to check
     * @param {Vec3} vector - The starting position (defaults to player eye position)
     * @param {boolean} useNativeRaycast - Use Minecraft's native raycast (faster)
     * @returns {Array|null} The [x, y, z] coordinates of the visible point, or null
     */
    getPointOnBlock(
        blockPos,
        vector = Player.getPlayer().getEyePos(),
        useNativeRaycast = true
    ) {
        const points = this.getPointsOnBlock(blockPos);

        for (const point of points) {
            const isVisible = useNativeRaycast
                ? this.canSeePointMC(blockPos, point)
                : this.canSeePointJS(blockPos, point);

            if (isVisible) {
                return point;
            }
        }
        return null;
    }

    /**
     * @param {BlockPos} blockPos - The block position to check
     * @param {Vec3} eyePos - The eye position (defaults to player's eye position)
     * @param {boolean} useNativeRaycast - Use Minecraft's native raycast (faster, default: true)
     * @returns {boolean} True if the block is visible to the player
     */
    isBlockVisible(blockPos, eyePos = null, useNativeRaycast = true) {
        if (!eyePos) {
            const player = Player.getPlayer();
            if (!player) return false;
            const pos = player.getEyePos();
            if (!pos) return false;
            eyePos = { x: pos.x, y: pos.y, z: pos.z };
        }

        const dx = blockPos.x + 0.5 - eyePos.x;
        const dy = blockPos.y + 0.5 - eyePos.y;
        const dz = blockPos.z + 0.5 - eyePos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > 1000) return false;

        return (
            this.getPointOnBlock(blockPos, eyePos, useNativeRaycast) !== null
        );
    }

    /**
     * Checks visibility using JavaScript raytracer.
     * @private
     */
    canSeePointJS(blockPos, point, vector = Player.getPlayer().getEyePos()) {
        const dx = point[0] - vector.x;
        const dy = point[1] - vector.y;
        const dz = point[2] - vector.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const direction = new Vector3(
            dx / distance,
            dy / distance,
            dz / distance
        );

        const castResult = raytraceBlocks(
            [vector.x, vector.y, vector.z],
            direction,
            distance + 0.1,
            this.check,
            true
        );

        return (
            castResult &&
            castResult[0] === blockPos.x &&
            castResult[1] === blockPos.y &&
            castResult[2] === blockPos.z
        );
    }

    /**
     * Checks visibility using Minecraft's built-in raycaster via Player.raycast because ClipContext is complete bullshit
     * @private
     */
    canSeePointMC(blockPos, point, vector = Player.getPlayer().getEyePos()) {
        const player = Player.getPlayer();
        if (!player) return false;

        if (!vector) {
            const pos = player.getEyePos();
            if (!pos) return false;
            vector = { x: pos.x, y: pos.y, z: pos.z };
        }

        const dx = point[0] - vector.x;
        const dy = point[1] - vector.y;
        const dz = point[2] - vector.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const result = player.raycast(distance, 0.0, false);
        if (!result) return false;

        const hitPos = result.getBlockPos();
        if (!hitPos) return false;

        return (
            hitPos.getX() === blockPos.x &&
            hitPos.getY() === blockPos.y &&
            hitPos.getZ() === blockPos.z
        );
    }

    /**
     * Returns blocks in the player's line of sight.
     */
    rayTracePlayerBlocks(reach = 60, checkFunction = null) {
        const eyes = Player.getPlayer().getEyePos();
        return raytraceBlocks(
            [eyes.x, eyes.y, eyes.z],
            null,
            reach,
            checkFunction,
            false,
            false
        );
    }

    /**
     * Returns all blocks traversed between two points.
     */
    rayTraceBetweenPoints(begin, end) {
        const dx = end[0] - begin[0];
        const dy = end[1] - begin[1];
        const dz = end[2] - begin[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const direction = new Vector3(
            dx / distance,
            dy / distance,
            dz / distance
        );

        return raytraceBlocks(begin, direction, distance, null, false, false);
    }

    /**
     * Fast, allocation-free voxel traversal between two points.
     * Returns true if all traversed blocks (excluding the ignore cell) are non-solid.
     * Uses Amanatides & Woo 3D DDA algorithm.
     * @param {number} sx
     * @param {number} sy
     * @param {number} sz
     * @param {number} ex
     * @param {number} ey
     * @param {number} ez
     * @param {number} ignoreX - cell to treat as passable (usually target block x)
     * @param {number} ignoreY
     * @param {number} ignoreZ
     * @returns {boolean}
     */
    isLineClear(sx, sy, sz, ex, ey, ez, ignoreX, ignoreY, ignoreZ) {
        let cx = Math.floor(sx),
            cy = Math.floor(sy),
            cz = Math.floor(sz);
        const exv = Math.floor(ex),
            eyv = Math.floor(ey),
            ezv = Math.floor(ez);

        if (cx === exv && cy === eyv && cz === ezv) return true;

        const dx = ex - sx;
        const dy = ey - sy;
        const dz = ez - sz;

        let stepX = 0,
            stepY = 0,
            stepZ = 0,
            tMaxX = Infinity,
            tMaxY = Infinity,
            tMaxZ = Infinity,
            tDeltaX = Infinity,
            tDeltaY = Infinity,
            tDeltaZ = Infinity;

        if (dx > 0) {
            stepX = 1;
            tMaxX = (cx + 1 - sx) / dx;
            tDeltaX = 1 / dx;
        } else if (dx < 0) {
            stepX = -1;
            tMaxX = (sx - cx) / -dx;
            tDeltaX = 1 / -dx;
        }
        if (dy > 0) {
            stepY = 1;
            tMaxY = (cy + 1 - sy) / dy;
            tDeltaY = 1 / dy;
        } else if (dy < 0) {
            stepY = -1;
            tMaxY = (sy - cy) / -dy;
            tDeltaY = 1 / -dy;
        }
        if (dz > 0) {
            stepZ = 1;
            tMaxZ = (cz + 1 - sz) / dz;
            tDeltaZ = 1 / dz;
        } else if (dz < 0) {
            stepZ = -1;
            tMaxZ = (sz - cz) / -dz;
            tDeltaZ = 1 / -dz;
        }

        let steps = 0;
        const maxSteps = 256;

        while (cx !== exv || cy !== eyv || cz !== ezv) {
            if (steps++ > maxSteps) return false;

            const minT = Math.min(tMaxX, tMaxY, tMaxZ);

            if (minT === tMaxX) {
                cx += stepX;
                tMaxX += tDeltaX;
            } else if (minT === tMaxY) {
                cy += stepY;
                tMaxY += tDeltaY;
            } else {
                //  (minT === tMaxZ)
                cz += stepZ;
                tMaxZ += tDeltaZ;
            }
            if (!(cx === ignoreX && cy === ignoreY && cz === ignoreZ)) {
                const blkX = World.getBlockAt(cx, cy, cz);
                if (blkX && blkX.type.getID() !== 0) return false;
            }
            if (cx === exv && cy === eyv && cz === ezv) break;
        }

        return true;
    }

    /**
     * Uses the player's built-in raycast to find the block they're looking at.
     */
    raytrace(dist = 5) {
        const castResult = Player.getPlayer().raycast(dist, 0.0, false);
        if (!castResult) return null;

        const blockPos = castResult.getBlockPos();
        if (!blockPos) return null;

        const blockAt = World.getBlockAt(
            blockPos.getX(),
            blockPos.getY(),
            blockPos.getZ()
        );
        return blockAt && blockAt.type.getID() !== 0 ? blockAt : null;
    }
}

export const RayTrace = new rayTraceUtils();
