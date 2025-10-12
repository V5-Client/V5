import { Router } from '../../Utility/Router';
import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { MathUtils } from '../../Utility/Math';
import { Keybind } from '../../Utility/Keybinding';
import { Rotations } from '../../Utility/Rotations';
import { RayTrace } from '../../Utility/Raytrace';
import { Chat } from '../../Utility/Chat';
import { Mouse } from '../../Utility/Ungrab';

const { addToggle, addSlider, addMultiToggle, addCategoryItem } =
    global.Categories;

class RouteWalkerer {
    constructor() {
        this.LEFTCLICK = false;
        this.SNEAK = false;
        this.LOCKPITCH = false;
        this.PITCH = 0;

        this.loadedRoute = Router.loadRouteFromFile(
            'routewalkerroutes/empty.txt'
        );
        this.route = this.loadedRoute;
        this.enabled = false;
        this.foundpoint = false;
        this.currentIndex = 0;
        this.etherwarpReady = false;

        this.ACTIONS = {
            WALK: 1,
            ETHERWARP: 2,
        };
        this.action = this.ACTIONS.WALK;

        register('command', () => {
            Client.scheduleTask(2, () => this.RouteWalkerer.register());
            this.enabled = true;
            this.foundpoint = false;
        }).setName('goon');

        register('command', (action, arg2, arg3) => {
            let route = this.route;

            let indexNum = undefined;
            let movementTypeArg = undefined;
            const actionUpper = action ? action.toUpperCase() : '';

            let parsedNum2 = parseInt(arg2);
            let isArg2Index = !isNaN(parsedNum2) && parsedNum2 >= 1;

            if (isArg2Index) {
                indexNum = parsedNum2;
                movementTypeArg = arg3;
            } else {
                indexNum = undefined;
                movementTypeArg = arg2;
            }

            let allowedMovements = ['WALK', 'ETHERWARP', 'AOTV'];

            let userMovement = movementTypeArg
                ? [movementTypeArg.toUpperCase()]
                : [];

            route = Router.Edit(
                actionUpper,
                route,
                'routewalkerroutes/empty.txt',
                indexNum,
                true,
                allowedMovements,
                userMovement
            );

            this.route = route;
        }).setName('routewalker');

        register('postRenderWorld', () => {
            let route = this.route;
            if (!route || route.length === 0) return;

            const getColor = (movement) => {
                if (!movement) return [255, 255, 255, 255];
                switch (movement.toUpperCase()) {
                    case 'WALK':
                        return [0, 128, 255, 255];
                    case 'ETHERWARP':
                        return [170, 0, 255, 255];
                    default:
                        return [255, 255, 255, 255];
                }
            };

            for (let i = 0; i < route.length; i++) {
                const point = route[i];
                if (!this.CheckPoint(point)) return;

                RenderUtils.drawStyledBoxWithText(
                    new Vec3d(point.x, point.y, point.z),
                    getColor(point.movements),
                    5,
                    false,
                    `${i + 1}`
                );

                if (i >= route.length - 1) return;
                const nextPoint = route[i + 1];
                if (!this.CheckPoint(nextPoint)) return;

                RenderUtils.drawLine(
                    new Vec3d(point.x + 0.5, point.y + 1, point.z + 0.5),
                    new Vec3d(
                        nextPoint.x + 0.5,
                        nextPoint.y + 1,
                        nextPoint.z + 0.5
                    ),
                    getColor(nextPoint.movements),
                    3,
                    false
                );
            }
        });

        this.RouteWalkerer = register('tick', () => {
            if (!this.enabled) return;

            if (!this.route || this.route.length === 0) return;

            if (!this.foundpoint) {
                this.data = this.getClosestPoint();
                this.foundpoint = true;
            }

            this.point = this.route[this.currentIndex];
            this.action = this.ACTIONS[this.point.movements];

            let distData = MathUtils.getDistanceToPlayer(
                this.point.x,
                this.point.y,
                this.point.z
            );
            let currentDistance = distData.distance;

            switch (this.action) {
                case this.ACTIONS.WALK:
                    Keybind.setKeysForStraightLineCoords(
                        this.point.x,
                        this.point.y,
                        this.point.z
                    );

                    Keybind.setKey('shift', this.SNEAK);
                    Keybind.setKey('leftclick', this.LEFTCLICK);

                    let angle = MathUtils.calculateAbsoluteAngles(
                        new Vec3d(
                            this.point.x + 0.5,
                            this.point.y + 2,
                            this.point.z + 0.5
                        )
                    );

                    Rotations.rotateToAngles(
                        angle.yaw,
                        this.LOCKPITCH ? this.PITCH : Player.getPitch()
                    );

                    if (currentDistance < 3) {
                        this.etherwarpReady = false;

                        this.currentIndex++;
                        if (this.currentIndex >= this.route.length) {
                            this.currentIndex = 0;
                        }
                    }
                    break;

                case this.ACTIONS.ETHERWARP:
                    Keybind.stopMovement();
                    Keybind.setKey('shift', true);

                    const targetBlockPos = new BlockPos(
                        this.point.x,
                        this.point.y,
                        this.point.z
                    );

                    if (
                        Math.abs(Player.getMotionX()) +
                            Math.abs(Player.getMotionZ()) >
                        0.1
                    )
                        return;

                    let point = RayTrace.getPointOnBlock(
                        targetBlockPos,
                        undefined,
                        false
                    );

                    if (!this.etherwarpReady) {
                        if (point) {
                            Rotations.rotateTo(
                                [point[0], point[1], point[2]],
                                false,
                                175
                            );

                            Rotations.onEndRotation(() => {
                                Keybind.rightClickDelay(7);
                            });
                            this.etherwarpReady = true;
                        } else {
                            Chat.message("Can't see point!");
                        }
                    }

                    if (currentDistance < 3) {
                        this.etherwarpReady = false;

                        this.currentIndex++;
                        if (this.currentIndex >= this.route.length) {
                            this.currentIndex = 0;
                        }
                    }
                    break;
            }
        }).unregister();

        addCategoryItem(
            'Other',
            'Route Walker',
            'Walks and Etherwarps Routes',
            'Walks and Etherwarps Routes'
        );

        addToggle(
            'Modules',
            'Route Walker',
            'Leftclick',
            (value) => {
                this.LEFTCLICK = value;
            },
            'LeftClick while macro is active'
        );
        addToggle(
            'Modules',
            'Route Walker',
            'Sneak',
            (value) => {
                this.SNEAK = value;
            },
            'Sneak while macro is active'
        );
        addToggle(
            'Modules',
            'Route Walker',
            'Lock Pitch',
            (value) => {
                this.LOCKPITCH = value;
            },
            'Lock Pitch while macro is active'
        );
        addSlider(
            'Modules',
            'Route Walker',
            'Pitch',
            90,
            -90,
            45,
            (value) => {
                this.PITCH = value;
            },
            'Pitch set to amount'
        );
        /*addSlider(
            'Modules',
            'RouteWalker',
            'Pitch',
            -90,
            90,
            45,
            (value) => {
                this.tickCount = value;
            },
            'Pitch set to amount'
        ); */
    }

    CheckPoint(point) {
        if (
            point &&
            typeof point.x === 'number' &&
            typeof point.y === 'number' &&
            typeof point.z === 'number'
        )
            return true;

        return false;
    }

    getClosestPoint() {
        if (!this.route || this.route.length === 0) {
            return null;
        }

        let closestPointData = null;
        let shortestDistance = Infinity;

        for (let i = 0; i < this.route.length; i++) {
            const point = this.route[i];

            if (
                point &&
                typeof point.x === 'number' &&
                typeof point.y === 'number' &&
                typeof point.z === 'number'
            ) {
                let distData = MathUtils.getDistanceToPlayer(
                    point.x,
                    point.y,
                    point.z
                );
                let currentDistance = distData.distance;

                if (currentDistance < shortestDistance) {
                    shortestDistance = currentDistance;

                    closestPointData = {
                        point: point,
                        distance: currentDistance,
                        index: i,
                    };
                }
            }
        }

        if (closestPointData) {
            this.currentIndex = closestPointData.index;
        }

        return closestPointData;
    }
}

new RouteWalkerer();
