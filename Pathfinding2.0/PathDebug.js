import RenderUtils from '../Rendering/RendererUtils';
import { Vec3d } from '../Utility/Constants';

export function generateHybridSpline(keyPathNodes, tolerance = 10) {
    if (!keyPathNodes || keyPathNodes.length < 2) return [];

    const rawPoints = keyPathNodes.map((n) => {
        const x = n.x !== undefined ? n.x : n[0];
        const y = n.y !== undefined ? n.y : n[1];
        const z = n.z !== undefined ? n.z : n[2];
        return new Vec3d(x, y, z);
    });

    const simplifiedPoints = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
        const p0 = simplifiedPoints[simplifiedPoints.length - 1];
        const p1 = rawPoints[i];

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dz = p1.z - p0.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > tolerance) {
            simplifiedPoints.push(p1);
        }
    }
    simplifiedPoints.push(rawPoints[rawPoints.length - 1]);

    if (simplifiedPoints.length < 2) return rawPoints;

    const finalPath = [];
    const interpolationStep = 0.5;

    for (let i = 0; i < simplifiedPoints.length - 1; i++) {
        const p1 = simplifiedPoints[i];
        const p2 = simplifiedPoints[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const numSteps = Math.ceil(distance / interpolationStep);
        if (numSteps === 0) continue;

        const stepX = dx / numSteps;
        const stepY = dy / numSteps;
        const stepZ = dz / numSteps;

        for (let j = 0; j < numSteps; j++) {
            if (i > 0 && j === 0) continue;

            const x = p1.x + j * stepX;
            const y = p1.y + j * stepY;
            const z = p1.z + j * stepZ;
            finalPath.push(new Vec3d(x, y, z));
        }

        if (i === simplifiedPoints.length - 2) {
            finalPath.push(p2);
        }
    }

    if (finalPath.length === 0 || finalPath[0] !== simplifiedPoints[0]) {
        finalPath.unshift(simplifiedPoints[0]);
    }

    return finalPath;
}

export function renderSplineBoxes(
    smoothSplineData,
    boxInterval = 1,
    draw = false
) {
    const STRONG_SMOOTHING_RADIUS = 5;
    const CURVE_DETECTION_RADIUS = 2;

    if (
        !smoothSplineData ||
        smoothSplineData.length < STRONG_SMOOTHING_RADIUS * 2 + 1
    )
        return [];

    const smoothedPath = [];

    for (let i = 0; i < smoothSplineData.length; i++) {
        const currentPoint = smoothSplineData[i];

        const lookAheadIndex = Math.min(
            smoothSplineData.length - 1,
            i + CURVE_DETECTION_RADIUS
        );
        const lookBehindIndex = Math.max(0, i - CURVE_DETECTION_RADIUS);

        const p_back = smoothSplineData[lookBehindIndex];
        const p_forward = smoothSplineData[lookAheadIndex];

        const vx1 = currentPoint.x - p_back.x;
        const vy1 = currentPoint.y - p_back.y;
        const vz1 = currentPoint.z - p_back.z;
        const vx2 = p_forward.x - currentPoint.x;
        const vy2 = p_forward.y - currentPoint.y;
        const vz2 = p_forward.z - currentPoint.z;

        const dot = vx1 * vx2 + vy1 * vy2 + vz1 * vz2;
        const mag1 = Math.sqrt(vx1 * vx1 + vy1 * vy1 + vz1 * vz1);
        const mag2 = Math.sqrt(vx2 * vx2 + vy2 * vy2 + vz2 * vz2);

        const cosAngle =
            mag1 > 0 && mag2 > 0
                ? Math.min(1, Math.max(-1, dot / (mag1 * mag2)))
                : 1;

        let curveFactor = 1.0 - Math.min(1, Math.max(0, (cosAngle + 1) / 2));
        curveFactor = Math.pow(curveFactor, 5);

        const strongStart = Math.max(0, i - STRONG_SMOOTHING_RADIUS);
        const strongEnd = Math.min(
            smoothSplineData.length - 1,
            i + STRONG_SMOOTHING_RADIUS
        );
        let strongSumX = 0,
            strongSumY = 0,
            strongSumZ = 0,
            strongCount = 0;

        for (let j = strongStart; j <= strongEnd; j++) {
            strongSumX += smoothSplineData[j].x;
            strongSumY += smoothSplineData[j].y;
            strongSumZ += smoothSplineData[j].z;
            strongCount++;
        }
        const strongAvgX = strongSumX / strongCount;
        const strongAvgY = strongSumY / strongCount;
        const strongAvgZ = strongSumZ / strongCount;

        const rawX = currentPoint.x;
        const rawY = currentPoint.y;
        const rawZ = currentPoint.z;

        const finalX = (1.0 - curveFactor) * strongAvgX + curveFactor * rawX;
        const finalY = (1.0 - curveFactor) * strongAvgY + curveFactor * rawY;
        const finalZ = (1.0 - curveFactor) * strongAvgZ + curveFactor * rawZ;

        smoothedPath.push(new Vec3d(finalX, finalY, finalZ));
    }

    const pathForBoxes = smoothedPath;

    const boxPositions = [];
    let distanceCovered = 0;
    let nextBoxDistance = 0;

    const startVec = pathForBoxes[0];
    boxPositions.push(new Vec3d(startVec.x, startVec.y, startVec.z));
    nextBoxDistance += boxInterval;

    for (let i = 0; i < pathForBoxes.length - 1; i++) {
        const current = pathForBoxes[i];
        const next = pathForBoxes[i + 1];

        const segmentDistance = Math.sqrt(
            Math.pow(next.x - current.x, 2) +
                Math.pow(next.y - current.y, 2) +
                Math.pow(next.z - current.z, 2)
        );

        if (distanceCovered + segmentDistance >= nextBoxDistance) {
            let remainder = nextBoxDistance - distanceCovered;

            while (remainder <= segmentDistance) {
                const t = remainder / segmentDistance;

                const boxX = current.x + t * (next.x - current.x);
                const boxY = current.y + t * (next.y - current.y) + 2.12;
                const boxZ = current.z + t * (next.z - current.z);

                boxPositions.push(new Vec3d(boxX, boxY, boxZ));

                nextBoxDistance += boxInterval;
                remainder += boxInterval;
            }
        }

        distanceCovered += segmentDistance;
    }

    if (draw) {
        boxPositions.forEach((pos) => {
            RenderUtils.drawBox(pos, [255, 0, 0, 50]);
        });
    }

    return boxPositions;
}

export function drawFloatingSpline(
    smoothSplineData,
    keyNodesData = [],
    thickness = 3,
    color = [0, 255, 255, 255],
    verticalOffset = 2.62,
    renderThrough = false
) {
    try {
        if (!smoothSplineData || smoothSplineData.length < 2) return;

        for (let i = 0; i < smoothSplineData.length - 1; i++) {
            const startVec = smoothSplineData[i];
            const endVec = smoothSplineData[i + 1];

            const startRenderVec = new Vec3d(
                startVec.x + 0.5,
                startVec.y + verticalOffset,
                startVec.z + 0.5
            );
            const endRenderVec = new Vec3d(
                endVec.x + 0.5,
                endVec.y + verticalOffset,
                endVec.z + 0.5
            );

            RenderUtils.drawLine(
                startRenderVec,
                endRenderVec,
                color,
                thickness,
                renderThrough
            );
        }
    } catch (e) {
        console.error('Error in drawFloatingSpline:', e);
    }
}
