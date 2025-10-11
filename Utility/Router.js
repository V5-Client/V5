import RenderUtils from '../Rendering/RendererUtils';
import { Utils } from './Utils';
import { Chat } from './Chat';
import { Vec3d } from './Constants';

class Routes {
    constructor() {
        this.DEFAULT_FILE_ROUTE = 'gemstoneroutes/default_route.txt';
    }

    loadRouteFromFile(fileLocation) {
        try {
            let routeData = Utils.getConfigFile(fileLocation);

            if (routeData) return routeData;
        } catch (error) {
            return null;
        }

        return null;
    }

    saveRouteToFile(route, fileLocation) {
        try {
            Utils.writeConfigFile(fileLocation, route);

            Chat.message(`Route saved successfully to: ${fileLocation}`);
        } catch (error) {
            Chat.message(
                `ERROR saving route to ${fileLocation}: ${error.message}`
            );
        }
    }

    Edit(
        action,
        route,
        file,
        indexNum,
        takeMovementTypes = false,
        allowedMovements = [],
        userMovementInput = ''
    ) {
        let indexToUse = undefined;
        if (typeof indexNum === 'number' && !isNaN(indexNum) && indexNum >= 1) {
            indexToUse = indexNum;
        }

        let routeModified = false;

        switch (action) {
            case 'OFF':
                Chat.message(
                    'Route editing is currently OFF. No changes made.'
                );
                return route;

            case 'ADD':
                let point = {
                    x: Math.floor(Player.getX()),
                    y: Math.floor(Player.getY() - 1),
                    z: Math.floor(Player.getZ()),
                };

                let isValidWaypoint = true;

                let allowedMovementsSet = new Set(
                    Array.isArray(allowedMovements)
                        ? allowedMovements.map((m) => m.toUpperCase())
                        : null
                );

                if (takeMovementTypes) {
                    if (
                        !Array.isArray(userMovementInput) ||
                        userMovementInput.length === 0
                    ) {
                        Chat.message(
                            'ERROR: Movement type required for this command. Waypoint not added.'
                        );
                        return route;
                    }

                    let userMovementUpper = userMovementInput[0].toUpperCase();

                    if (allowedMovementsSet.has(userMovementUpper)) {
                        point.movements = userMovementUpper;
                    } else {
                        isValidWaypoint = false;
                        Chat.message(
                            `ERROR: Movement type '${userMovementInput[0]}' not supported. Waypoint not added.`
                        );
                        return route;
                    }
                }

                if (isValidWaypoint) {
                    if (indexToUse !== undefined) {
                        let arrayIndex = indexToUse - 1;

                        if (arrayIndex >= 0 && arrayIndex <= route.length) {
                            route.splice(arrayIndex, 0, point);
                            routeModified = true;
                        } else {
                            route.push(point);
                            routeModified = true;
                            Chat.message(
                                `Invalid index ${indexToUse}. Added point to the end.`
                            );
                        }
                    } else {
                        route.push(point);
                        routeModified = true;
                    }
                }
                break;

            case 'REMOVE':
                if (indexToUse !== undefined) {
                    let arrayIndex = indexToUse - 1;

                    if (arrayIndex >= 0 && arrayIndex < route.length) {
                        const removed = route.splice(arrayIndex, 1)[0];
                        routeModified = true;
                        Chat.message(
                            `Removed waypoint ${indexToUse} [${removed.x}, ${removed.y}, ${removed.z}]`
                        );
                    } else {
                        Chat.message(
                            `Invalid index ${indexToUse}. Cannot remove point.`
                        );
                    }
                } else {
                    if (route.length > 0) {
                        const removed = route.pop();
                        routeModified = true;
                        Chat.message(
                            `Removed last waypoint [${removed.x}, ${removed.y}, ${removed.z}]`
                        );
                    } else {
                        Chat.message('Route is already empty.');
                    }
                }
                break;

            case 'CLEAR':
                if (route.length > 0) {
                    route.length = 0;
                    routeModified = true;
                    Chat.message('Cleared all points from the route.');
                } else {
                    Chat.message('Route is already empty.');
                }
                break;

            default:
                Chat.message(action + ' is not a valid edit action');
                return route;
        }

        if (routeModified) this.saveRouteToFile(route, file);

        return route;
    }
}

export const Router = new Routes();
