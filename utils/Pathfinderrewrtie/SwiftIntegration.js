import { PathManager } from '../Constants.js';

class SwiftIntegration {
    constructor() {
        this.pathManager = PathManager;
    }

    SwiftPath(startX, startY, startZ, endInput) {
        let flatGoals = [];
        if (Array.isArray(endInput) && Array.isArray(endInput[0])) {
            endInput.forEach((coord) => flatGoals.push(...coord));
        } else {
            flatGoals = endInput;
        }

        try {
            const javaArray = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, flatGoals.length);
            for (let i = 0; i < flatGoals.length; i++) {
                javaArray[i] = i % 3 === 1 ? flatGoals[i] + 1 : flatGoals[i];
            }

            return this.pathManager.findPathMultipleGoals(startX, startY + 1, startZ, javaArray);
        } catch (e) {
            console.error('SwiftPath Error converting array: ' + e);
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
