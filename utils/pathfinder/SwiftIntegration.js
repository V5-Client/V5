import { PathManager } from '../Constants.js';

class SwiftIntegration {
    constructor() {
        this.pathManager = PathManager;
        this.cachedResult = null;
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
        const intArrayClass = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, 0).getClass();
        const javaArray = java.lang.reflect.Array.newInstance(intArrayClass, points.length);

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

    SwiftPath(startPoints, endPoints, isFly = false, variantSeed = 0) {
        this.cachedResult = null;

        const fly = isFly === true;
        const startsValid = Array.isArray(startPoints) && startPoints.length > 0 && Array.isArray(startPoints[0]);
        const endsValid = Array.isArray(endPoints) && endPoints.length > 0 && Array.isArray(endPoints[0]);

        if (!startsValid || !endsValid) return false;
        if (!startPoints.length || !endPoints.length) return false;

        try {
            const startArray = this.toJavaPointArray(startPoints, fly);
            const endArray = this.toJavaPointArray(endPoints, fly);
            if (!startArray || !endArray) return false;
            this.setSearchVariantSeed(variantSeed);

            if (fly) {
                return this.pathManager.findFlyPath(startArray, endArray);
            }

            return this.pathManager.findPath(startArray, endArray);
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
        if (!PathManager.hasPath()) {
            this.cachedResult = null;
            return null;
        }

        if (this.cachedResult) {
            return this.cachedResult;
        }

        const pathArr = PathManager.getPathArray();
        const keyArr = PathManager.getKeyNodesArray();
        if (!pathArr || !keyArr) return null;

        const path = [];
        for (let i = 0; i + 2 < pathArr.length; i += 3) {
            path.push({ x: pathArr[i], y: pathArr[i + 1], z: pathArr[i + 2] });
        }

        const keynodes = [];
        for (let i = 0; i + 2 < keyArr.length; i += 3) {
            keynodes.push({ x: keyArr[i], y: keyArr[i + 1], z: keyArr[i + 2] });
        }

        const pathFlags = this.readIntArraySafely(() => PathManager.getPathFlagsArray());
        const keyNodeFlags = this.readIntArraySafely(() => PathManager.getKeyNodeFlagsArray());
        const keyNodeMetrics = this.readIntArraySafely(() => PathManager.getKeyNodeMetricsArray());
        const pathFlagBits = this.readIntArraySafely(() => PathManager.getPathFlagBits());
        const pathSignature = this.readStringSafely(() => PathManager.getPathSignature());

        const result = {
            path: path,
            keynodes: keynodes,
            path_between_key_nodes: path,
            time_ms: PathManager.getLastTimeMs(),
            nodes_explored: PathManager.getNodesExplored(),
            selected_start_index: this.getSelectedStartIndex(),
            path_flags: pathFlags,
            keynode_flags: keyNodeFlags,
            keynode_metrics: keyNodeMetrics,
            path_flag_bits: pathFlagBits,
            path_signature: pathSignature,
        };

        this.cachedResult = result;
        return result;
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
            const out = new Array(arr.length);
            for (let i = 0; i < arr.length; i++) out[i] = Number(arr[i]) || 0;
            return out;
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
