import RenderUtils from '../../utils/render/RendererUtils';
import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { MathUtils } from '../../utils/Math';
import { RayTrace } from '../../utils/Raytrace';
import { Rotations } from '../../utils/player/Rotations';
import { Router } from '../../utils/Router';
import { MiningBot } from './MiningBot';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { MacroState } from '../../utils/MacroState';
import RouteState from '../../utils/RouteState';

class GemstoneMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Gemstone Macro',
            subcategory: 'Mining',
            description: 'Gemstone Miner for the Crystal Hollows',
            tooltip: 'Gemstone Miner for the Crystal Hollows',
            showEnabledToggle: false,
        });
        this.bindToggleKey();
        this.FASTAOTV = false;
        this.MOBKILLER = false;
        this.WEAPONSLOT = 0;
        this.TYPES = null;
        this.PRESETTICKS = false;
        this.TICKSWITHOUTMSB = 0;
        this.TICKSWITHMSB = 0;

        this.AMBER = false;
        this.AMETHYST = false;
        this.JADE = false;
        this.JASPER = false;
        this.RUBY = false;
        this.SAPPHIRE = false;
        this.TOPAZ = false;

        this.STATES = {
            WAITING: 0,
            ETHERWARPING: 1,
            MINING: 2,
        };

        this.state = this.STATES.WAITING;

        this.routesDir = Router.getFilesinDir('GemstoneRoutes');
        this.route = null;
        this.loadedFile = null;
        this.closestPoint = null;
        this.rawPoint = null;
        this.closestPointIndex = null;
        this.rotatedToPoint = false;
        this.attemptedEtherwarp = false;
        this.etherwarpAttempts = 0;
        this.etherwarpTicks = 0;
        this.playerPos = null;
        this.scanned = false;

        register('postRenderWorld', () => {
            if (!this.rawPoint) return;

            this.raytraceBlockFaces(this.rawPoint);
        });

        register('command', (action, indexArg) => {
            this.routesDir = Router.getFilesinDir('GemstoneRoutes');
            let indexNum = undefined;

            if (!action) {
                this.message('action required: "add", "remove", "clear"');
                return;
            }

            if (indexArg !== undefined) {
                let parsedNum = parseInt(indexArg);

                if (!isNaN(parsedNum) && parsedNum >= 1) {
                    indexNum = parsedNum;
                }
            }

            this.route = Router.Edit(action.toUpperCase(), this.route, 'GemstoneRoutes/' + this.loadedFile, indexNum);
        }).setName('gemstone');

        this.when(
            () => {
                return Utils.area() === 'Crystal Hollows';
            },
            'postRenderWorld',
            () => {
                if (!this.route || this.route.length < 1) return;

                for (let i = 0; i < this.route.length; i++) {
                    const current = this.route[i];

                    if (current && typeof current.x === 'number' && typeof current.y === 'number' && typeof current.z === 'number') {
                        RenderUtils.drawStyledBox(new Vec3d(current.x, current.y, current.z), [0, 100, 200, 100], [0, 100, 200, 255], 3, false);
                    }
                }

                for (let i = 0; i < this.route.length - 1; i++) {
                    const current = this.route[i];
                    const next = this.route[i + 1];

                    RenderUtils.drawLine(
                        new Vec3d(current.x + 0.5, current.y + 0.5, current.z + 0.5),
                        new Vec3d(next.x + 0.5, next.y + 0.5, next.z + 0.5),
                        [0, 100, 200, 255],
                        3,
                        false
                    );
                }

                if (this.route.length > 1) {
                    const last = this.route[this.route.length - 1];
                    const first = this.route[0];
                    RenderUtils.drawLine(
                        new Vec3d(last.x + 0.5, last.y + 0.5, last.z + 0.5),
                        new Vec3d(first.x + 0.5, first.y + 0.5, first.z + 0.5),
                        [0, 100, 200, 255],
                        3,
                        false
                    );
                }
            }
        );

        this.on('tick', () => {
            MiningBot.setCost(this.getGemstoneCosts());

            switch (this.state) {
                case this.STATES.ETHERWARPING:
                    if (Utils.area() !== 'Crystal Hollows') {
                        this.toggle(false);
                        this.message('&cYou are not in Crystal Hollows!');
                        return;
                    }

                    if (this.route?.length <= 1) {
                        this.toggle(false);
                        this.message('&cRoute needs at least 2 points!');
                        return;
                    }

                    MiningBot.toggle(false);

                    Keybind.setKey('leftclick', false);

                    let aotv = Guis.findItemInHotbar('Aspect of the Void') || Guis.findItemInHotbar('Aspect of the End'); // can aote etherwarp?

                    if (aotv === -1) {
                        this.toggle(false);
                        this.message('&cYou dont have an Etherwarping item!');
                        return;
                    }

                    Player.setHeldItemIndex(aotv);

                    if (!this.closestPoint) {
                        this.closestPoint = this.getClosestPoint();
                        this.rawPoint = this.closestPoint.point;
                        this.closestPointIndex = this.closestPoint.index;

                        let target = this.getPointOnBlock(this.closestPoint.point);
                        if (!target) {
                            this.message('Could not find a valid face on the block!');
                            this.toggle(false);
                            return;
                        }

                        this.closestPoint = target;
                    }
                    let point = World.getBlockAt(this.rawPoint.x, this.rawPoint.y, this.rawPoint.z);

                    // air or chest
                    if (point?.type?.getID() === 0 || point?.type?.getID() === 188) {
                        this.message('Next point has been destroyed!');
                        this.toggle(false);
                        return;
                    }

                    this.dist = MathUtils.distanceToPlayerFeet([this.closestPoint.x + 0.5, this.closestPoint.y + 0.5, this.closestPoint.z + 0.5]);
                    this.distance = this.dist.distance;

                    if (this.distance > 60) {
                        this.message('Point is too far to etherwarp to!');
                        this.toggle(false);
                        return;
                    }

                    if (this.distance < 2 && !this.rotatedToPoint) {
                        this.message('Arrived at point ' + this.closestPointIndex);
                        this.rotatedToPoint = false;
                        this.closestPointIndex++;

                        if (this.closestPointIndex >= this.route.length) {
                            this.closestPointIndex = 0;
                        }

                        let nextPoint = this.getPointOnBlock(this.route[this.closestPointIndex]);
                        if (!nextPoint) {
                            this.message('Next point face is not visible!');
                            this.toggle(false);
                            return;
                        }

                        this.closestPoint = nextPoint;
                        this.rawPoint = this.route[this.closestPointIndex];
                        this.state = this.STATES.MINING;
                        return;
                    }

                    if (!this.rotatedToPoint) {
                        Keybind.setKey('shift', true);

                        if (!Player.getPlayer().isSneaking()) return;

                        Rotations.rotateToVector(this.closestPoint, 1);
                        Rotations.onEndRotation(() => {
                            Client.scheduleTask(this.FASTAOTV ? 4 : 7, () => {
                                Keybind.rightClick();
                            });

                            this.attemptedEtherwarp = true;
                            this.etherwarpAttempts++;

                            this.lastX = Player.getX();
                            this.lastY = Player.getY();
                            this.lastZ = Player.getZ();

                            this.etherwarpTicks = 0;
                        });

                        this.message('Rotating to point ' + this.closestPointIndex);
                        this.rotatedToPoint = true;
                    }

                    // needs refining
                    if (this.attemptedEtherwarp) {
                        this.etherwarpTicks++;

                        if (this.etherwarpTicks > 20) {
                            let currentPos = Player.getPlayer().getPos();

                            let hasMoved =
                                Math.abs(currentPos.getX() - this.lastX) > 0.1 ||
                                Math.abs(currentPos.getY() - this.lastY) > 0.1 ||
                                Math.abs(currentPos.getZ() - this.lastZ) > 0.1;

                            if (!hasMoved) {
                                this.message('Etherwarp failed (Attempts: ' + this.etherwarpAttempts + '), trying again.');
                                this.etherwarpTicks = 0;
                            } else {
                                this.attemptedEtherwarp = false;
                                this.etherwarpAttempts = 0;
                            }

                            this.rotatedToPoint = false;
                        }
                    }

                    if (this.rotatedToPoint) {
                        Chat.message('Distance to point ' + this.closestPointIndex + ': ' + this.distance);

                        if (this.distance < 2) {
                            this.message('Arrived at point ' + this.closestPointIndex);
                            this.rotatedToPoint = false;
                            this.closestPointIndex++;
                            RouteState.setCurrentIndex(this.closestPointIndex);

                            if (this.closestPointIndex >= this.route.length) {
                                Chat.message('Route finished! Resetting to start.');
                                this.closestPointIndex = 0;
                            }

                            let target = this.getPointOnBlock(this.route[this.closestPointIndex]);
                            if (!target) {
                                this.message('Next point face is not visible!');
                                this.toggle(false);
                                return;
                            }

                            this.closestPoint = target;
                            this.rawPoint = this.route[this.closestPointIndex];
                            this.state = this.STATES.MINING;

                            return;
                        }
                    }
                    break;
                case this.STATES.MINING:
                    if (!this.scanned) {
                        this.scanned = true;
                        MiningBot.scanForBlock(this.getGemstoneCosts());
                    }

                    if (MiningBot.foundLocations.length > 0) {
                        ChatLib.chat('Found ' + MiningBot.foundLocations.length + ' gemstones');
                        MiningBot.toggle(true);
                        return;
                    }

                    if (MiningBot.foundLocations.length === 0) {
                        MiningBot.toggle(false);
                        MiningBot.foundLocations = [];

                        ChatLib.chat('No more gemstones found');
                        this.state = this.STATES.ETHERWARPING;
                        this.scanned = false;
                        return;
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
                this.route = Router.loadRouteFromFile('GemstoneRoutes/', this.loadedFile);
                RouteState.setRoute(this.route, 'Gemstone Macro');
            },
            'The route the macro will use'
        );
        this.addMultiToggle(
            'Gemstone Types',
            ['Ruby', 'Amethyst', 'Sapphire', 'Topaz', 'Amber', 'Jade', 'Jasper'],
            false,
            (selected) => {
                const setHas = (name) => selected.some((item) => item.name === name && item.enabled === true);
                this.AMBER = setHas('Amber');
                this.AMETHYST = setHas('Amethyst');
                this.JADE = setHas('Jade');
                this.JASPER = setHas('Jasper');
                this.RUBY = setHas('Ruby');
                this.SAPPHIRE = setHas('Sapphire');
                this.TOPAZ = setHas('Topaz');
            },
            'Type of gemstones the macro is able to target'
        );
        this.addToggle(
            'Fast AOTV',
            (value) => {
                this.FASTAOTV = value;
            },
            'Decreased amount of ticks before it sends the right click packet'
        );
        this.addToggle(
            'Mob Killer',
            (value) => {
                this.MOBKILLER = value;
            },
            'Kills mobs if they are in a certain radius'
        );
        this.addSlider(
            'Weapon Slot',
            1,
            9,
            1,
            (value) => {
                this.WEAPONSLOT = value;
            },
            'Slot of your melee weapon'
        );
    }

    getGemstoneCosts() {
        return {
            'minecraft:orange_stained_glass': this.AMBER ? 1 : null,
            'minecraft:orange_stained_glass_pane': this.AMBER ? 1 : null,
            'minecraft:purple_stained_glass': this.AMETHYST ? 1 : null,
            'minecraft:purple_stained_glass_pane': this.AMETHYST ? 1 : null,
            'minecraft:lime_stained_glass': this.JADE ? 1 : null,
            'minecraft:lime_stained_glass_pane': this.JADE ? 1 : null,
            'minecraft:magenta_stained_glass': this.JASPER ? 1 : null,
            'minecraft:magenta_stained_glass_pane': this.JASPER ? 1 : null,
            'minecraft:red_stained_glass': this.RUBY ? 1 : null,
            'minecraft:red_stained_glass_pane': this.RUBY ? 1 : null,
            'minecraft:light_blue_stained_glass': this.SAPPHIRE ? 1 : null,
            'minecraft:light_blue_stained_glass_pane': this.SAPPHIRE ? 1 : null,
            'minecraft:yellow_stained_glass': this.TOPAZ ? 1 : null,
            'minecraft:yellow_stained_glass_pane': this.TOPAZ ? 1 : null,
        };
    }

    getPointOnBlock(point) {
        const randomOffset = (min, max) => Math.random() * (max - min) + min;

        const closestHit = this.raytraceBlockFaces(point);

        if (!closestHit) return null;

        const faceName = closestHit.face;

        let fixedX, fixedY, fixedZ;
        let randMinX, randMaxX;
        let randMinY, randMaxY;
        let randMinZ, randMaxZ;

        const rangeMin = 0.25;
        const rangeMax = 0.85;

        switch (faceName) {
            case 'EAST': // +X face
                fixedX = point.x + 1.0;
                randMinY = point.y + rangeMin;
                randMaxY = point.y + rangeMax;
                randMinZ = point.z + rangeMin;
                randMaxZ = point.z + rangeMax;
                fixedY = randomOffset(randMinY, randMaxY);
                fixedZ = randomOffset(randMinZ, randMaxZ);
                return new Vec3d(fixedX, fixedY, fixedZ);

            case 'WEST': // -X face
                fixedX = point.x;
                randMinY = point.y + rangeMin;
                randMaxY = point.y + rangeMax;
                randMinZ = point.z + rangeMin;
                randMaxZ = point.z + rangeMax;
                fixedY = randomOffset(randMinY, randMaxY);
                fixedZ = randomOffset(randMinZ, randMaxZ);
                return new Vec3d(fixedX, fixedY, fixedZ);

            case 'UP': // +Y face
                fixedY = point.y + 1.0;
                randMinX = point.x + rangeMin;
                randMaxX = point.x + rangeMax;
                randMinZ = point.z + rangeMin;
                randMaxZ = point.z + rangeMax;
                fixedX = randomOffset(randMinX, randMaxX);
                fixedZ = randomOffset(randMinZ, randMaxZ);
                return new Vec3d(fixedX, fixedY, fixedZ);

            case 'DOWN': // -Y face
                fixedY = point.y;
                randMinX = point.x + rangeMin;
                randMaxX = point.x + rangeMax;
                randMinZ = point.z + rangeMin;
                randMaxZ = point.z + rangeMax;
                fixedX = randomOffset(randMinX, randMaxX);
                fixedZ = randomOffset(randMinZ, randMaxZ);
                return new Vec3d(fixedX, fixedY, fixedZ);

            case 'SOUTH': // +Z face
                fixedZ = point.z + 1.0;
                randMinX = point.x + rangeMin;
                randMaxX = point.x + rangeMax;
                randMinY = point.y + rangeMin;
                randMaxY = point.y + rangeMax;
                fixedX = randomOffset(randMinX, randMaxX);
                fixedY = randomOffset(randMinY, randMaxY);
                return new Vec3d(fixedX, fixedY, fixedZ);

            case 'NORTH': // -Z face
                fixedZ = point.z;
                randMinX = point.x + rangeMin;
                randMaxX = point.x + rangeMax;
                randMinY = point.y + rangeMin;
                randMaxY = point.y + rangeMax;
                fixedX = randomOffset(randMinX, randMaxX);
                fixedY = randomOffset(randMinY, randMaxY);
                return new Vec3d(fixedX, fixedY, fixedZ);

            default:
                return null;
        }
    }

    raytraceBlockFaces(point) {
        const player = Player.getPlayer();
        const startX = player.getEyePos().x;
        const startY = player.getEyePos().y;
        const startZ = player.getEyePos().z;

        const centerX = point.x + 0.5;
        const centerY = point.y + 0.5;
        const centerZ = point.z + 0.5;

        const offset = 0.05;

        const minX = point.x - offset;
        const maxX = point.x + 1.0 + offset;
        const minY = point.y - offset;
        const maxY = point.y + 1.0 + offset;
        const minZ = point.z - offset;
        const maxZ = point.z + 1.0 + offset;

        const faces = [
            { name: 'EAST', target: [maxX, centerY, centerZ] }, // +X
            { name: 'WEST', target: [minX, centerY, centerZ] }, // -X
            { name: 'UP', target: [centerX, maxY, centerZ] }, // +Y
            { name: 'DOWN', target: [centerX, minY, centerZ] }, // -Y
            { name: 'SOUTH', target: [centerX, centerY, maxZ] }, // +Z
            { name: 'NORTH', target: [centerX, centerY, minZ] }, // -Z
        ];

        let closestHit = null;
        let shortestDistance = Infinity;

        for (const face of faces) {
            const [targetX, targetY, targetZ] = face.target;

            const isLineOfSightClear = RayTrace.isLineClear(startX, startY, startZ, targetX, targetY, targetZ);
            const dx = targetX - startX;
            const dy = targetY - startY;
            const dz = targetZ - startZ;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            let lineColor;
            if (isLineOfSightClear) {
                lineColor = [0, 255, 0, 255];
            } else {
                lineColor = [255, 0, 0, 255];
            }

            //  temp
            RenderUtils.drawLine(new Vec3d(startX, startY, startZ), new Vec3d(targetX, targetY, targetZ), lineColor, 3, false);
            if (isLineOfSightClear && distance < shortestDistance) {
                shortestDistance = distance;
                closestHit = {
                    distance: distance,
                    face: face.name,
                    hitPos: { x: targetX, y: targetY, z: targetZ },
                };
            }
        }

        return closestHit;
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

        return closestPointData;
    }

    message(msg) {
        Chat.message('&#f542efGemstone Macro: &f' + msg);
    }

    onEnable() {
        MacroState.setMacroRunning(true, 'GEMSTONE_MACRO');
        if (this.route) RouteState.setRoute(this.route, 'Gemstone Macro');
        this.message('&aEnabled');
        this.state = this.STATES.ETHERWARPING;
    }

    onDisable() {
        MacroState.setMacroRunning(false, 'GEMSTONE_MACRO');
        RouteState.clearRoute();
        this.scanned = false;
        this.closestPointIndex = null;
        this.closestPoint = null;
        this.rotatedToPoint = null;
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        Keybind.unpressKeys();
        MiningBot.toggle(false);
    }
}

new GemstoneMacro();
