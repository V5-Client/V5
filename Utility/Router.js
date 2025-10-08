import RenderUtils from '../Rendering/RendererUtils';
import { Utils } from './Utils';
import { Chat } from './Chat';
import { Vec3d } from './Constants';

class Routes {
    constructor() {
        this.DEFAULT_FILE_ROUTE = 'gemstoneroutes/default_route.txt';

        this.myWaypointRoute =
            this.loadRouteFromFile(this.DEFAULT_FILE_ROUTE) || [];

        register('command', (action, indexArg) => {
            let route = this.myWaypointRoute;
            let indexNum = undefined;

            if (indexArg !== undefined) {
                let parsedNum = parseInt(indexArg);

                if (!isNaN(parsedNum) && parsedNum >= 1) {
                    indexNum = parsedNum;
                }
            }

            route = this.simpleEdit(action.toUpperCase(), route, indexNum);
            this.myWaypointRoute = route;

            Chat.message(
                `Action ${action} performed on route. Route now has ${route.length} points.`
            );
        })
            .setName('waypoint')
            .setAliases(['wp', 'route']);
    }

    /**
     * @param {String} Name
     * @param {Array} Location
     * @param {Array} Color
     * @param {Number} size
     * @param {Boolean} increase
     */
    drawString(
        Name,
        Location,
        Color = [255, 255, 255],
        size = 0.3,
        increase = false
    ) {
        RenderUtils.drawString({
            // Text to render (required)
            text: Name,
            // Coordinates (required)
            x: Location[0] + 0.5,
            y: Location[1] + 0.5,
            z: Location[2] + 0.5,
            // Optional parameters
            color: Renderer.color(Color[0], Color[1], Color[2]),
            renderBlackBox: true, // Corresponds to your old 'true' argument
            scale: size,
            increase: increase,
        });
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

    /**
     * @param {String} action
     * @param {Array<Object>} route
     * @param {number | undefined} indexNum
     */
    simpleEdit(action, route, indexNum) {
        let indexToUse = undefined;
        // Logic to determine indexToUse from indexNum only
        if (typeof indexNum === 'number' && !isNaN(indexNum) && indexNum >= 1) {
            indexToUse = indexNum;
        }

        let routeModified = false;

        switch (action) {
            case 'ADD':
                let point = {
                    x: Math.floor(Player.getX()),
                    y: Math.floor(Player.getY() - 1),
                    z: Math.floor(Player.getZ()),
                };

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

        if (routeModified) {
            this.saveRouteToFile(route, this.DEFAULT_FILE_ROUTE);
        }

        return route;
    }
}

export const Router = new Routes();
