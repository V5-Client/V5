import { PathManager } from '../Constants.js';

class SwiftIntegration {
    constructor() {
        this.pathManager = PathManager;
    }

    SwiftPath(startX, startY, startZ, endX, endY, endZ) {
        return this.pathManager.findPath(startX, startY + 1, startZ, endX, endY + 1, endZ);
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
