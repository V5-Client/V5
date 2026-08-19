import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { calculateAbsoluteAngles, getDistanceToPlayer } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { findItemInHotbar, setItemSlot } from '../../utils/player/Inventory';
import { setKeysForStraightLineCoords } from '../../utils/player/Movement';
import { Rotations } from '../../utils/player/Rotations';
import { getVisiblePoint } from '../../utils/Raytrace';
import { editRoute, getFileFromCallback, getFilesInDir, loadRouteFromFile, saveRouteToFile } from '../../utils/Router';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { regrab, ungrab } from '../../utils/Ungrab';
import { v5Command } from '../../utils/V5Commands';

class RouteWalkerer extends ModuleBase {
    constructor() {
        super({
            name: 'Route Walker',
            subcategory: 'Skills',
            developerMode: true,
            description: 'Follows multiple points in a route',
            tooltip: 'Etherwarps and walks to multiple points in a route',
            theme: '#65a6f0',
            isMacro: true,
        });

        this.bindToggleKey();

        this.routesDir = getFilesInDir('RoutewalkerRoutes');

        this.LEFTCLICK = false;
        this.SNEAK = false;
        this.LOCKPITCH = false;
        this.PITCH = 0;
        this.RENDERPOINTS = false;
        this.LEFTCLICKSLOT = 0;

        this.foundpoint = false;
        this.currentIndex = 0;
        this.etherwarpReady = false;
        this.etherwarpClickToken = 0;

        this.ACTIONS = {
            WALK: 1,
            ETHERWARP: 2,
        };

        this.action = this.ACTIONS.WALK;
        this.renderRoute = [];
        this.renderLinePoints = [];
        this.renderLineColors = [];

        this.updateRenderRoute = () => {
            const route = this.route || [];
            const getColor = (movement) => {
                switch (movement?.toUpperCase()) {
                    case 'WALK':
                        return new RenderColor(0, 128, 255, 80);
                    case 'ETHERWARP':
                        return new RenderColor(170, 0, 255, 80);
                    default:
                        return new RenderColor(255, 255, 255, movement ? 80 : 255);
                }
            };
            this.renderRoute = route.map((point) => {
                const valid = this.checkPoint(point);
                return {
                    point,
                    position: valid ? new Vec3d(point.x, point.y, point.z) : null,
                    endpoint: valid ? new Vec3d(point.x + 0.5, point.y + 1, point.z + 0.5) : null,
                    color: getColor(point.movements),
                };
            });
            const validEntries = this.renderRoute.filter((entry) => entry.endpoint);
            if (validEntries.length === this.renderRoute.length && validEntries.length > 1) {
                this.renderLinePoints = validEntries.map((entry) => entry.endpoint);
                this.renderLinePoints.push(validEntries[0].endpoint);
                this.renderLineColors = validEntries.slice(1).map((entry) => entry.color);
                this.renderLineColors.push(validEntries[0].color);
            } else {
                this.renderLinePoints = [];
                this.renderLineColors = [];
            }
        };

        v5Command(
            'routes',
            (action, arg1, indexArg) => {
                let indexNum = undefined;

                const actionUpper = action?.toUpperCase();
                if (actionUpper === 'ADD' && !arg1) return this.message('Movement type required! e.g /v5 routes add WALK/ETHERWARP');
                if (actionUpper === 'CREATE') {
                    const createdRouteId = `${Date.now()}`;
                    const createdRouteName = `${createdRouteId}.json`;
                    const createdRoutePath = `RoutewalkerRoutes/${createdRouteName}`;

                    if (!saveRouteToFile(createdRoutePath, [])) return;

                    this.loadedFile = createdRouteName;
                    this.route = [];
                    this.updateRenderRoute();
                    this.invalidateEtherwarpClick();
                    this.refreshRoutesToggle();
                    this.message(`&aCreated route: &f${createdRouteName}`);
                    return;
                }

                if (indexArg !== undefined) {
                    let parsedNum = Number.parseInt(indexArg);

                    if (!Number.isNaN(parsedNum) && parsedNum >= 1) indexNum = parsedNum;
                }

                this.route = editRoute(
                    actionUpper,
                    this.route,
                    'RoutewalkerRoutes/' + this.loadedFile,
                    indexNum,
                    true,
                    ['WALK', 'ETHERWARP'],
                    [arg1?.toUpperCase()]
                );
                this.invalidateEtherwarpClick();
                this.updateRenderRoute();
            },
            ['greedyString']
        );

        this.when(
            () => this.RENDERPOINTS,
            'postRenderWorld',
            () => {
                const route = this.renderRoute;
                if (!route.length) return;

                route.forEach((entry, i) => {
                    if (!entry.position || !entry.endpoint) return;
                    Render3D.drawStyledBox(entry.position, entry.color, entry.color, 4, false);

                    if (!this.renderLinePoints.length && i < route.length - 1) {
                        const next = route[i + 1];
                        if (!next.endpoint) return;
                        Render3D.drawLine(entry.endpoint, next.endpoint, next.color, 3, false);
                    }
                });

                if (this.renderLinePoints.length) {
                    Render3D.drawLines(this.renderLinePoints, this.renderLineColors, 3, false);
                    return;
                }

                const firstPoint = route[0];
                const lastPoint = route[route.length - 1];

                if (!firstPoint.endpoint || !lastPoint.endpoint) return;

                Render3D.drawLine(lastPoint.endpoint, firstPoint.endpoint, firstPoint.color, 3, false);
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

            let distData = getDistanceToPlayer(this.point.x, this.point.y, this.point.z);
            let currentDistance = distData.distance;

            switch (this.action) {
                case this.ACTIONS.WALK:
                    setKeysForStraightLineCoords(this.point.x, this.point.y, this.point.z, true, true);

                    Client.setKey('shift', this.SNEAK);
                    Client.setKey('leftclick', this.LEFTCLICK);
                    Client.setKey('sprint', true);

                    if (this.LEFTCLICK) setItemSlot(this.LEFTCLICKSLOT - 1);

                    let angle = calculateAbsoluteAngles(new Vec3d(this.point.x + 0.5, this.point.y + 2, this.point.z + 0.5));

                    Rotations.lookAtAngles(angle.yaw, this.LOCKPITCH ? this.PITCH : player.getXRot(), { speedMultiplier: 1.0 });

                    if (currentDistance < 3) {
                        this.etherwarpReady = false;

                        this.currentIndex++;
                        if (this.currentIndex >= this.route.length) {
                            this.currentIndex = 0;
                        }
                    }
                    break;

                case this.ACTIONS.ETHERWARP:
                    Client.stopMovement();
                    Client.setKey('shift', true);

                    let aotv = findItemInHotbar('Aspect of the Void');
                    if (aotv === -1) aotv = findItemInHotbar('Aspect of the End'); // can aote etherwarp?

                    if (aotv === -1) {
                        this.toggle(false);
                        this.message('&cYou dont have an etherwarping item!');
                        return;
                    }

                    setItemSlot(aotv);

                    const targetBlockPos = new BlockPos(this.point.x, this.point.y, this.point.z);

                    if (Math.abs(player.getMotionX()) + Math.abs(player.getMotionZ()) > 0.1) return;

                    const point = getVisiblePoint(targetBlockPos.getX(), targetBlockPos.getY(), targetBlockPos.getZ(), false);

                    if (!this.etherwarpReady) {
                        if (point) {
                            const expectedIndex = this.currentIndex;
                            const clickToken = ++this.etherwarpClickToken;
                            Rotations.lookAtVector([point[0], point[1], point[2]], { speedMultiplier: 0.5 });

                            Rotations.onComplete(() => {
                                ScheduleTask(7, () => {
                                    if (this.enabled && clickToken === this.etherwarpClickToken && this.etherwarpReady && this.currentIndex === expectedIndex)
                                        Client.rightClick();
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
                this.loadedFile = getFileFromCallback(selected);
                this.route = loadRouteFromFile('RoutewalkerRoutes/', this.loadedFile);
                this.updateRenderRoute();
                this.invalidateEtherwarpClick();
                this.currentIndex = 0;
                this.foundpoint = false;
            },
            'The route the macro will use'
        );

        this.on('worldUnload', () => this.invalidateEtherwarpClick());

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
        return !!(point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number');
    }

    invalidateEtherwarpClick() {
        this.etherwarpClickToken++;
        this.etherwarpReady = false;
    }

    refreshRoutesToggle() {
        const routes = getFilesInDir('RoutewalkerRoutes').map((name) => String(name));
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
                let distData = getDistanceToPlayer(point.x, point.y, point.z);
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
        ungrab();
    }

    onDisable() {
        this.invalidateEtherwarpClick();
        this.message('&cDisabled');
        Client.unpressKeys();
        Client.setKey('leftclick', false);
        Rotations.stop();
        regrab();
        this.foundpoint = false;
        this.currentIndex = 0;
    }
}

if (isDeveloperModeEnabled()) new RouteWalkerer();
