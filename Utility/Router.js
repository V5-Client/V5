import RenderUtils from '../Rendering/RendererUtils';
import { Utils } from './Utils';
import { Chat } from './Chat';
import { Vec3d } from './Constants';
import { File } from './Constants';
import { closeGui } from '../GUI/GUI';

class Routes {
    constructor() {}

    /**
     * Checks a file path and returns all files in that directory.
     * @param {*} folder The directory in V5Config
     * @returns all files in that directory
     */
    getFilesinDir(folder) {
        let mcDir = new File(Client.getMinecraft().runDirectory);
        let configPath = new File(mcDir, 'config/ChatTriggers/modules/V5Config/' + folder);

        if (!configPath.exists() || !configPath.isDirectory()) {
            ChatLib.chat(`&cError: Directory not found.`);
            return [];
        }

        const fileArray = configPath.listFiles();
        const fileNames = [];

        if (!fileArray) return;

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];

            let name = file.getName();
            name = name.replace('.txt', '');

            fileNames.push(name);
        }

        return fileNames;
    }

    /**
     * Returns the enabled file (route) in an array
     * @param {*} callback an array of configuration objects
     * @returns the enabled file in a directory
     */
    getFilefromCallback(callback) {
        let enabledObjects = callback.filter((item) => item.enabled === true);
        let enabledRouteNames = enabledObjects.map((item) => item.name);

        if (enabledRouteNames.length === 0) return null;

        let fileName = enabledRouteNames.join(', ') + '.txt';
        return fileName;
    }

    /**
     * Receives a file from the config directory and gets the files data.
     * @param {*} dir the directory of the file
     * @param {*} file the files name
     * @returns the data in the file or null if no file
     */
    loadRouteFromFile(dir, file) {
        if (!file) return console.log('No file accessed!');
        try {
            let routeData = Utils.getConfigFile(dir + file);

            if (routeData) return routeData;
        } catch (error) {
            return null;
        }

        return null;
    }

    /**
     * Saves data to a file in the config directory.
     * @param {*} dir the directory of the file
     * @param {*} file the files name
     */
    saveRouteToFile(dir, file) {
        try {
            Utils.writeConfigFile(dir, file);
        } catch (error) {}
    }

    /**
     * A helper function which creates routes for mutliple different modules.
     * @param {*} action the type of waypoint, "ADD", "REMOVE", "CLEAR"
     * @param {*} route the route the function is adding, removing or clearing of
     * @param {*} file the file to save the route to
     * @param {*} indexNum the index the waypoint should be set to e.g. 1 or 15
     * @param {*} takeMovementTypes decides wether the route should take more complex actions, e.g. "WALK", "ETHERWARP"
     * @param {*} allowedMovements
     * @param {*} userMovementInput
     * @returns returns the updated or unchanged route
     */
    Edit(action, route, file, indexNum, takeMovementTypes = false, allowedMovements = [], userMovementInput = '') {
        let indexToUse = undefined;
        if (typeof indexNum === 'number' && !isNaN(indexNum) && indexNum >= 1) {
            indexToUse = indexNum;
        }

        if (!route) {
            return Chat.message("You don't have a route selected");
        }

        let routeModified = false;

        switch (action) {
            case 'ADD':
                let point = {
                    x: Math.floor(Player.getX()),
                    y: Math.floor(Player.getY() - 1),
                    z: Math.floor(Player.getZ()),
                };

                let isValidWaypoint = true;

                let allowedMovementsSet = new Set(Array.isArray(allowedMovements) ? allowedMovements.map((m) => m.toUpperCase()) : null);

                if (takeMovementTypes) {
                    if (!Array.isArray(userMovementInput) || userMovementInput.length === 0) {
                        Chat.message('ERROR: Movement type required. Waypoint not added.');
                        return route;
                    }

                    let userMovementUpper = userMovementInput[0].toUpperCase();

                    if (allowedMovementsSet.has(userMovementUpper)) {
                        point.movements = userMovementUpper;
                    } else {
                        isValidWaypoint = false;
                        Chat.message(`ERROR: Movement type '${userMovementInput[0]}' not supported. Waypoint not added.`);
                        return route;
                    }
                }

                if (isValidWaypoint) {
                    if (indexToUse !== undefined) {
                        let arrayIndex = indexToUse - 1;

                        if (arrayIndex >= 0 && arrayIndex <= route.length) {
                            route.splice(arrayIndex, 0, point);
                            routeModified = true;
                            Chat.message(`Added waypoint ${indexToUse}`);
                        } else {
                            route.push(point);
                            routeModified = true;
                            Chat.message(`Invalid waypoint position, adding to the end.`);
                        }
                    } else {
                        route.push(point);
                        routeModified = true;
                        Chat.message(`Added waypoint to the end of the route.`);
                    }
                }
                break;

            case 'REMOVE':
                if (indexToUse !== undefined) {
                    let arrayIndex = indexToUse - 1;

                    if (arrayIndex >= 0 && arrayIndex < route.length) {
                        route.splice(arrayIndex, 1)[0];
                        routeModified = true;
                        Chat.message(`Removed waypoint ${indexToUse}`);
                    } else {
                        if (route.length > 0) {
                            route.pop();
                            routeModified = true;
                            Chat.message(`Invalid waypoint position, removing the last waypoint.`);
                        } else {
                            Chat.message('Route is already empty!');
                        }
                    }
                } else {
                    if (route.length > 0) {
                        route.pop();
                        routeModified = true;
                        Chat.message(`Removed the last waypoint.`);
                    } else {
                        Chat.message('Route is already empty!');
                    }
                }
                break;

            case 'CLEAR':
                if (route.length > 0) {
                    route.length = 0;
                    routeModified = true;
                    const lastSlashIndex = file.lastIndexOf('/');
                    let filename = file;
                    if (lastSlashIndex !== -1) filename = file.substring(lastSlashIndex + 1);

                    Chat.message(`Cleared all waypoints from the route ${filename}`);
                } else {
                    Chat.message('Route is already empty!');
                }
                break;

            default:
                Chat.message('You did not state an action!');
                return route;
        }

        if (routeModified) this.saveRouteToFile(route, file);

        return route;
    }
}

export const Router = new Routes();
