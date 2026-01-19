import RenderUtils from '../render/RendererUtils';
import { Vec3d } from '../Constants';

class PathSpline {
    constructor() {
        this.STRONG_SMOOTH_RADIUS = 5;
        this.CURVE_DETECTION_RADIUS = 2;
        this.SMOOTH_SAMPLES = 6;
        this.OUTWARD_OFFSET_STRENGTH = 1.5;
        this.lastDataHash = null;
        this.cachedBoxPositions = [];
    }

    generateSpline(keyPathNodes, tolerance = 10) {
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
            if (Math.sqrt(dx * dx + dy * dy + dz * dz) > tolerance) simplifiedPoints.push(p1);
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
            if (i === simplifiedPoints.length - 2) finalPath.push(p2);
        }

        if (finalPath.length === 0 || finalPath[0] !== simplifiedPoints[0]) {
            finalPath.unshift(simplifiedPoints[0]);
        }

        return finalPath;
    }

    createLookPoints(smoothSplineData, minInterval = 1, maxInterval = 10) {
        if (!smoothSplineData || smoothSplineData.length < 2) return [];

        const currentHash = smoothSplineData.length + '-' + smoothSplineData[0]?.x + '-' + smoothSplineData[smoothSplineData.length - 1]?.x;
        if (currentHash === this.lastDataHash) return this.cachedBoxPositions;
        this.lastDataHash = currentHash;

        const boxPositions = [];
        const startNode = smoothSplineData[0];

        let lastInjectedPoint = new Vec3d(startNode.x, startNode.y + 2.12, startNode.z);
        boxPositions.push(lastInjectedPoint);

        let lastPlacedRaw = smoothSplineData[0];
        const lookWindow = 3;

        for (let i = 1; i < smoothSplineData.length - 1; i++) {
            const curr = smoothSplineData[i];
            const prev = smoothSplineData[Math.max(0, i - lookWindow)];
            const next = smoothSplineData[Math.min(smoothSplineData.length - 1, i + lookWindow)];

            const v1 = { x: curr.x - prev.x, z: curr.z - prev.z };
            const v2 = { x: next.x - curr.x, z: next.z - curr.z };

            const mag1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z);

            let curvatureFactor = 0;
            let offsetX = 0;
            let offsetZ = 0;

            if (mag1 > 0.1 && mag2 > 0.1) {
                const dot = (v1.x * v2.x + v1.z * v2.z) / (mag1 * mag2);
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

                curvatureFactor = Math.pow(Math.min(angle / (Math.PI / 3), 1), 2);

                const dirX = v1.x / mag1 + v2.x / mag2;
                const dirZ = v1.z / mag1 + v2.z / mag2;
                const dirMag = Math.sqrt(dirX * dirX + dirZ * dirZ);

                if (dirMag > 0.01) {
                    const normalX = -dirZ / dirMag;
                    const normalZ = dirX / dirMag;
                    offsetX = normalX * curvatureFactor * this.OUTWARD_OFFSET_STRENGTH;
                    offsetZ = normalZ * curvatureFactor * this.OUTWARD_OFFSET_STRENGTH;
                }
            }

            const dynamicInterval = maxInterval - curvatureFactor * (maxInterval - minInterval);
            const distToLast = Math.sqrt(Math.pow(curr.x - lastPlacedRaw.x, 2) + Math.pow(curr.z - lastPlacedRaw.z, 2));

            if (distToLast >= dynamicInterval) {
                let targetY = curr.y + 2.12;

                if (Math.abs(targetY - lastInjectedPoint.y) < 0.15) {
                    targetY = lastInjectedPoint.y;
                }

                const newPoint = new Vec3d(curr.x + offsetX, targetY, curr.z + offsetZ);
                boxPositions.push(newPoint);
                lastInjectedPoint = newPoint;
                lastPlacedRaw = curr;
            }
        }

        const endNode = smoothSplineData[smoothSplineData.length - 1];
        if (Math.sqrt(Math.pow(endNode.x - lastPlacedRaw.x, 2) + Math.pow(endNode.z - lastPlacedRaw.z, 2)) > 0.5) {
            boxPositions.push(new Vec3d(endNode.x, endNode.y + 2.12, endNode.z));
        }

        this.cachedBoxPositions = boxPositions;
        return this.cachedBoxPositions;
    }

    drawLookPoints() {
        if (!this.cachedBoxPositions || this.cachedBoxPositions.length === 0) return;

        const px = Player.getX();
        const pz = Player.getZ();

        this.cachedBoxPositions.forEach((pos) => {
            if (Math.abs(pos.x - px) < 64 && Math.abs(pos.z - pz) < 64) {
                RenderUtils.drawBox(pos, [255, 0, 0, 100], true);
            }
        });
    }

    drawFloatingSpline(smoothSplineData) {
        let color = [0, 255, 255, 255];
        let thickness = 3;
        let verticalOffset = 2.62;
        let renderThrough = true;

        if (!smoothSplineData || smoothSplineData.length < 2) return;

        for (let i = 0; i < smoothSplineData.length - 1; i++) {
            const startVec = smoothSplineData[i];
            const endVec = smoothSplineData[i + 1];
            RenderUtils.drawLine(
                new Vec3d(startVec.x + 0.5, startVec.y + verticalOffset, startVec.z + 0.5),
                new Vec3d(endVec.x + 0.5, endVec.y + verticalOffset, endVec.z + 0.5),
                color,
                thickness,
                renderThrough
            );
        }
    }

    clearCache() {
        this.cachedBoxPositions = [];
        this.lastDataHash = null;
    }
}

export const Spline = new PathSpline();
