import { BP, Vec3d } from '../Constants';

const MIN_LOOK_POINT_SPACING_SQ = 0.8 ** 2;
const MAX_GAP_DISTANCE = 12;
const OUTWARD_OFFSET_STRENGTH = 1.2;

let lastPath = null;
let cachedLookPoints = [];

export function generateSpline(nodes, tolerance = 10) {
    if (!nodes || nodes.length < 2) return [];
    const raw = nodes.map((node) => ({ x: node.x ?? node[0], y: node.y ?? node[1], z: node.z ?? node[2] }));
    const simplified = [raw[0]];
    for (let i = 1; i < raw.length - 1; i++) {
        const previous = simplified[simplified.length - 1];
        const point = raw[i];
        if (Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z) > tolerance) simplified.push(point);
    }
    simplified.push(raw[raw.length - 1]);

    const path = [];
    for (let i = 0; i < simplified.length - 1; i++) {
        const start = simplified[i];
        const end = simplified[i + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const steps = Math.ceil(Math.hypot(dx, dy, dz) / 0.4);
        for (let step = 0; step < steps; step++) {
            path.push({ x: start.x + (dx * step) / steps, y: start.y + (dy * step) / steps, z: start.z + (dz * step) / steps });
        }
    }
    path.push(simplified[simplified.length - 1]);
    return path;
}

const isPointInsideBlock = (point) => {
    try {
        const world = World.getWorld();
        if (!world) return false;
        const position = new BP(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
        const state = world.getBlockState(position);
        return !!state && !state.getCollisionShape(world, position).isEmpty();
    } catch (e) {
        return false;
    }
};

const adjustLookPoint = (point, node) => {
    if (!isPointInsideBlock(point)) return point;
    const unoffset = { x: node.x, y: point.y, z: node.z };
    if (!isPointInsideBlock(unoffset)) return unoffset;
    const lowered = { x: node.x, y: point.y - 0.5, z: node.z };
    return isPointInsideBlock(lowered) ? unoffset : lowered;
};

const appendLookPoint = (points, point) => {
    const last = points[points.length - 1];
    if (!last) return points.push(point);
    if ((point.x - last.x) ** 2 + (point.z - last.z) ** 2 < MIN_LOOK_POINT_SPACING_SQ) points[points.length - 1] = point;
    else points.push(point);
};

export function createLookPoints(path, minInterval = 1.2, maxInterval = 8) {
    if (!path || path.length < 2) return [];
    if (path === lastPath) return cachedLookPoints;
    lastPath = path;

    const points = [{ x: path[0].x, y: path[0].y + 2.62, z: path[0].z }];
    let lastPlaced = path[0];
    let lastDirection = null;

    for (let i = 1; i < path.length - 1; i++) {
        const current = path[i];
        const distance = Math.hypot(current.x - lastPlaced.x, current.y - lastPlaced.y, current.z - lastPlaced.z);
        const previous = path[Math.max(0, i - 4)];
        const next = path[Math.min(path.length - 1, i + 4)];
        const before = { x: current.x - previous.x, z: current.z - previous.z };
        const after = { x: next.x - current.x, z: next.z - current.z };
        const beforeLength = Math.hypot(before.x, before.z);
        const afterLength = Math.hypot(after.x, after.z);
        let curvature = 0;
        let offsetX = 0;
        let offsetZ = 0;

        if (beforeLength > 0.05 && afterLength > 0.05) {
            const dot = (before.x * after.x + before.z * after.z) / (beforeLength * afterLength);
            curvature = Math.min(Math.acos(Math.max(-1, Math.min(1, dot))) / (Math.PI / 2.5), 1);
            const direction = before.x * after.z - before.z * after.x > 0 ? 1 : -1;
            const forward = { x: before.x / beforeLength + after.x / afterLength, z: before.z / beforeLength + after.z / afterLength };
            const forwardLength = Math.hypot(forward.x, forward.z);
            if (forwardLength > 0.01) {
                offsetX = -(forward.z / forwardLength) * direction * curvature * OUTWARD_OFFSET_STRENGTH;
                offsetZ = (forward.x / forwardLength) * direction * curvature * OUTWARD_OFFSET_STRENGTH;
            }
        }

        if (distance < maxInterval - curvature * (maxInterval - minInterval)) continue;
        const forward = { x: current.x - lastPlaced.x, z: current.z - lastPlaced.z };
        const forwardLength = Math.hypot(forward.x, forward.z);
        if (lastDirection && forwardLength > 0.1 && distance < MAX_GAP_DISTANCE) {
            const dot = (forward.x * lastDirection.x + forward.z * lastDirection.z) / forwardLength;
            if (dot < 0.4) continue;
        }

        appendLookPoint(points, adjustLookPoint({ x: current.x + offsetX, y: current.y + 2.62, z: current.z + offsetZ }, current));
        lastPlaced = current;
        if (forwardLength > 0.1) lastDirection = { x: forward.x / forwardLength, z: forward.z / forwardLength };
    }

    const end = path[path.length - 1];
    appendLookPoint(points, { x: end.x, y: end.y + 2.62, z: end.z });
    cachedLookPoints = points;
    return points;
}

export function drawLookPoints() {
    if (!cachedLookPoints.length || !Player.getPlayer()) return;
    const playerX = Player.getX();
    const playerZ = Player.getZ();
    for (const point of cachedLookPoints) {
        if (Math.abs(point.x - playerX) < 64 && Math.abs(point.z - playerZ) < 64) {
            Render3D.drawSizedBox(new Vec3d(point.x, point.y + 0.2, point.z), 0.4, 0.4, 0.4, new RenderColor(255, 0, 255, 180), true, 1, true);
        }
    }
}

export function drawFloatingSpline(path) {
    if (!path || path.length < 2) return;
    for (let i = 0; i < path.length - 1; i++) {
        Render3D.drawLine(
            new Vec3d(path[i].x + 0.5, path[i].y + 2.62, path[i].z + 0.5),
            new Vec3d(path[i + 1].x + 0.5, path[i + 1].y + 2.62, path[i + 1].z + 0.5),
            new RenderColor(0, 255, 255, 255),
            3,
            true
        );
    }
}

export function clearSplineCache() {
    cachedLookPoints = [];
    lastPath = null;
}
