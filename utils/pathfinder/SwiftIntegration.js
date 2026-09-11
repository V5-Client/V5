import { finiteNumber } from '../NumberUtils';

const readPointArray = (values) => {
    if (!values || typeof values.length !== 'number') return [];

    const points = [];
    for (let i = 0; i + 2 < values.length; i += 3) {
        points.push({ x: finiteNumber(values[i]), y: finiteNumber(values[i + 1]), z: finiteNumber(values[i + 2]) });
    }
    return points;
};

class SwiftIntegration {
    constructor() {
        this.pathManager = PathManager;
        this.cachedResult = null;
        this.intArrayClass = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 0).getClass();
    }

    clearResultCache() {
        this.cachedResult = null;
    }

    toIntPoint(point, isFly) {
        if (!Array.isArray(point) || point.length < 3) return null;

        const rawX = Number(point[0]);
        const rawY = Number(point[1]);
        const rawZ = Number(point[2]);

        if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawZ)) return null;

        const x = Math.floor(rawX);
        const yBase = Math.floor(rawY);
        const z = Math.floor(rawZ);

        return [x, isFly ? yBase : yBase + 1, z];
    }

    toJavaPointArray(points, isFly) {
        const javaArray = java.lang.reflect.Array.newInstance(this.intArrayClass, points.length);

        for (let i = 0; i < points.length; i++) {
            const parsed = this.toIntPoint(points[i], isFly);
            if (!parsed) return null;

            const pointArray = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 3);
            pointArray[0] = parsed[0];
            pointArray[1] = parsed[1];
            pointArray[2] = parsed[2];
            javaArray[i] = pointArray;
        }

        return javaArray;
    }

    SwiftPath(startPoints, endPoints, isFly = false, variantSeed = 0, maxCompute = 500000) {
        this.cachedResult = null;

        const fly = isFly === true;
        const computeLimit = Math.max(1, Math.floor(Number(maxCompute)) || 500000);
        const startsValid = Array.isArray(startPoints) && startPoints.length > 0 && Array.isArray(startPoints[0]);
        const endsValid = Array.isArray(endPoints) && endPoints.length > 0 && Array.isArray(endPoints[0]);

        if (!startsValid || !endsValid) return false;

        try {
            const startArray = this.toJavaPointArray(startPoints, fly);
            const endArray = this.toJavaPointArray(endPoints, fly);
            if (!startArray || !endArray) return false;
            this.setSearchVariantSeed(variantSeed);

            return fly ? this.pathManager.findFlyPath(startArray, endArray, computeLimit) : this.pathManager.findPath(startArray, endArray, computeLimit);
        } catch (e) {
            console.error('SwiftPath Error: ' + e);
            return false;
        }
    }

    isSearching() {
        return PathManager.isSearching();
    }

    hasPath() {
        return PathManager.hasPath();
    }

    getResult() {
        try {
            if (!PathManager.hasPath()) {
                this.cachedResult = null;
                return null;
            }

            if (this.cachedResult) {
                return this.cachedResult;
            }

            const path = readPointArray(PathManager.getPathArray());
            const keynodes = readPointArray(PathManager.getKeyNodesArray());
            if (!path.length && !keynodes.length) return null;

            const result = {
                path,
                keynodes,
                path_between_key_nodes: path.length ? path : keynodes,
                time_ms: PathManager.getLastTimeMs(),
                nodes_explored: PathManager.getNodesExplored(),
                nanoseconds_per_node: PathManager.getNanosecondsPerNode(),
                selected_start_index: this.getSelectedStartIndex(),
                path_flags: this.readIntArraySafely(() => PathManager.getPathFlagsArray()),
                keynode_flags: this.readIntArraySafely(() => PathManager.getKeyNodeFlagsArray()),
                keynode_metrics: this.readIntArraySafely(() => PathManager.getKeyNodeMetricsArray()),
                path_flag_bits: this.readIntArraySafely(() => PathManager.getPathFlagBits()),
                path_signature: this.readStringSafely(() => PathManager.getPathSignature()),
            };

            this.cachedResult = result;
            return result;
        } catch (e) {
            console.error('Swift getResult Error: ' + e);
            this.cachedResult = null;
            return null;
        }
    }

    getLastError() {
        return PathManager.getLastError();
    }

    setSearchVariantSeed(seed) {
        PathManager.setSearchVariantSeed(Math.floor(Number(seed)) || 0);
    }

    getSelectedStartIndex() {
        const index = PathManager.getSelectedStartIndex();
        return typeof index === 'number' ? index : -1;
    }

    addTransientAvoidPoint(x, y, z, radius = 2, penalty = 36, ttlSearches = 2) {
        const px = Number(x);
        const py = Number(y);
        const pz = Number(z);
        const rad = Number(radius);
        const pen = Number(penalty);
        const ttl = Number(ttlSearches);

        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return;

        PathManager.addTransientAvoidPoint(
            Math.floor(px),
            Math.floor(py),
            Math.floor(pz),
            Math.max(1, Math.floor(Number.isFinite(rad) ? rad : 2)),
            Number.isFinite(pen) ? pen : 36,
            Math.max(1, Math.floor(Number.isFinite(ttl) ? ttl : 2))
        );
    }

    clearTransientAvoidPoints() {
        PathManager.clearTransientAvoidPoints();
    }

    readIntArraySafely(getter) {
        try {
            const arr = getter();
            if (!arr || typeof arr.length !== 'number') return [];
            return Array.from(arr, (value) => finiteNumber(value));
        } catch (e) {
            return [];
        }
    }

    readStringSafely(getter) {
        try {
            const value = getter();
            return typeof value === 'string' ? value : value ? String(value) : '';
        } catch (e) {
            return '';
        }
    }

    cancel() {
        this.cachedResult = null;
        PathManager.cancelSearch();
    }

    clear() {
        this.cachedResult = null;
        PathManager.clear();
    }
}

export const Swift = new SwiftIntegration();
