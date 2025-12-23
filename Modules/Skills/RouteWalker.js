import RenderUtils from '../../utils/render/RendererUtils';
import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { Keybind } from '../../utils/player/Keybinding';
import { MathUtils } from '../../utils/Math';
import { RayTrace } from '../../utils/Raytrace';
import { Rotations } from '../../utils/player/Rotations';
import { Router } from '../../utils/Router';
import { ModuleBase } from '../../utils/ModuleBase';
import RouteState from '../../utils/RouteState';
import { Guis } from '../../utils/player/Inventory';
import { MiningUtils } from '../../utils/MiningUtils';

class RouteWalkerer extends ModuleBase {
    constructor() {
        super({
            name: 'Route Walker',
            subcategory: 'Skills',
            description: 'Follows multiple points in a route',
            tooltip: 'Etherwarps and walks to multiple points in a route',
            showEnabledToggle: false,
        });

        this.bindToggleKey();

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

        register('command', (action, arg1, indexArg) => {
            let indexNum = undefined;

            if (!action) return this.message('action required! e.g /rw ADD/REMOVE/CLEAR');
            if (!arg1) return this.message('movement type required! e.g /rw add WALK/ETHERWARP');

            if (indexArg !== undefined) {
                let parsedNum = parseInt(indexArg);

                if (!isNaN(parsedNum) && parsedNum >= 1) indexNum = parsedNum;
            }

            this.route = Router.Edit(
                action.toUpperCase(),
                this.route,
                'RoutewalkerRoutes/' + this.loadedFile,
                indexNum,
                true,
                ['WALK', 'ETHERWARP'],
                [arg1.toUpperCase()]
            );
        })
            .setName('routewalker')
            .setAliases('rw');

        this.when(
            () => this.RENDERPOINTS,
            'postRenderWorld',
            () => {
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
                    if (!this.CheckPoint(point)) continue;

                    // todo : add drawString method to V5Mod
                    RenderUtils.drawStyledBox(new Vec3d(point.x, point.y, point.z), getColor(point.movements), getColor(point.movements), 5, false);

                    if (i < route.length - 1) {
                        const nextPoint = route[i + 1];
                        if (this.CheckPoint(nextPoint)) {
                            RenderUtils.drawLine(
                                new Vec3d(point.x + 0.5, point.y + 1, point.z + 0.5),
                                new Vec3d(nextPoint.x + 0.5, nextPoint.y + 1, nextPoint.z + 0.5),
                                getColor(nextPoint.movements),
                                3,
                                false
                            );
                        }
                    }
                }

                if (route.length > 1) {
                    const firstPoint = route[0];
                    const lastPoint = route[route.length - 1];

                    if (this.CheckPoint(firstPoint) && this.CheckPoint(lastPoint)) {
                        RenderUtils.drawLine(
                            new Vec3d(lastPoint.x + 0.5, lastPoint.y + 1, lastPoint.z + 0.5),
                            new Vec3d(firstPoint.x + 0.5, firstPoint.y + 1, firstPoint.z + 0.5),
                            getColor(firstPoint.movements),
                            3,
                            false
                        );
                    }
                }
            }
        );

        this.on('tick', () => {
            if (!this.route || this.route.length === 0) return;

            if (!this.foundpoint) {
                this.data = this.getClosestPoint();
                this.foundpoint = true;
            }

            this.point = this.route[this.currentIndex];
            this.action = this.ACTIONS[this.point.movements];

            let distData = MathUtils.getDistanceToPlayer(this.point.x, this.point.y, this.point.z);
            let currentDistance = distData.distance;

            switch (this.action) {
                case this.ACTIONS.WALK:
                    Keybind.setKeysForStraightLineCoords(this.point.x, this.point.y, this.point.z);

                    Keybind.setKey('shift', this.SNEAK);
                    Keybind.setKey('leftclick', this.LEFTCLICK);
                    Keybind.setKey('sprint', true);

                    if (this.LEFTCLICK) Player.setHeldItemIndex(this.LEFTCLICKSLOT - 1);

                    let angle = MathUtils.calculateAbsoluteAngles(new Vec3d(this.point.x + 0.5, this.point.y + 2, this.point.z + 0.5));

                    Rotations.rotateToAngles(angle.yaw, this.LOCKPITCH ? this.PITCH : Player.getPitch(), 1.0, false);

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

                    let aotv = Guis.findItemInHotbar('Aspect of the Void') || Guis.findItemInHotbar('Aspect of the End'); // can aote etherwarp?

                    if (aotv === -1) {
                        this.toggle(false);
                        this.message('&cYou dont have an Etherwarping item!');
                        return;
                    }

                    Player.setHeldItemIndex(aotv);

                    const targetBlockPos = new BlockPos(this.point.x, this.point.y, this.point.z);

                    if (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) > 0.1) return;

                    let point = RayTrace.getPointOnBlock(targetBlockPos, undefined, false);

                    if (!this.etherwarpReady) {
                        if (point) {
                            Rotations.rotateToVector([point[0], point[1], point[2]], 0.5, false);

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
        });

        this.addMultiToggle(
            'Routes',
            this.routesDir,
            true,
            (selected) => {
                this.loadedFile = Router.getFilefromCallback(selected);
                this.route = Router.loadRouteFromFile('RoutewalkerRoutes/', this.loadedFile);
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

    message(msg) {
        Chat.message('&#7f75e6Route Walker: &f' + msg);
    }

    CheckPoint(point) {
        if (point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') return true;

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
        this.message('&aEnabled!');
    }

    onDisable() {
        this.message('&cDisabled!');
        Keybind.stopMovement();
        Rotations.stopRotation();
        this.foundpoint = false;
        this.currentIndex = 0;
        this.etherwarpReady = false;
    }
}

new RouteWalkerer();
