import { Chat } from './Chat';
import { File } from './Constants';
import { Utils } from './Utils';

class Routes {
    constructor() {}

    _toDisplayFileName(filePath) {
        if (!filePath || typeof filePath !== 'string') return 'unknown';
        const lastSlashIndex = filePath.lastIndexOf('/');
        return lastSlashIndex === -1 ? filePath : filePath.substring(lastSlashIndex + 1);
    }

    _normalizeRoute(rawRoute) {
        if (!rawRoute) return [];

        const routeArray = Array.isArray(rawRoute) ? rawRoute : Array.isArray(rawRoute.points) ? rawRoute.points : null;
        if (!routeArray) return [];

        const normalized = [];
        for (const point of routeArray) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || typeof point.z !== 'number') continue;

            const normalizedPoint = {
                x: Math.floor(point.x),
                y: Math.floor(point.y),
                z: Math.floor(point.z),
            };

            if (typeof point.movements === 'string' && point.movements.length > 0) {
                normalizedPoint.movements = point.movements.toUpperCase();
            }

            normalized.push(normalizedPoint);
        }

        return normalized;
    }

    _canSaveRoute(fileName) {
        if (!fileName || typeof fileName !== 'string') return false;
        if (fileName.includes('/null') || fileName.includes('/undefined')) return false;
        return true;
    }

    /**
     * Checks a file path and returns all files in that directory.
     * @param {*} folder The directory in V5Config
     * @returns all files in that directory
     */
    getFilesinDir(folder) {
        let mcDir = new File(Client.getMinecraft().runDirectory);
        let configPath = new File(mcDir, 'config/ChatTriggers/modules/V5Config/' + folder);

        if (!configPath.exists() || !configPath.isDirectory()) {
            Chat.message(`&cError: Directory not found.`);
            return [];
        }

        const fileArray = configPath.listFiles();
        const fileNames = [];

        if (!fileArray) return [];

        for (const file of fileArray) {
            if (!file || !file.isFile()) continue;

            let name = file.getName();
            if (!name.endsWith('.json')) continue;
            name = name.substring(0, name.length - 5);

            fileNames.push(name);
        }

        fileNames.sort((a, b) => a.localeCompare(b));
        return fileNames;
    }

    /**
     * Returns the enabled file (route) in an array
     * @param {*} callback an array of configuration objects
     * @returns the enabled file in a directory
     */
    getFilefromCallback(callback) {
        if (!Array.isArray(callback)) return null;

        let enabledObjects = callback.filter((item) => item.enabled === true);
        let enabledRouteNames = enabledObjects.map((item) => item.name);

        if (enabledRouteNames.length === 0) return null;

        let fileName = enabledRouteNames[0] + '.json';
        return fileName;
    }

    /**
     * Receives a file from the config directory and gets the files data.
     * @param {*} dir the directory of the file
     * @param {*} file the files name
     * @returns the data in the file or null if no file
     */
    loadRouteFromFile(dir, file) {
        if (!file) return [];

        try {
            let routeData = Utils.getConfigFile(dir + file);

            return this._normalizeRoute(routeData);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return [];
        }
    }

    /**
     * Saves data to a file in the config directory.
     * @param {*} dir the directory of the file
     * @param {*} file the files name
     */
    saveRouteToFile(fileName, routeData) {
        if (!this._canSaveRoute(fileName)) {
            Chat.message('&cNo route file selected. Select a route before editing.');
            return false;
        }

        try {
            return Utils.writeConfigFile(fileName, this._normalizeRoute(routeData));
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
    }

    /**
     * A helper function which creates routes for mutliple different modules.
     * @param {*} action the type of waypoint, "ADD", "REMOVE", "CLEAR"
     * @param {*} route the route the function is adding, removing or clearing of
     * @param {*} file the file to save the route to
     * @param {*} indexNum the index the waypoint should be set to e.g. 1 or 15
     * @param {*} takeMovementTypes decides wether the route should take more complex actions, e.g. "WALK", "ETHERWARP"
     * @param {*} allowedMovements movement types allowed for the waypoint
     * @param {*} userMovementInput movement type selected by the user
     * @param {*} addPoinToLook decides wether the waypoint should be set where the player is looking or where the player is standing
     * @returns returns the updated or unchanged route
     */
    Edit(action, route, file, indexNum, takeMovementTypes = false, allowedMovements = [], userMovementInput = '', addPoinToLook = false) {
        let indexToUse = undefined;
        if (typeof indexNum === 'number' && !Number.isNaN(indexNum) && indexNum >= 1) {
            indexToUse = indexNum;
        }

        if (!this._canSaveRoute(file)) {
            Chat.message('&cNo route file selected. Select one in the settings first.');
            return this._normalizeRoute(route);
        }

        let normalizedRoute = this._normalizeRoute(route);
        if (route !== null && route !== undefined && !Array.isArray(route)) {
            Chat.message('Invalid route data. Resetting to an empty route.');
        }

        let routeModified = false;
        const actionUpper = typeof action === 'string' ? action.toUpperCase() : '';

        switch (actionUpper) {
            case 'ADD':
                let point = {};

                if (addPoinToLook) {
                    let looking = Player.lookingAt();
                    if (!looking) {
                        Chat.message('You are not looking at anything');
                        return normalizedRoute;
                    }
                    point.x = Math.floor(looking.x);
                    point.y = Math.floor(looking.y);
                    point.z = Math.floor(looking.z);
                } else {
                    point.x = Math.floor(Player.getX());
                    point.y = Math.floor(Player.getY() - 0.001);
                    point.z = Math.floor(Player.getZ());
                }

                const allowedMovementsSet = new Set(Array.isArray(allowedMovements) ? allowedMovements.map((m) => String(m).toUpperCase()) : []);

                if (takeMovementTypes) {
                    let movementToVerify = Array.isArray(userMovementInput) ? userMovementInput[0] : userMovementInput;

                    if (!movementToVerify) {
                        Chat.message('ERROR: Movement type required. Waypoint not added.');
                        return normalizedRoute;
                    }

                    let userMovementUpper = movementToVerify.toUpperCase();

                    if (allowedMovementsSet.has(userMovementUpper)) {
                        point.movements = userMovementUpper;
                    } else {
                        Chat.message(`ERROR: Movement type '${movementToVerify}' not supported.`);
                        return normalizedRoute;
                    }
                }

                if (indexToUse !== undefined) {
                    let arrayIndex = indexToUse - 1;

                    if (arrayIndex >= 0 && arrayIndex <= normalizedRoute.length) {
                        normalizedRoute.splice(arrayIndex, 0, point);
                        routeModified = true;
                        Chat.message(`Added waypoint ${indexToUse}`);
                    } else {
                        normalizedRoute.push(point);
                        routeModified = true;
                        Chat.message(`Invalid waypoint position, adding to the end.`);
                    }
                } else {
                    normalizedRoute.push(point);
                    routeModified = true;
                    Chat.message(`Added waypoint to the end of the route.`);
                }
                break;

            case 'REMOVE':
                if (indexToUse !== undefined) {
                    let arrayIndex = indexToUse - 1;

                    if (arrayIndex >= 0 && arrayIndex < normalizedRoute.length) {
                        normalizedRoute.splice(arrayIndex, 1);
                        routeModified = true;
                        Chat.message(`Removed waypoint ${indexToUse}`);
                    } else {
                        if (normalizedRoute.length > 0) {
                            normalizedRoute.pop();
                            routeModified = true;
                            Chat.message(`Invalid waypoint position, removing the last waypoint.`);
                        } else {
                            Chat.message('Route is already empty!');
                        }
                    }
                } else {
                    if (normalizedRoute.length > 0) {
                        normalizedRoute.pop();
                        routeModified = true;
                        Chat.message(`Removed the last waypoint.`);
                    } else {
                        Chat.message('Route is already empty!');
                    }
                }
                break;

            case 'CLEAR':
                if (normalizedRoute.length > 0) {
                    normalizedRoute.length = 0;
                    routeModified = true;
                    const filename = this._toDisplayFileName(file);

                    Chat.message(`Cleared all waypoints from the route ${filename}`);
                } else {
                    Chat.message('Route is already empty!');
                }
                break;

            default:
                Chat.message('You did not state an action!');
                return normalizedRoute;
        }

        if (routeModified) this.saveRouteToFile(file, normalizedRoute);

        return normalizedRoute;
    }
}

export const Router = new Routes();
