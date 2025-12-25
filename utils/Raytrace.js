import { raytraceBlocks } from '../utils/Dependencies/BloomCore/RaytraceBlocks';
import { Vector3 } from '../utils/Dependencies/BloomCore/Vector3';

export const SAMPLE_POINTS_PER_FACE = 9;
export const MAX_DDA_ITERATIONS = 300;
export const AIR_BLOCK_ID = 0;
export const PASSABLE_BLOCKS = new Set([0, 513]);

class VisibilityChecker {
    constructor() {
        this.faceOffsets = this.generateFaceOffsets();
        this.eyeCache = { pos: null, time: 0 };
    }

    generateFaceOffsets() {
        let offsets = [];
        
        offsets.push([0.5, 0.5, 0.5]);
        
        let faceConfigs = [
            { axis: 0, value: 0.05, otherAxes: [1, 2] },
            { axis: 0, value: 0.95, otherAxes: [1, 2] },
            { axis: 1, value: 0.05, otherAxes: [0, 2] },
            { axis: 1, value: 0.95, otherAxes: [0, 2] },
            { axis: 2, value: 0.05, otherAxes: [0, 1] },
            { axis: 2, value: 0.95, otherAxes: [0, 1] },
        ];

        for (var i = 0; i < faceConfigs.length; i++) {
            let config = faceConfigs[i];
            let step = 0.8 / (SAMPLE_POINTS_PER_FACE - 1);

            for (var j = 0; j < SAMPLE_POINTS_PER_FACE; j++) {
                let offset1 = 0.1 + j * step;
                
                for (var k = 0; k < SAMPLE_POINTS_PER_FACE; k++) {
                    let offset2 = 0.1 + k * step;
                    let point = [0.5, 0.5, 0.5];
                    
                    point[config.axis] = config.value;
                    point[config.otherAxes[0]] = offset1;
                    point[config.otherAxes[1]] = offset2;
                    
                    offsets.push(point);
                }
            }
        }

        return offsets;
    }

    getPlayerEyePosition() {
        let now = Date.now();
        if (this.eyeCache.pos && now - this.eyeCache.time < 50) {
            return this.eyeCache.pos;
        }

        let player = Player.getPlayer();
        if (!player) return null;

        let eyePos = player.getEyePos();
        if (!eyePos) return null;

        this.eyeCache.pos = { x: eyePos.x, y: eyePos.y, z: eyePos.z };
        this.eyeCache.time = now;

        return this.eyeCache.pos;
    }

    checkBlockVisibility(blockX, blockY, blockZ, useMinecraftRaycast) {
        let eyePos = this.getPlayerEyePosition();
        if (!eyePos) return null;

        let dx = blockX + 0.5 - eyePos.x;
        let dy = blockY + 0.5 - eyePos.y;
        let dz = blockZ + 0.5 - eyePos.z;
        let distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq > 4096) {
            return null;
        }

        for (var i = 0; i < this.faceOffsets.length; i++) {
            let offset = this.faceOffsets[i];
            let testPoint = [blockX + offset[0], blockY + offset[1], blockZ + offset[2]];

            let visible = useMinecraftRaycast
                ? this.testPointNative(blockX, blockY, blockZ, testPoint, eyePos)
                : this.testPointCustom(blockX, blockY, blockZ, testPoint, eyePos);

            if (visible) {
                return testPoint;
            }
        }

        return null;
    }

    testPointNative(targetX, targetY, targetZ, point, eyePos) {
        try {
            let player = Player.getPlayer();
            if (!player) return false;

            let px = point[0] - eyePos.x;
            let py = point[1] - eyePos.y;
            let pz = point[2] - eyePos.z;
            let distance = Math.sqrt(px * px + py * py + pz * pz);

            let result = player.raycast(distance + 0.1, 0.0, false);
            if (!result) return false;

            let hitPos = result.getBlockPos();
            if (!hitPos) return false;

            return hitPos.getX() === targetX && hitPos.getY() === targetY && hitPos.getZ() === targetZ;
        } catch (err) {
            return false;
        }
    }

    testPointCustom(targetX, targetY, targetZ, point, eyePos) {
        try {
            let dx = point[0] - eyePos.x;
            let dy = point[1] - eyePos.y;
            let dz = point[2] - eyePos.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            let dir = new Vector3(dx / dist, dy / dist, dz / dist);

            let hit = raytraceBlocks([eyePos.x, eyePos.y, eyePos.z], dir, dist + 0.2, this.nonAirFilter, true);

            return hit && hit[0] === targetX && hit[1] === targetY && hit[2] === targetZ;
        } catch (err) {
            return false;
        }
    }

    nonAirFilter(block) {
        return block && block.type && block.type.getID() !== AIR_BLOCK_ID;
    }
}

class VoxelTraverser {
    checkLineClearance(startX, startY, startZ, endX, endY, endZ, ignoreX, ignoreY, ignoreZ) {
        let currentX = Math.floor(startX);
        let currentY = Math.floor(startY);
        let currentZ = Math.floor(startZ);

        let goalX = Math.floor(endX);
        let goalY = Math.floor(endY);
        let goalZ = Math.floor(endZ);

        if (currentX === goalX && currentY === goalY && currentZ === goalZ) {
            return true;
        }

        let deltaX = endX - startX;
        let deltaY = endY - startY;
        let deltaZ = endZ - startZ;

        let stepDirectionX = 0;
        let stepDirectionY = 0;
        let stepDirectionZ = 0;
        let nextCrossingX = Infinity;
        let nextCrossingY = Infinity;
        let nextCrossingZ = Infinity;
        let crossingIncrementX = Infinity;
        let crossingIncrementY = Infinity;
        let crossingIncrementZ = Infinity;

        if (deltaX > 0) {
            stepDirectionX = 1;
            nextCrossingX = (currentX + 1 - startX) / deltaX;
            crossingIncrementX = 1 / deltaX;
        } else if (deltaX < 0) {
            stepDirectionX = -1;
            nextCrossingX = (startX - currentX) / -deltaX;
            crossingIncrementX = 1 / -deltaX;
        }

        if (deltaY > 0) {
            stepDirectionY = 1;
            nextCrossingY = (currentY + 1 - startY) / deltaY;
            crossingIncrementY = 1 / deltaY;
        } else if (deltaY < 0) {
            stepDirectionY = -1;
            nextCrossingY = (startY - currentY) / -deltaY;
            crossingIncrementY = 1 / -deltaY;
        }

        if (deltaZ > 0) {
            stepDirectionZ = 1;
            nextCrossingZ = (currentZ + 1 - startZ) / deltaZ;
            crossingIncrementZ = 1 / deltaZ;
        } else if (deltaZ < 0) {
            stepDirectionZ = -1;
            nextCrossingZ = (startZ - currentZ) / -deltaZ;
            crossingIncrementZ = 1 / -deltaZ;
        }

        let iterationCount = 0;

        while (currentX !== goalX || currentY !== goalY || currentZ !== goalZ) {
            if (iterationCount++ > MAX_DDA_ITERATIONS) {
                return false;
            }

            let minCrossing = Math.min(nextCrossingX, nextCrossingY, nextCrossingZ);

            if (minCrossing === nextCrossingX) {
                currentX = currentX + stepDirectionX;
                nextCrossingX = nextCrossingX + crossingIncrementX;
            } else if (minCrossing === nextCrossingY) {
                currentY = currentY + stepDirectionY;
                nextCrossingY = nextCrossingY + crossingIncrementY;
            } else {
                currentZ = currentZ + stepDirectionZ;
                nextCrossingZ = nextCrossingZ + crossingIncrementZ;
            }

            if (currentX !== ignoreX || currentY !== ignoreY || currentZ !== ignoreZ) {
                let blockId = World.getBlockAt(currentX, currentY, currentZ).type.getID();
                
                if (!PASSABLE_BLOCKS.has(blockId)) {
                    return false;
                }
            }

            if (currentX === goalX && currentY === goalY && currentZ === goalZ) {
                break;
            }
        }

        return true;
    }
}

class BlockScanner {
    constructor() {
        this.visibilityChecker = new VisibilityChecker();
    }

    scanPlayerView(maxDistance, filterFunction) {
        let eyePos = this.visibilityChecker.getPlayerEyePosition();
        if (!eyePos) return [];

        let filterFunc = filterFunction || function (block) {
            return block && block.type && block.type.getID() !== AIR_BLOCK_ID;
        };

        return raytraceBlocks([eyePos.x, eyePos.y, eyePos.z], null, maxDistance, filterFunc, false, false);
    }

    scanBetweenPoints(point1, point2) {
        let dx = point2[0] - point1[0];
        let dy = point2[1] - point1[1];
        let dz = point2[2] - point1[2];
        let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance === 0) return [];

        let direction = new Vector3(dx / distance, dy / distance, dz / distance);

        return raytraceBlocks(point1, direction, distance, null, false, false);
    }

    findLookingAtBlock(maxDistance) {
        maxDistance = maxDistance || 5;

        try {
            let player = Player.getPlayer();
            if (!player) return null;

            let result = player.raycast(maxDistance, 0.0, false);
            if (!result) return null;

            let blockPos = result.getBlockPos();
            if (!blockPos) return null;

            let block = World.getBlockAt(blockPos.getX(), blockPos.getY(), blockPos.getZ());
            
            return block && block.type.getID() !== AIR_BLOCK_ID ? block : null;
        } catch (err) {
            return null;
        }
    }
}

export const visibilityChecker = new VisibilityChecker();
export const voxelTraverser = new VoxelTraverser();
export const blockScanner = new BlockScanner();

export const RayTrace = {
    getVisiblePoint: function (blockX, blockY, blockZ, useNative) {
        useNative = useNative !== false;
        return visibilityChecker.checkBlockVisibility(blockX, blockY, blockZ, useNative);
    },

    isBlockVisible: function (blockX, blockY, blockZ, useNative) {
        useNative = useNative !== false;
        return visibilityChecker.checkBlockVisibility(blockX, blockY, blockZ, useNative) !== null;
    },

    isLineClear: function (startX, startY, startZ, endX, endY, endZ, ignoreX, ignoreY, ignoreZ) {
        return voxelTraverser.checkLineClearance(startX, startY, startZ, endX, endY, endZ, ignoreX, ignoreY, ignoreZ);
    },

    scanBlocks: function (maxDistance, filter) {
        return blockScanner.scanPlayerView(maxDistance, filter);
    },

    scanPath: function (start, end) {
        return blockScanner.scanBetweenPoints(start, end);
    },

    getLookingAt: function (distance) {
        return blockScanner.findLookingAtBlock(distance);
    },

    clearCache: function () {
        visibilityChecker.eyeCache = { pos: null, time: 0 };
    },
};
