import { Vector3 } from './Vector3';

export const raytraceBlocks = (
    startPos = null,
    directionVector = null,
    distance = 60,
    blockCheckFunc = null,
    returnWhenTrue = false,
    stopWhenNotAir = true
) => {
    if (!startPos) startPos = getPlayerEyeCoords();
    if (!directionVector) directionVector = getPlayerLookVec();
    if (!startPos || !directionVector) return returnWhenTrue ? null : [];

    // Ensure directionVector is normalized
    const normalizedDir = directionVector.normalize();
    const endPos = normalizedDir
        .multiply(distance)
        .add(new Vector3(...startPos))
        .getComponents();

    return traverseVoxels(startPos, endPos, blockCheckFunc, returnWhenTrue, stopWhenNotAir);
};

export const getPlayerEyeCoords = (forceSneak = false) => {
    const player = Player.getPlayer();
    if (!player) return null;

    const eyePos = player.getEyePos(); // native Vec3d
    let x = eyePos.x;
    let y = eyePos.y;
    let z = eyePos.z;

    if (forceSneak && !Player.isSneaking()) y -= 0.08;
    return [x, y, z];
};

export const getPlayerLookVec = () => {
    const player = Player.getPlayer();
    if (!player) return null;

    const lookVec = player.getRotationVec(1.0); // tickDelta = 1.0 is standard
    return new Vector3(lookVec.x, lookVec.y, lookVec.z);
};

export const traverseVoxels = (start, end, blockCheckFunc = null, returnWhenTrue = false, stopWhenNotAir = false, returnIntersection = false) => {
    const direction = end.map((v, i) => v - start[i]);
    const step = direction.map((a) => Math.sign(a));

    // Handle division by zero for axis-aligned rays
    const tDelta = direction.map((d) => (d === 0 ? Number.MAX_VALUE : Math.abs(1 / d)));

    const tMax = tDelta.map((td, i) => {
        if (td === Number.MAX_VALUE) return Number.MAX_VALUE;
        const startCoord = start[i];
        const stepDir = step[i];
        const currentVoxel = Math.floor(startCoord);
        const distToBoundary = stepDir > 0 ? currentVoxel + 1 - startCoord : startCoord - currentVoxel;
        return distToBoundary * td;
    });

    let currentPos = start.map((a) => Math.floor(a));
    const endPos = end.map((a) => Math.floor(a));
    let intersectionPoint = [...start];

    const path = [];
    let iters = 0;
    const maxIters = Math.ceil(Math.abs(direction[0]) + Math.abs(direction[1]) + Math.abs(direction[2])) + 10;

    while (iters < maxIters && iters < 1000) {
        iters++;

        // Check current block
        const currentBlock = World.getBlockAt(...currentPos);
        if (!currentBlock || !currentBlock.type) {
            return returnWhenTrue ? null : path;
        }

        if (blockCheckFunc && blockCheckFunc(currentBlock)) {
            if (returnWhenTrue) {
                return returnIntersection ? { hit: currentPos, intersection: intersectionPoint } : currentPos;
            }
        }

        if (stopWhenNotAir && currentBlock.type.getID() !== 0) {
            if (returnIntersection) {
                return { hit: currentPos, intersection: intersectionPoint };
            }
            return returnWhenTrue ? currentPos : [currentPos];
        }

        path.push([...currentPos]);

        if (currentPos.every((v, i) => v === endPos[i])) break;

        // Find the next voxel boundary to cross
        const minIndex = tMax.reduce((minIdx, val, idx) => (val < tMax[minIdx] ? idx : minIdx), 0);

        // Calculate intersection point BEFORE advancing
        if (returnIntersection) {
            const t = tMax[minIndex];
            intersectionPoint = start.map((v, i) => v + t * direction[i]);
        }

        // Advance to next voxel
        tMax[minIndex] += tDelta[minIndex];
        currentPos[minIndex] += step[minIndex];
    }

    return returnWhenTrue ? null : path;
};
