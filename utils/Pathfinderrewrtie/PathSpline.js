import RenderUtils from '../render/RendererUtils';
import { Vec3d } from '../Constants';

class PathSpline {
    constructor() {
        this.STRONG_SMOOTHING_RADIUS = 5;
        this.CURVE_DETECTION_RADIUS = 2;

        this.SMOOTH_SAMPLES = 6;
        this.lastDataHash = null;
        this.cachedBoxPositions = [];
        this.render;
    }

    GenerateSpline(keyPathNodes, tolerance = 10) {
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

    CreateLookPoints(smoothSplineData, boxInterval = 1, drawLookPoints = false) {
        if (!smoothSplineData || smoothSplineData.length < 2) return [];

        const currentHash = smoothSplineData.length + '-' + smoothSplineData[0]?.x + '-' + smoothSplineData[smoothSplineData.length - 1]?.x;
        if (currentHash === this.lastDataHash) return this.cachedBoxPositions;
        this.lastDataHash = currentHash;

        const smoothedPath = [];

        const weights = [];
        for (let d = -this.SMOOTH_SAMPLES; d <= this.SMOOTH_SAMPLES; d++) {
            const w = Math.pow(0.8, Math.abs(d));
            weights.push(w);
        }

        for (let i = 0; i < smoothSplineData.length; i++) {
            const currentPoint = smoothSplineData[i];

            let sumX = 0,
                sumZ = 0,
                weightSum = 0;

            for (let d = -this.SMOOTH_SAMPLES; d <= this.SMOOTH_SAMPLES; d++) {
                const idx = i + d;
                if (idx >= 0 && idx < smoothSplineData.length) {
                    const p = smoothSplineData[idx];
                    const w = weights[d + this.SMOOTH_SAMPLES];
                    sumX += p.x * w;
                    sumZ += p.z * w;
                    weightSum += w;
                }
            }

            smoothedPath.push(new Vec3d(sumX / weightSum, currentPoint.y, sumZ / weightSum));
        }

        const boxPositions = [];
        let distanceCovered = 0;
        let nextBoxDistance = 0;

        for (let i = 0; i < smoothedPath.length - 1; i++) {
            const p1 = smoothedPath[i];
            const p2 = smoothedPath[i + 1];
            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 0.01) continue;

            while (distanceCovered + dist >= nextBoxDistance) {
                const t = (nextBoxDistance - distanceCovered) / dist;
                boxPositions.push(new Vec3d(p1.x + t * dx, p1.y + 2.12, p1.z + t * dz));
                nextBoxDistance += boxInterval;
            }
            distanceCovered += dist;
        }

        this.cachedBoxPositions = boxPositions;

        if (drawLookPoints && !this.render) {
            this.render = register('postRenderWorld', () => {
                const px = Player.getX();
                const pz = Player.getZ();

                if (!this.cachedBoxPositions) return;

                for (let i = 0; i < this.cachedBoxPositions.length; i++) {
                    const pos = this.cachedBoxPositions[i];

                    if (Math.abs(pos.x - px) < 64 && Math.abs(pos.z - pz) < 64) {
                        RenderUtils.drawBox(pos, [255, 0, 0, 100], true);
                    }
                }
            });
        }

        return this.cachedBoxPositions;
    }

    // debugging remove on release
    drawFloatingSpline(smoothSplineData) {
        let color = [0, 255, 255, 255];
        let thickness = 3;
        let verticalOffset = 2.62;
        let renderThrough = true;

        if (!smoothSplineData || smoothSplineData.length < 2) return;

        for (let i = 0; i < smoothSplineData.length - 1; i++) {
            const startVec = smoothSplineData[i];
            const endVec = smoothSplineData[i + 1];

            const startRenderVec = new Vec3d(startVec.x + 0.5, startVec.y + verticalOffset, startVec.z + 0.5);
            const endRenderVec = new Vec3d(endVec.x + 0.5, endVec.y + verticalOffset, endVec.z + 0.5);

            RenderUtils.drawLine(startRenderVec, endRenderVec, color, thickness, renderThrough);
        }
    }
}

export const Spline = new PathSpline();
