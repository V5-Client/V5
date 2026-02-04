import Render from '../render/Render';
import { BP, Vec3d } from '../Constants';

class PathSpline {
    constructor() {
        this.STRONG_SMOOTH_RADIUS = 5;
        this.CURVE_DETECTION_RADIUS = 2;
        this.SMOOTH_SAMPLES = 6;
        this.MIN_LOOK_POINT_SPACING = 0.8;
        this.MAX_ANGLE_CHANGE = Math.PI / 4;
        this.MAX_GAP_DISTANCE = 12;
        this.OUTWARD_OFFSET_STRENGTH = 1.2;
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
            const dist = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2) + Math.pow(p1.z - p0.z, 2));
            if (dist > tolerance) simplifiedPoints.push(p1);
        }
        simplifiedPoints.push(rawPoints[rawPoints.length - 1]);

        if (simplifiedPoints.length < 2) return rawPoints;

        const finalPath = [];
        const interpolationStep = 0.4;

        for (let i = 0; i < simplifiedPoints.length - 1; i++) {
            const p1 = simplifiedPoints[i];
            const p2 = simplifiedPoints[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dz = p2.z - p1.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const numSteps = Math.ceil(distance / interpolationStep);

            for (let j = 0; j < numSteps; j++) {
                if (i > 0 && j === 0) continue;
                finalPath.push(new Vec3d(p1.x + (dx * j) / numSteps, p1.y + (dy * j) / numSteps, p1.z + (dz * j) / numSteps));
            }
        }
        finalPath.push(simplifiedPoints[simplifiedPoints.length - 1]);
        return finalPath;
    }

    createLookPoints(smoothSplineData, minInterval = 1.2, maxInterval = 8) {
        if (!smoothSplineData || smoothSplineData.length < 2) return [];

        const start = smoothSplineData[0];
        const endPoint = smoothSplineData[smoothSplineData.length - 1];
        const mid = smoothSplineData[Math.floor(smoothSplineData.length / 2)];

        const currentHash = `${smoothSplineData.length}-${start.x}-${start.y}-${start.z}-${mid.x}-${mid.y}-${mid.z}-${endPoint.x}-${endPoint.y}-${endPoint.z}`;
        if (currentHash === this.lastDataHash) return this.cachedBoxPositions;
        this.lastDataHash = currentHash;

        const boxPositions = [];
        let lastPlacedRaw = smoothSplineData[0];
        let lastForwardDir = null;

        boxPositions.push(new Vec3d(start.x, start.y + 2.12, start.z));

        for (let i = 1; i < smoothSplineData.length - 1; i++) {
            const curr = smoothSplineData[i];
            const dist = Math.sqrt(Math.pow(curr.x - lastPlacedRaw.x, 2) + Math.pow(curr.z - lastPlacedRaw.z, 2));

            const lookWindow = 4;
            const prev = smoothSplineData[Math.max(0, i - lookWindow)];
            const next = smoothSplineData[Math.min(smoothSplineData.length - 1, i + lookWindow)];

            const v1 = { x: curr.x - prev.x, z: curr.z - prev.z };
            const v2 = { x: next.x - curr.x, z: next.z - curr.z };
            const m1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z);
            const m2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z);

            let curvature = 0;
            let offsetX = 0;
            let offsetZ = 0;

            if (m1 > 0.05 && m2 > 0.05) {
                const dot = (v1.x * v2.x + v1.z * v2.z) / (m1 * m2);
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                curvature = Math.min(angle / (Math.PI / 2.5), 1);

                const cross = v1.x * v2.z - v1.z * v2.x;
                const dir = cross > 0 ? 1 : -1;
                const forward = { x: v1.x / m1 + v2.x / m2, z: v1.z / m1 + v2.z / m2 };
                const fMag = Math.sqrt(forward.x * forward.x + forward.z * forward.z);

                if (fMag > 0.01) {
                    offsetX = -(forward.z / fMag) * dir * curvature * this.OUTWARD_OFFSET_STRENGTH;
                    offsetZ = (forward.x / fMag) * dir * curvature * this.OUTWARD_OFFSET_STRENGTH;
                }
            }

            const dynamicInterval = maxInterval - curvature * (maxInterval - minInterval);

            if (dist >= dynamicInterval) {
                const currentForward = { x: curr.x - lastPlacedRaw.x, z: curr.z - lastPlacedRaw.z };
                const cfMag = Math.sqrt(currentForward.x * currentForward.x + currentForward.z * currentForward.z);

                if (lastForwardDir && cfMag > 0.1 && dist < this.MAX_GAP_DISTANCE) {
                    const dot = (currentForward.x * lastForwardDir.x + currentForward.z * lastForwardDir.z) / cfMag;
                    if (dot < 0.4) continue;
                }

                const targetPoint = new Vec3d(curr.x + offsetX, curr.y + 2.12, curr.z + offsetZ);

                this.appendLookPoint(boxPositions, this.adjustLookPoint(targetPoint, curr));

                lastPlacedRaw = curr;
                if (cfMag > 0.1) lastForwardDir = { x: currentForward.x / cfMag, z: currentForward.z / cfMag };
            }
        }

        this.appendLookPoint(boxPositions, new Vec3d(endPoint.x, endPoint.y + 2.12, endPoint.z));
        this.cachedBoxPositions = boxPositions;
        return boxPositions;
    }

    appendLookPoint(boxPositions, point) {
        if (boxPositions.length === 0) {
            boxPositions.push(point);
            return;
        }
        const last = boxPositions[boxPositions.length - 1];

        if (Math.pow(point.x - last.x, 2) + Math.pow(point.z - last.z, 2) < Math.pow(this.MIN_LOOK_POINT_SPACING, 2)) {
            boxPositions[boxPositions.length - 1] = point;
        } else {
            boxPositions.push(point);
        }
    }

    isPointInsideBlock(point) {
        try {
            const world = World.getWorld();
            if (!world) return false;
            const pos = new BP(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
            return !world.getBlockState(pos).getCollisionShape(world, pos).isEmpty();
        } catch (e) {
            return false;
        }
    }

    adjustLookPoint(point, rawNode) {
        if (!this.isPointInsideBlock(point)) return point;
        const unoffset = new Vec3d(rawNode.x, point.y, rawNode.z);
        if (!this.isPointInsideBlock(unoffset)) return unoffset;
        const lowered = new Vec3d(rawNode.x, point.y - 0.5, rawNode.z);
        return this.isPointInsideBlock(lowered) ? unoffset : lowered;
    }

    drawLookPoints() {
        if (!this.cachedBoxPositions) return;
        const px = Player.getX();
        const pz = Player.getZ();
        this.cachedBoxPositions.forEach((pos) => {
            if (Math.abs(pos.x - px) < 64 && Math.abs(pos.z - pz) < 64) {
                Render.drawBox(pos, Render.Color(255, 0, 0, 100), true);
            }
        });
    }

    drawFloatingSpline(smoothSplineData) {
        if (!smoothSplineData || smoothSplineData.length < 2) return;
        for (let i = 0; i < smoothSplineData.length - 1; i++) {
            Render.drawLine(
                new Vec3d(smoothSplineData[i].x + 0.5, smoothSplineData[i].y + 2.62, smoothSplineData[i].z + 0.5),
                new Vec3d(smoothSplineData[i + 1].x + 0.5, smoothSplineData[i + 1].y + 2.62, smoothSplineData[i + 1].z + 0.5),
                Render.Color(0, 255, 255, 255),
                3,
                true
            );
        }
    }

    clearCache() {
        this.cachedBoxPositions = [];
        this.lastDataHash = null;
    }
}

export const Spline = new PathSpline();
