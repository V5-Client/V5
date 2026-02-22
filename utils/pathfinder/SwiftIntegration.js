import { PathManager } from '../Constants.js';

class SwiftIntegration {
    constructor() {
        this.pathManager = PathManager;
    }

    toIntPoint(point, isFly) {
        if (!Array.isArray(point) || point.length < 3) return null;

        const x = Math.floor(Number(point[0]));
        const yBase = Math.floor(Number(point[1]));
        const z = Math.floor(Number(point[2]));

        if (Number.isNaN(x) || Number.isNaN(yBase) || Number.isNaN(z)) return null;

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

    // I dont know what codex wrote but it works
    // This needs to be fixed but anytime i change anything it breaks more
    // Good luck for whoever tries next
    SwiftPath(startPoints, endPoints, isFly = false) {
        const fly = isFly === true;
        const startsValid = Array.isArray(startPoints) && startPoints.length > 0 && Array.isArray(startPoints[0]);
        const endsValid = Array.isArray(endPoints) && endPoints.length > 0 && Array.isArray(endPoints[0]);

        if (!startsValid || !endsValid) return false;
        if (!startPoints.length || !endPoints.length) return false;

        try {
            const startArray = this.toJavaPointArray(startPoints, fly);
            const endArray = this.toJavaPointArray(endPoints, fly);
            if (!startArray || !endArray) return false;

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
        if (!PathManager.hasPath()) return null;

        const pathArr = PathManager.getPathArray();
        const keyArr = PathManager.getKeyNodesArray();

        const path = [];
        for (let i = 0; i < pathArr.length; i += 3) {
            path.push({ x: pathArr[i], y: pathArr[i + 1], z: pathArr[i + 2] });
        }

        const keynodes = [];
        for (let i = 0; i < keyArr.length; i += 3) {
            keynodes.push({ x: keyArr[i], y: keyArr[i + 1], z: keyArr[i + 2] });
        }

        return {
            path: path,
            keynodes: keynodes,
            path_between_key_nodes: path,
            time_ms: PathManager.getLastTimeMs(),
            nodes_explored: PathManager.getNodesExplored(),
        };
    }

    getLastError() {
        return PathManager.getLastError();
    }

    cancel() {
        PathManager.cancelSearch();
    }

    clear() {
        PathManager.clear();
    }
}

export const Swift = new SwiftIntegration();
