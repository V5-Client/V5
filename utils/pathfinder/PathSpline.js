import { BP, Vec3d } from '../Constants';
import Render from '../render/Render';

class PathSpline {
    constructor() {
        this.PLAYER_EYE_OFFSET = 1.62;

        this.STRONG_SMOOTH_RADIUS = 5;
        this.CURVE_DETECTION_RADIUS = 2;
        this.SMOOTH_SAMPLES = 6;
        this.MIN_LOOK_POINT_SPACING = 0.8;
        this.MAX_ANGLE_CHANGE = Math.PI / 4;
        this.MAX_GAP_DISTANCE = 12;
        this.OUTWARD_OFFSET_STRENGTH = 1.2;

        this.FLY_SPACING = 5.25;
        this.FLY_RAYTRACE_STEP = 0.35;
        this.FLY_BLOCK_NUDGE = 0.85;

        this.MIN_ADAPTIVE_TOLERANCE = 0.005;
        this.MAX_ADAPTIVE_SPACING = 15.0;
        this.Y_ADAPTIVE_SENSITIVITY = 1.5;

        this.lastDataHash = null;
        this.cachedBoxPositions = [];
        this.cachedFlyLookPoints = [];
        this.lastFlyHash = null;
    }

    buildPathHash(points, prefix = 'path', sampleCount = 6) {
        if (!points || points.length === 0) return `${prefix}-empty`;

        const first = points[0];
        const last = points[points.length - 1];
        const components = [prefix, points.length, first.x, first.y, first.z, last.x, last.y, last.z];

        if (points.length > 2) {
            const maxSampleCount = Math.min(sampleCount, points.length - 2);
            for (let i = 1; i <= maxSampleCount; i++) {
                const idx = Math.floor((i * (points.length - 1)) / (maxSampleCount + 1));
                const p = points[idx];
                components.push(idx, p.x, p.y, p.z);
            }
        }

        return components.join('|');
    }

    createFlyPaths(nodes) {
        const lookPoints = this.createFlyLookPoints(nodes);
        const movementPath = this.generateMovementPathFromLookPoints(lookPoints, this.PLAYER_EYE_OFFSET);

        return { lookPoints, movementPath };
    }

    generateMovementPathFromLookPoints(lookPoints, eyeOffset) {
        if (!lookPoints || lookPoints.length < 2) return [];

        const feetPath = [];
        for (const p of lookPoints) {
            const feetPoint = new Vec3d(p.x, p.y - eyeOffset, p.z);
            const prev = feetPath.length ? feetPath[feetPath.length - 1] : null;
            if (!prev || Math.hypot(feetPoint.x - prev.x, feetPoint.y - prev.y, feetPoint.z - prev.z) > 0.08) {
                feetPath.push(feetPoint);
            }
        }

        if (feetPath.length < 2) {
            return feetPath.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        }

        const dense = this.resamplePolylineByDistance(feetPath, 1.5);
        return dense.map((p) => ({ x: p.x, y: p.y, z: p.z }));
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
            const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
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
            const distance = Math.hypot(dx, dy, dz);
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

        const currentHash = this.buildPathHash(smoothSplineData, 'look');
        if (currentHash === this.lastDataHash) return this.cachedBoxPositions;
        this.lastDataHash = currentHash;

        const start = smoothSplineData[0];
        const endPoint = smoothSplineData[smoothSplineData.length - 1];

        const boxPositions = [];
        let lastPlacedRaw = smoothSplineData[0];
        let lastForwardDir = null;

        boxPositions.push(new Vec3d(start.x, start.y + 2.62, start.z));

        for (let i = 1; i < smoothSplineData.length - 1; i++) {
            const curr = smoothSplineData[i];
            const dist = Math.hypot(curr.x - lastPlacedRaw.x, curr.y - lastPlacedRaw.y, curr.z - lastPlacedRaw.z);

            const lookWindow = 4;
            const prev = smoothSplineData[Math.max(0, i - lookWindow)];
            const next = smoothSplineData[Math.min(smoothSplineData.length - 1, i + lookWindow)];

            const v1 = { x: curr.x - prev.x, z: curr.z - prev.z };
            const v2 = { x: next.x - curr.x, z: next.z - curr.z };
            const m1 = Math.hypot(v1.x, v1.z);
            const m2 = Math.hypot(v2.x, v2.z);

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
                const fMag = Math.hypot(forward.x, forward.z);

                if (fMag > 0.01) {
                    offsetX = -(forward.z / fMag) * dir * curvature * this.OUTWARD_OFFSET_STRENGTH;
                    offsetZ = (forward.x / fMag) * dir * curvature * this.OUTWARD_OFFSET_STRENGTH;
                }
            }

            const dynamicInterval = maxInterval - curvature * (maxInterval - minInterval);

            if (dist >= dynamicInterval) {
                const currentForward = { x: curr.x - lastPlacedRaw.x, z: curr.z - lastPlacedRaw.z };
                const cfMag = Math.hypot(currentForward.x, currentForward.z);

                if (lastForwardDir && cfMag > 0.1 && dist < this.MAX_GAP_DISTANCE) {
                    const dot = (currentForward.x * lastForwardDir.x + currentForward.z * lastForwardDir.z) / cfMag;
                    if (dot < 0.4) continue;
                }

                const targetPoint = new Vec3d(curr.x + offsetX, curr.y + 2.62, curr.z + offsetZ);
                this.appendLookPoint(boxPositions, this.adjustLookPoint(targetPoint, curr));
                lastPlacedRaw = curr;
                if (cfMag > 0.1) lastForwardDir = { x: currentForward.x / cfMag, z: currentForward.z / cfMag };
            }
        }

        this.appendLookPoint(boxPositions, new Vec3d(endPoint.x, endPoint.y + 2.62, endPoint.z));
        this.cachedBoxPositions = boxPositions;
        return boxPositions;
    }

    createFlyLookPoints(nodes) {
        if (!nodes || nodes.length < 2) return [];

        const normalizedNodes = nodes.map((n) => ({ x: n.x ?? n[0], y: n.y ?? n[1], z: n.z ?? n[2] }));
        const currentHash = this.buildPathHash(normalizedNodes, 'fly');
        if (currentHash === this.lastFlyHash) return this.cachedFlyLookPoints;

        const raw = [];
        for (const n of normalizedNodes) {
            const p = new Vec3d(n.x, n.y + this.PLAYER_EYE_OFFSET, n.z);
            if (raw.length === 0 || Math.hypot(p.x - raw[raw.length - 1].x, p.y - raw[raw.length - 1].y, p.z - raw[raw.length - 1].z) > 0.1) raw.push(p);
        }

        const player = Player.getPlayer();
        const yaw = ((player ? Player.getYaw() : 0) + 90) * (Math.PI / 180);
        const pitch = -(player ? Player.getPitch() : 0) * (Math.PI / 180);
        const lookV = { x: Math.cos(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.sin(yaw) * Math.cos(pitch) };
        const initialLook = new Vec3d(raw[0].x + lookV.x * 2, raw[0].y + lookV.y * 2, raw[0].z + lookV.z * 2);

        const adaptivePoints = [initialLook, raw[0]];
        const roundedRaw = this.roundPolylineCorners(raw, this.FLY_SPACING);

        for (let i = 1; i < roundedRaw.length - 1; i++) {
            const prev = adaptivePoints[adaptivePoints.length - 1];
            const curr = roundedRaw[i];
            const next = roundedRaw[i + 1];

            const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z);
            const yDiff = Math.abs(curr.y - prev.y);

            const ab = { x: curr.x - prev.x, y: curr.y - prev.y, z: curr.z - prev.z };
            const bc = { x: next.x - curr.x, y: next.y - curr.y, z: next.z - curr.z };
            const m1 = Math.hypot(ab.x, ab.y, ab.z);
            const m2 = Math.hypot(bc.x, bc.y, bc.z);

            let dot = 1.0;
            if (m1 > 1e-6 && m2 > 1e-6) {
                dot = (ab.x * bc.x + ab.y * bc.y + ab.z * bc.z) / (m1 * m2);
            }

            const curvature = 1.0 - dot;
            const dynamicStep = Math.max(this.MIN_LOOK_POINT_SPACING, this.MAX_ADAPTIVE_SPACING * (1.0 - curvature * 10 - yDiff * this.Y_ADAPTIVE_SENSITIVITY));

            if (dist >= dynamicStep || curvature > this.MIN_ADAPTIVE_TOLERANCE) {
                adaptivePoints.push(this.adjustLookPoint(curr, curr));
            }
        }

        adaptivePoints.push(roundedRaw[roundedRaw.length - 1]);
        const lookPoints = this.refineLookPath(adaptivePoints);

        for (let i = 0; i < lookPoints.length; i++) {
            if (this.isPointInsideBlock(lookPoints[i])) {
                lookPoints[i] = this.nudgePointOutOfBlock(lookPoints[i]);
            }
        }

        this.lastFlyHash = currentHash;
        this.cachedFlyLookPoints = lookPoints;
        return lookPoints;
    }

    refineLookPath(points) {
        if (!points || points.length === 0) return [];
        const final = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const d = Math.hypot(points[i].x - final[final.length - 1].x, points[i].y - final[final.length - 1].y, points[i].z - final[final.length - 1].z);
            if (d > 0.2) final.push(points[i]);
        }
        return final;
    }

    roundPolylineCorners(points, spacing) {
        if (!points || points.length < 3) return points || [];

        const out = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const a = points[i - 1];
            const b = points[i];
            const c = points[i + 1];

            const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
            const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
            const abMag = Math.hypot(ab.x, ab.y, ab.z);
            const bcMag = Math.hypot(bc.x, bc.y, bc.z);
            if (abMag < 1e-6 || bcMag < 1e-6) continue;

            const u1 = { x: ab.x / abMag, y: ab.y / abMag, z: ab.z / abMag };
            const u2 = { x: bc.x / bcMag, y: bc.y / bcMag, z: bc.z / bcMag };
            const dot = u1.x * u2.x + u1.y * u2.y + u1.z * u2.z;
            const isTight = this.checkTightSpace(b);

            if (dot < -0.3) {
                const ejectionDist = isTight ? 5.5 : 3.8;
                const lookAhead = new Vec3d(b.x + u1.x * ejectionDist, b.y + u1.y * ejectionDist, b.z + u1.z * ejectionDist);
                out.push(this.adjustLookPoint(lookAhead, b));
            }

            if (dot > 0.985) {
                out.push(b);
                continue;
            }

            const baseRadius = isTight ? 0.9 : Math.max(0.15, Math.min(1.6, spacing * 0.55));
            const r = Math.min(baseRadius, abMag * 0.45, bcMag * 0.45);

            const pIn = new Vec3d(b.x - u1.x * r, b.y - u1.y * r, b.z - u1.z * r);
            const pOut = new Vec3d(b.x + u2.x * r, b.y + u2.y * r, b.z + u2.z * r);

            if (this.isSegmentClear(pIn, pOut)) {
                out.push(pIn);
                out.push(pOut);
            } else {
                out.push(b);
            }
        }
        out.push(points[points.length - 1]);

        const deduped = [out[0]];
        for (let i = 1; i < out.length; i++) {
            const prev = deduped[deduped.length - 1];
            if (out[i].x !== prev.x || out[i].y !== prev.y || out[i].z !== prev.z) {
                deduped.push(out[i]);
            }
        }
        return deduped;
    }

    checkTightSpace(p) {
        const checkDist = 1.2;
        let blocked = 0;
        if (this.isPointInsideBlock({ x: p.x + checkDist, y: p.y, z: p.z })) blocked++;
        if (this.isPointInsideBlock({ x: p.x - checkDist, y: p.y, z: p.z })) blocked++;
        if (this.isPointInsideBlock({ x: p.x, y: p.y, z: p.z + checkDist })) blocked++;
        if (this.isPointInsideBlock({ x: p.x, y: p.y, z: p.z - checkDist })) blocked++;
        return blocked >= 2;
    }

    isSegmentClear(a, b) {
        const dx = b.x - a.x,
            dy = b.y - a.y,
            dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-6) return true;

        const steps = Math.ceil(dist / this.FLY_RAYTRACE_STEP);
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            if (this.isPointInsideBlock({ x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t })) return false;
        }
        return true;
    }

    resamplePolylineByDistance(points, step) {
        if (!Number.isFinite(step) || step <= 0) return points || [];
        if (!points || points.length < 2) return points || [];
        const out = [points[0]];
        let carry = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i],
                b = points[i + 1];
            const dx = b.x - a.x,
                dy = b.y - a.y,
                dz = b.z - a.z;
            const dist = Math.hypot(dx, dy, dz);
            if (dist < 1e-9) continue;

            let tDist = step - carry;
            while (tDist <= dist + 1e-9) {
                const t = tDist / dist;
                out.push(new Vec3d(a.x + dx * t, a.y + dy * t, a.z + dz * t));
                tDist += step;
            }
            carry = (((dist - (tDist - step)) % step) + step) % step;
        }

        const last = points[points.length - 1],
            prev = out[out.length - 1];
        if (prev.x !== last.x || prev.y !== last.y || prev.z !== last.z) out.push(last);
        return out;
    }

    nudgePointOutOfBlock(point) {
        const up = new Vec3d(point.x, point.y + this.FLY_BLOCK_NUDGE, point.z);
        if (!this.isPointInsideBlock(up)) return up;
        const down = new Vec3d(point.x, point.y - this.FLY_BLOCK_NUDGE, point.z);
        return !this.isPointInsideBlock(down) ? down : point;
    }

    isPointInsideBlock(point) {
        try {
            const world = World.getWorld();
            if (!world) return false;
            const pos = new BP(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
            const state = world.getBlockState(pos);
            if (!state) return false;
            return !state.getCollisionShape(world, pos).isEmpty();
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

    drawLookPoints() {
        if (!this.cachedBoxPositions?.length) return;

        const player = Player.getPlayer();
        if (!player) return;

        const px = Player.getX();
        const pz = Player.getZ();

        const size = 0.4;

        this.cachedBoxPositions.forEach((pos) => {
            if (Math.abs(pos.x - px) < 64 && Math.abs(pos.z - pz) < 64) {
                const renderPos = new Vec3d(pos.x, pos.y + 0.2, pos.z);
                Render.drawSizedBox(renderPos, size, size, size, Render.Color(255, 0, 255, 180), true, 1, true);
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
        this.cachedFlyLookPoints = [];
        this.lastDataHash = null;
        this.lastFlyHash = null;
    }
}

export const Spline = new PathSpline();
