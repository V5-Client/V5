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
import { PlayerInteractBlockC2S } from '../../utils/Packets';
import { MiningUtils } from '../../utils/MiningUtils';

// todo make walk points work
// rework the command when icba to fix it
// seperate core logic into a new state rather than etherwarp

class OreMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Ore Macro',
            subcategory: 'Mining',
            description: 'Walks and Etherwarps to set mine points or uses MiningBot',
            tooltip: 'Universal pure Ore Miner',
            showEnabledToggle: false,
        });

        this.bindToggleKey();

        this.FASTAOTV = false;

        this.COAL = false;
        this.QUARTZ = false;
        this.IRON = false;
        this.REDSTONE = false;
        this.GOLD = false;
        this.DIAMOND = false;
        this.EMERALD = false;

        this.STATES = {
            WAITING: 0,
            ETHERWARPING: 1,
            MINING: 2,
        };

        this.state = this.STATES.WAITING;

        this.routesDir = Router.getFilesinDir('OreRoutes');
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
        this.miningTargetVec = null;

        register('command', (action, arg1, indexArg) => {
            if (!action) return Chat.message('§cAction required: "add", "remove", "clear"');

            if (arg1 !== undefined && !isNaN(arg1) && indexArg === undefined) {
                [indexArg, arg1] = [arg1, undefined];
            }

            const actionUpper = action.toUpperCase();
            const movementType = arg1 ? arg1.toUpperCase() : undefined;

            const isMineable = movementType === 'MINEABLE';
            const indexNum = indexArg && !isNaN(indexArg) ? parseInt(indexArg) : undefined;

            this.route = Router.Edit(actionUpper, this.route, `OreRoutes/${this.loadedFile}`, indexNum, !!arg1, ['WALK', 'MINEABLE'], arg1, isMineable);
        }).setName('ore');

        this.when(
            () => {
                return true; // Utils.area() === 'Crystal Hollows';
            },
            'postRenderWorld',
            () => {
                if (!this.route || this.route.length < 1) return;

                let pathCounter = 1;
                let mineCounter = 1;

                for (let i = 0; i < this.route.length; i++) {
                    const current = this.route[i];
                    if (!current || typeof current.x !== 'number') continue;

                    let boxColor, edgeColor, label;
                    const pos = new Vec3d(current.x, current.y, current.z);

                    if (current.movements === 'MINEABLE') {
                        boxColor = [0, 255, 0, 80]; // Green
                        edgeColor = [0, 255, 0, 255];
                        label = `Mineable #${mineCounter++}`;
                    } else {
                        boxColor = current.movements === 'WALK' ? [255, 50, 50, 80] : [145, 70, 255, 80];
                        edgeColor = current.movements === 'WALK' ? [255, 50, 50, 255] : [145, 70, 255, 255];
                        label = `#${pathCounter++}`;
                    }

                    if (label) {
                        RenderUtils.drawText(label, pos.add(0.5, 1.3, 0.5), 1.2, true, false, true);
                    }

                    RenderUtils.drawStyledBox(pos, boxColor, edgeColor, 4, false);
                }
            }
        );

        this.on('tick', () => {
            MiningBot.setCost(this.getOreCosts());

            switch (this.state) {
                case this.STATES.ETHERWARPING:
                    if (this.route?.length <= 1) {
                        this.toggle(false);
                        this.message('&cRoute needs at least 2 points!');
                        return;
                    }

                    MiningBot.toggle(false);
                    Keybind.setKey('leftclick', false);

                    let aotv = Guis.findItemInHotbar('Aspect of the Void');

                    if (aotv === -1) {
                        this.toggle(false);
                        this.message('&cYou dont have an Etherwarping item!');
                        return;
                    }

                    Player.setHeldItemIndex(aotv);

                    if (!this.closestPoint) {
                        this.closestPoint = this.getClosestPoint();
                        if (!this.closestPoint?.point) return;

                        this.rawPoint = this.closestPoint.point;
                        this.closestPointIndex = this.closestPoint.index;

                        let target = this.getPointOnBlock(this.closestPoint.point);
                        if (!target) {
                            Chat.message('&cNext point has been destroyed!');
                            this.toggle(false);
                            return;
                        }

                        this.closestPoint = target;
                    }

                    let pointBlock = World.getBlockAt(this.rawPoint.x, this.rawPoint.y, this.rawPoint.z);
                    if (pointBlock?.type?.getID() === 0 || pointBlock?.type?.getID() === 188) {
                        this.message('&cpoint is air or a chest?');
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
                        this.rotatedToPoint = false;

                        let searchIndex = this.closestPointIndex;
                        let foundNext = false;

                        for (let i = 0; i < this.route.length; i++) {
                            searchIndex = (searchIndex + 1) % this.route.length;
                            if (this.route[searchIndex].movements !== 'MINEABLE') {
                                this.closestPointIndex = searchIndex;
                                foundNext = true;
                                break;
                            }
                        }

                        if (!foundNext) {
                            this.message('No more points found!');
                            this.toggle(false);
                            return;
                        }

                        let nextPoint = this.getPointOnBlock(this.route[this.closestPointIndex]);
                        if (!nextPoint) {
                            this.message('&cNext point isnt visible!');
                            this.toggle(false);
                            return;
                        }

                        this.closestPoint = nextPoint;
                        this.rawPoint = this.route[this.closestPointIndex];
                        return;
                    }

                    if (!this.rotatedToPoint) {
                        Keybind.setKey('shift', true);
                        if (!Player.getPlayer().isSneaking()) return;

                        Rotations.rotateToVector(this.closestPoint, 1);
                        Rotations.onEndRotation(() => {
                            Client.scheduleTask(this.FASTAOTV ? 4 : 7, () => {
                                if (!this.enabled) return;
                                Keybind.rightClick();
                                this.attemptedEtherwarp = true;
                                this.etherwarpAttempts++;

                                this.lastX = Player.getX();
                                this.lastY = Player.getY();
                                this.lastZ = Player.getZ();

                                // it works cus miningbot ignores the blocks behind it
                                // this can and should be better
                                this.prepartionTicks = 0;
                                this.state = this.STATES.MINING;
                            });
                        });
                        this.rotatedToPoint = true;
                    }

                    if (this.attemptedEtherwarp) {
                        let hasMoved =
                            Math.abs(Player.getX() - this.lastX) > 0.5 ||
                            Math.abs(Player.getY() - this.lastY) > 0.5 ||
                            Math.abs(Player.getZ() - this.lastZ) > 0.5;

                        if (hasMoved) {
                            this.rotatedToPoint = false;
                            this.attemptedEtherwarp = false;
                            this.etherwarpAttempts = 0;
                            this.etherwarpTicks = 0;
                            return;
                        }

                        this.etherwarpTicks++;
                        if (this.etherwarpTicks === 20) this.recalculateEtherWarp(1);
                        if (this.etherwarpTicks === 40) this.recalculateEtherWarp(2);
                        if (this.etherwarpTicks === 60) this.recalculateEtherWarp(3);
                    }

                    if (this.rotatedToPoint) {
                        if (this.distance < 2) {
                            this.rotatedToPoint = false;
                            this.closestPointIndex++;
                            RouteState.setCurrentIndex(this.closestPointIndex);

                            let target = this.getPointOnBlock(this.route[this.closestPointIndex]);
                            if (!target) {
                                this.message('Next point face is not visible!');
                                this.toggle(false);
                                return;
                            }

                            this.closestPoint = target;
                            this.rawPoint = this.route[this.closestPointIndex];
                        }
                    }
                    break;
                case this.STATES.MINING:
                    const { drill } = MiningUtils.getDrills();
                    if (!drill) {
                        Chat.message('&cNo drill found in ABILITY state!');
                        this.toggle(false);
                        return;
                    }

                    if (Player.getHeldItemIndex() !== drill.slot) {
                        Guis.setItemSlot(drill.slot);
                        return;
                    }

                    this.prepartionTicks++;

                    let focusedMineables = [];
                    let ignoredMineables = [];

                    for (let i = 0; i < this.route.length; i++) {
                        let checkIndex = (this.closestPointIndex + i) % this.route.length;
                        let point = this.route[checkIndex];
                        if (point.movements !== 'MINEABLE') continue;

                        let block = World.getBlockAt(point.x, point.y, point.z);
                        let reg = block?.type?.getRegistryName();

                        let dist = MathUtils.getDistanceToPlayer(point.x, point.y, point.z).distance;

                        if (dist >= 4.5) continue;

                        const hit = this.raytraceBlockFaces(point);

                        if (hit) {
                            point.tempHit = hit;
                            if (!reg.includes('air') && !reg.includes('bedrock')) focusedMineables.push(point);
                            else ignoredMineables.push(point);
                        }
                    }

                    if (focusedMineables.length > 0) {
                        MiningBot.populateLocations(focusedMineables);

                        if (!this.miningTargetVec) {
                            let p = focusedMineables[0];

                            this.miningTargetVec = {
                                vec: {
                                    x: p.tempHit.hitPos.x,
                                    y: p.tempHit.hitPos.y,
                                    z: p.tempHit.hitPos.z,
                                },
                                rawX: p.x,
                                rawY: p.y,
                                rawZ: p.z,
                            };
                        }

                        return;
                    } else if (ignoredMineables.length > 0) {
                        if (this.prepartionTicks < 20) return;

                        ChatLib.chat('Theres mineables but they are broken');

                        this.state = this.STATES.ETHERWARPING;
                        return;
                    } else {
                        if (!this.scanned) {
                            this.scanned = true;
                            MiningBot.scanForBlock(this.getOreCosts());
                        }

                        if (MiningBot.foundLocations.length > 0) {
                            ChatLib.chat('Found ' + MiningBot.foundLocations.length + ' ores');
                            MiningBot.toggle(true);
                            return;
                        }

                        if (MiningBot.foundLocations.length === 0) {
                            if (this.prepartionTicks < 20) return;

                            MiningBot.toggle(false);
                            MiningBot.foundLocations = [];

                            this.state = this.STATES.ETHERWARPING;
                            this.scanned = false;
                            return;
                        }
                    }
            }
        });

        this.addMultiToggle(
            'Routes',
            this.routesDir,
            true,
            (selected) => {
                this.loadedFile = Router.getFilefromCallback(selected);
                this.route = Router.loadRouteFromFile('OreRoutes/', this.loadedFile);
                RouteState.setRoute(this.route, 'Ore Macro');
            },
            'The route the macro will use'
        );
        this.addMultiToggle(
            'Ore Types',
            ['Coal', 'Quartz', 'Iron', 'Gold', 'Diamond', 'Redstone', 'Lapis', 'Emerald'],
            false,
            (selected) => {
                const setHas = (name) => selected.some((item) => item.name === name && item.enabled === true);
                this.COAL = setHas('Coal');
                this.QUARTZ = setHas('Quartz');
                this.IRON = setHas('Iron');
                this.GOLD = setHas('Gold');
                this.DIAMOND = setHas('Diamond');
                this.REDSTONE = setHas('Redstone');
                this.LAPIS = setHas('Lapis');
                this.EMERALD = setHas('Emerald');
            },
            'Type of ores the macro is able to target'
        );
        this.addToggle(
            'Fast AOTV',
            (value) => {
                this.FASTAOTV = value;
            },
            'Decreased amount of ticks before it sends the right click packet'
        );
    }

    recalculateEtherWarp(intensity) {
        // redo this only calculate etherwarp once then do something else
        this.rotatedToPoint = false;
        this.etherwarpAttempts++;

        let newTarget = this.getPointOnBlock(this.rawPoint);
        let multiplier = intensity === 1 ? 0.05 : intensity === 2 ? 0.2 : 0.5;

        if (newTarget) {
            this.closestPoint = {
                x: newTarget.x + (Math.random() - 0.5) * multiplier,
                y: newTarget.y + (Math.random() - 0.5) * multiplier,
                z: newTarget.z + (Math.random() - 0.5) * multiplier,
            };
        }

        if (intensity === 1) {
            this.message('&cEtherwarp failed. Retrying with a tiny vector recalculation.');
        }

        if (intensity === 2) {
            this.message('&cEtherwarp failed. Retrying with a larger vector recalculation.');
        }

        if (intensity === 3) {
            this.toggle(false);
            this.message('&cEtherwarp failed after 3 attempts! Stopped macro.');
            return;
        }
    }

    getOreCosts() {
        return {
            'minecraft:coal_block': this.COAL ? 1 : 0,
            'minecraft:quartz_block': this.QUARTZ ? 1 : 0,
            'minecraft:iron_block': this.IRON ? 1 : 0,
            'minecraft:redstone_block': this.REDSTONE ? 1 : 0,
            'minecraft:gold_block': this.GOLD ? 1 : 0,
            'minecraft:diamond_block': this.DIAMOND ? 1 : 0,
            'minecraft:emerald_block': this.EMERALD ? 1 : 0,
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

            if (point.movements === 'MINEABLE') continue;
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
        Chat.message('&#815bf5Ore Macro: &f' + msg);
    }

    onEnable() {
        MacroState.setMacroRunning(true, 'ORE_MACRO');
        if (this.route) RouteState.setRoute(this.route, 'Ore Macro');
        this.message('&aEnabled');
        this.state = this.STATES.ETHERWARPING;
    }

    onDisable() {
        MacroState.setMacroRunning(false, 'ORE_MACRO');
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

new OreMacro();
