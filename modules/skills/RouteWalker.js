//@VIP
import { Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Raytrace } from '../../utils/Raytrace';
import Render from '../../utils/render/Render';
import { Router } from '../../utils/Router';
import RouteState from '../../utils/RouteState';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Mouse } from '../../utils/Ungrab';
import { v5Command } from '../../utils/V5Commands';

class RouteWalkerer extends ModuleBase {
    constructor() {
        super({
            name: 'Route Walker',
            subcategory: 'Skills',
            description: 'Follows multiple points in a route',
            tooltip: 'Etherwarps and walks to multiple points in a route',
            showEnabledToggle: false,
            isMacro: true,
        });

        this.bindToggleKey();
        this.setTheme('#65a6f0');

        this.routesDir = Router.getFilesinDir('RoutewalkerRoutes');

        this.LEFTCLICK = false;
        this.SNEAK = false;
        this.LOCKPITCH = false;
        this.PITCH = 0;
        this.RENDERPOINTS = false;
        this.LEFTCLICKSLOT = 0;

        this.foundpoint = false;
        this.currentIndex = 0;
        this.etherwarpReady = false;

        this.ACTIONS = {
            WALK: 1,
            ETHERWARP: 2,
        };

        this.action = this.ACTIONS.WALK;

        v5Command('routewalker', (action, arg1, indexArg) => {
            let indexNum = undefined;

            const actionUpper = action?.toUpperCase();
            if (actionUpper === 'ADD' && !arg1) return this.message('Movement type required! e.g /v5 routes add WALK/ETHERWARP');
            if (actionUpper === 'CREATE') {
                const createdRouteId = `${Date.now()}`;
                const createdRouteName = `${createdRouteId}.json`;
                const createdRoutePath = `RoutewalkerRoutes/${createdRouteName}`;

                if (!Router.saveRouteToFile(createdRoutePath, [])) return;

                this.loadedFile = createdRouteName;
                this.route = [];
                this.refreshRoutesToggle();
                RouteState.setRoute(this.route, 'Route Walker');
                this.message(`&aCreated route: &f${createdRouteName}`);
                return;
            }

            if (indexArg !== undefined) {
                let parsedNum = Number.parseInt(indexArg);

                if (!Number.isNaN(parsedNum) && parsedNum >= 1) indexNum = parsedNum;
            }

            this.route = Router.Edit(
                actionUpper,
                this.route,
                'RoutewalkerRoutes/' + this.loadedFile,
                indexNum,
                true,
                ['WALK', 'ETHERWARP'],
                [arg1?.toUpperCase()]
            );
        });

        this.when(
            () => this.RENDERPOINTS,
            'postRenderWorld',
            () => {
                let route = this.route;
                if (!route || route.length === 0) return;

                const getColor = (movement) => {
                    if (!movement) return Render.Color(255, 255, 255, 255);
                    switch (movement.toUpperCase()) {
                        case 'WALK':
                            return Render.Color(0, 128, 255, 80);
                        case 'ETHERWARP':
                            return Render.Color(170, 0, 255, 80);
                        default:
                            return Render.Color(255, 255, 255, 80);
                    }
                };

                route.forEach((point, i) => {
                    if (!this.checkPoint(point)) return;

                    const pointColor = getColor(point.movements);

                    Render.drawStyledBox(new Vec3d(point.x, point.y, point.z), pointColor, pointColor, 4, false);

                    if (i < route.length - 1) {
                        const nextPoint = route[i + 1];
                        if (!this.checkPoint(nextPoint)) return;
                        Render.drawLine(
                            new Vec3d(point.x + 0.5, point.y + 1, point.z + 0.5),
                            new Vec3d(nextPoint.x + 0.5, nextPoint.y + 1, nextPoint.z + 0.5),
                            getColor(nextPoint.movements),
                            3,
                            false
                        );
                    }
                });

                const firstPoint = route[0];
                const lastPoint = route[route.length - 1];

                if (route.length < 1 || !this.checkPoint(firstPoint) || !this.checkPoint(lastPoint)) return;

                Render.drawLine(
                    new Vec3d(lastPoint.x + 0.5, lastPoint.y + 1, lastPoint.z + 0.5),
                    new Vec3d(firstPoint.x + 0.5, firstPoint.y + 1, firstPoint.z + 0.5),
                    getColor(firstPoint.movements),
                    3,
                    false
                );
            }
        );

        this.on('tick', () => {
            if (!this.route || this.route.length === 0) return;
            const player = Player.getPlayer();
            if (!player) return;

            if (!this.foundpoint) {
                this.data = this.getClosestPoint();
                this.foundpoint = true;
            }

            this.point = this.route[this.currentIndex];
            if (!this.point) return;
            this.action = this.ACTIONS[this.point.movements];

            let distData = MathUtils.getDistanceToPlayer(this.point.x, this.point.y, this.point.z);
            let currentDistance = distData.distance;

            switch (this.action) {
                case this.ACTIONS.WALK:
                    Keybind.setKeysForStraightLineCoords(this.point.x, this.point.y, this.point.z, true, true);

                    Keybind.setKey('shift', this.SNEAK);
                    Keybind.setKey('leftclick', this.LEFTCLICK);
                    Keybind.setKey('sprint', true);

                    if (this.LEFTCLICK) Guis.setItemSlot(this.LEFTCLICKSLOT - 1);

                    let angle = MathUtils.calculateAbsoluteAngles(new Vec3d(this.point.x + 0.5, this.point.y + 2, this.point.z + 0.5));

                    Rotations.rotateToAngles(angle.yaw, this.LOCKPITCH ? this.PITCH : player.getPitch(), 1.0, false);

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

                    let aotv = Guis.findItemInHotbar('Aspect of the Void');
                    if (aotv === -1) aotv = Guis.findItemInHotbar('Aspect of the End'); // can aote etherwarp?

                    if (aotv === -1) {
                        this.toggle(false);
                        this.message('&cYou dont have an etherwarping item!');
                        return;
                    }

                    Guis.setItemSlot(aotv);

                    const targetBlockPos = new BlockPos(this.point.x, this.point.y, this.point.z);

                    if (Math.abs(player.getMotionX()) + Math.abs(player.getMotionZ()) > 0.1) return;

                    let point = Raytrace.getVisiblePoint(targetBlockPos.getX(), targetBlockPos.getY(), targetBlockPos.getZ(), false);

                    if (!this.etherwarpReady) {
                        if (point) {
                            Rotations.rotateToVector([point[0], point[1], point[2]], 0.5, false);

                            Rotations.onEndRotation(() => {
                                ScheduleTask(7, () => {
                                    Keybind.rightClick();
                                });
                            });
                            this.etherwarpReady = true;
                        } else {
                            this.message("&cCan't see point!");
                            this.toggle(false);
                            return;
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
        });

        this.routesToggle = this.addMultiToggle(
            'Routes',
            this.routesDir,
            true,
            (selected) => {
                this.loadedFile = Router.getFilefromCallback(selected);
                this.route = Router.loadRouteFromFile('RoutewalkerRoutes/', this.loadedFile);
                this.currentIndex = 0;
                this.foundpoint = false;
                RouteState.setRoute(this.route, 'Route Walker');
            },
            'The route the macro will use'
        );

        this.addToggle(
            'Render Points',
            (value) => {
                this.RENDERPOINTS = value;
            },
            'Renders the points of the route'
        );

        this.addToggle(
            'Leftclick',
            (value) => {
                this.LEFTCLICK = value;
            },
            'LeftClick while macro is active'
        );
        this.addSlider(
            'Leftclick Slot',
            1,
            9,
            1,
            (value) => {
                this.LEFTCLICKSLOT = value;
            },
            'Item slot that will be used to leftclick'
        );

        this.addToggle(
            'Sneak',
            (value) => {
                this.SNEAK = value;
            },
            'Sneak while macro is active'
        );

        this.addToggle(
            'Lock Pitch',
            (value) => {
                this.LOCKPITCH = value;
            },
            'Lock Pitch while macro is active'
        );

        this.addSlider(
            'Pitch',
            -90,
            90,
            45,
            (value) => {
                this.PITCH = value;
            },
            'Pitch set to amount'
        );
    }

    checkPoint(point) {
        if (point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') return true;

        return false;
    }

    refreshRoutesToggle() {
        const routes = Router.getFilesinDir('RoutewalkerRoutes').map((name) => String(name));
        if (!this.routesToggle) return;

        const prevState = new Map((this.routesToggle.options || []).map((option) => [option.name, !!option.enabled]));

        this.routesDir = routes;

        this.routesToggle.options = routes.map((routeName) => {
            const enabled = prevState.get(routeName) === true;
            return {
                name: routeName,
                enabled: enabled,
                animationProgress: enabled ? 1 : 0,
                animationStart: 0,
            };
        });
    }

    getClosestPoint() {
        if (!this.route || this.route.length === 0) {
            return null;
        }

        let closestPointData = null;
        let shortestDistance = Infinity;

        for (let i = 0; i < this.route.length; i++) {
            const point = this.route[i];

            if (point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') {
                let distData = MathUtils.getDistanceToPlayer(point.x, point.y, point.z);
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

    onEnable() {
        this.message('&aEnabled');
        Mouse.ungrab();
    }

    onDisable() {
        this.message('&cDisabled');
        Keybind.unpressKeys();
        Keybind.setKey('leftclick', false);
        Rotations.stopRotation();
        Mouse.regrab();
        this.foundpoint = false;
        this.currentIndex = 0;
        this.etherwarpReady = false;
    }
}

export const RouteWalker = new RouteWalkerer();
