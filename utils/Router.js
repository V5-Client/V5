import { chat } from './Chat';
import { File } from './Constants';
import { getConfigFile, writeConfigFile } from './Utils';

function toDisplayFileName(filePath) {
    return typeof filePath === 'string' ? filePath.split('/').pop() || 'unknown' : 'unknown';
}

function normalizeRoute(rawRoute) {
    if (!rawRoute) return [];

    const routeArray = Array.isArray(rawRoute) ? rawRoute : Array.isArray(rawRoute.points) ? rawRoute.points : null;
    if (!routeArray) return [];

    const normalized = [];
    for (const point of routeArray) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) continue;

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

function canSaveRoute(fileName) {
    return !!fileName && typeof fileName === 'string' && !fileName.includes('/null') && !fileName.includes('/undefined');
}

/**
 * Checks a file path and returns all files in that directory.
 * @param {*} folder The directory in V5Config
 * @returns all files in that directory
 */
export function getFilesInDir(folder) {
    const mcDir = Client.getMinecraft().gameDirectory;
    let configPath = new File(mcDir, 'config/ChatTriggers/modules/V5Config/' + folder);

    if (!configPath.exists() || !configPath.isDirectory()) {
        chat(`&cError: Directory not found.`);
        return [];
    }

    const fileArray = configPath.listFiles();
    if (!fileArray) return [];
    return Array.from(fileArray)
        .filter((file) => file?.isFile() && file.getName().endsWith('.json'))
        .map((file) => file.getName().slice(0, -5))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Returns the enabled file (route) in an array
 * @param {*} callback an array of configuration objects
 * @returns the enabled file in a directory
 */
export function getFileFromCallback(callback) {
    if (!Array.isArray(callback)) return null;
    const routeName = callback.find((item) => item?.enabled === true)?.name;
    return routeName ? `${routeName}.json` : null;
}

/**
 * Receives a file from the config directory and gets the files data.
 * @param {*} dir the directory of the file
 * @param {*} file the file name
 * @returns the data in the file or null if no file
 */
export function loadRouteFromFile(dir, file) {
    if (!file) return [];

    return normalizeRoute(getConfigFile(dir + file));
}

/**
 * Saves data to a file in the config directory.
 * @param {*} fileName the route file path
 * @param {*} routeData the route data
 */
export function saveRouteToFile(fileName, routeData) {
    if (!canSaveRoute(fileName)) {
        chat('&cNo route file selected. Select a route before editing.');
        return false;
    }

    return writeConfigFile(fileName, normalizeRoute(routeData));
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
export function editRoute(action, route, file, indexNum, takeMovementTypes = false, allowedMovements = [], userMovementInput = '', addPoinToLook = false) {
    let indexToUse = undefined;
    if (typeof indexNum === 'number' && !Number.isNaN(indexNum) && indexNum >= 1) {
        indexToUse = indexNum;
    }

    if (!canSaveRoute(file)) {
        chat('&cNo route file selected. Select one in the settings first.');
        return normalizeRoute(route);
    }

    let normalizedRoute = normalizeRoute(route);
    if (route !== null && route !== undefined && !Array.isArray(route)) {
        chat('Invalid route data. Resetting to an empty route.');
    }

    let routeModified = false;
    const actionUpper = typeof action === 'string' ? action.toUpperCase() : '';

    switch (actionUpper) {
        case 'ADD':
            let point = {};

            if (addPoinToLook) {
                let looking = Player.lookingAt();
                if (!looking) {
                    chat('You are not looking at anything');
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
                    chat('ERROR: Movement type required. Waypoint not added.');
                    return normalizedRoute;
                }

                let userMovementUpper = movementToVerify.toUpperCase();

                if (allowedMovementsSet.has(userMovementUpper)) {
                    point.movements = userMovementUpper;
                } else {
                    chat(`ERROR: Movement type '${movementToVerify}' not supported.`);
                    return normalizedRoute;
                }
            }

            if (indexToUse !== undefined) {
                let arrayIndex = indexToUse - 1;

                if (arrayIndex >= 0 && arrayIndex <= normalizedRoute.length) {
                    normalizedRoute.splice(arrayIndex, 0, point);
                    routeModified = true;
                    chat(`Added waypoint ${indexToUse}`);
                } else {
                    normalizedRoute.push(point);
                    routeModified = true;
                    chat(`Invalid waypoint position, adding to the end.`);
                }
            } else {
                normalizedRoute.push(point);
                routeModified = true;
                chat(`Added waypoint to the end of the route.`);
            }
            break;

        case 'REMOVE':
            if (!normalizedRoute.length) {
                chat('Route is already empty!');
                break;
            }
            const hasValidIndex = indexToUse !== undefined && indexToUse <= normalizedRoute.length;
            const removeIndex = hasValidIndex ? indexToUse - 1 : normalizedRoute.length - 1;
            normalizedRoute.splice(removeIndex, 1);
            routeModified = true;
            chat(
                hasValidIndex
                    ? `Removed waypoint ${indexToUse}`
                    : indexToUse
                      ? 'Invalid waypoint position, removing the last waypoint.'
                      : 'Removed the last waypoint.'
            );
            break;

        case 'CLEAR':
            if (normalizedRoute.length > 0) {
                normalizedRoute.length = 0;
                routeModified = true;
                const filename = toDisplayFileName(file);

                chat(`Cleared all waypoints from the route ${filename}`);
            } else {
                chat('Route is already empty!');
            }
            break;

        default:
            chat('You did not state an action!');
            return normalizedRoute;
    }

    if (routeModified) saveRouteToFile(file, normalizedRoute);

    return normalizedRoute;
}
