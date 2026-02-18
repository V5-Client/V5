import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { PlayerInteractItemC2S } from '../../utils/Packets';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Raytrace } from '../../utils/Raytrace';
import Render from '../../utils/render/Render';
import { Router } from '../../utils/Router';
import RouteState from '../../utils/RouteState';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { MiningBot } from './MiningBot';

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
            isMacro: true,
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
            DECIDING: 1,
            WALKING: 2,
            ETHERWARPING: 3,
            MINING: 4,
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

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => Object.keys(this.STATES).find((key) => this.STATES[key] === this.state) || 'Unknown',
                    'Route Progress': () => (this.route ? `${this.closestPointIndex || 0}/${this.route.length}` : 'No Route'),
                    'Targets Found': () => MiningBot.foundLocations.length,
                },
            },
        ]);

        register('command', (action, arg1, indexArg) => {
            if (!action) return Chat.message('§cAction required: "add", "remove", "clear"');

            const parsedArg1Index = Number.parseInt(arg1, 10);
            if (arg1 !== undefined && !Number.isNaN(parsedArg1Index) && indexArg === undefined) {
                indexArg = parsedArg1Index;
                arg1 = undefined;
            }

            const actionUpper = action.toUpperCase();
            const movementType = arg1 ? arg1.toUpperCase() : undefined;

            const isMineable = movementType === 'MINEABLE';
            const parsedIndex = Number.parseInt(indexArg, 10);
            const indexNum = Number.isNaN(parsedIndex) ? undefined : parsedIndex;

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
                        boxColor = Render.Color(0, 255, 0, 80); // Green
                        edgeColor = Render.Color(0, 255, 0, 255);
                        label = `Mineable #${mineCounter++}`;
                    } else {
                        boxColor = current.movements === 'WALK' ? Render.Color(255, 50, 50, 80) : Render.Color(145, 70, 255, 80);
                        edgeColor = current.movements === 'WALK' ? Render.Color(255, 50, 50, 255) : Render.Color(145, 70, 255, 255);
                        label = `#${pathCounter++}`;
                    }

                    if (label) {
                        Render.drawText(label, pos.add(0.5, 1.3, 0.5), 1.2, true, false, true);
                    }

                    Render.drawStyledBox(pos, boxColor, edgeColor, 4, false);
                }
            }
        );

        this.on('tick', () => {
            MiningBot.setCost(this.getOreCosts());

            switch (this.state) {
                case this.STATES.DECIDING:
                    if (!this.route || this.route.length <= 1) {
                        this.message('&cRoute needs at least 2 points!');
                        this.toggle(false);
                        return;
                    }

                    if (this.closestPointIndex === null) {
                        let found = this.getClosestPoint();
                        if (!found) return;
                        this.closestPointIndex = found.index;
                    }

                    let currentPoint = this.route[this.closestPointIndex];

                    if (currentPoint.movements === 'WALK') {
                        this.state = this.STATES.WALKING;
                        this.message('&6Movement: Walking to point ' + this.closestPointIndex);
                    } else {
                        this.state = this.STATES.ETHERWARPING;
                        this.message('&bMovement: Etherwarping to point ' + this.closestPointIndex);
                    }
                    break;
                case this.STATES.WALKING:
                    let walkPoint = this.route[this.closestPointIndex];
                    let dist = MathUtils.getDistanceToPlayer(walkPoint.x + 0.5, walkPoint.y + 1, walkPoint.z + 0.5);

                    let nextPoint = this.route[this.closestPointIndex + 1];
                    //Rotations.rotateToVector(new Vec3d(nextPoint.x + 0.5, nextPoint.y, nextPoint.z + 0.5));

                    Chat.message('Distance to point: ' + dist.distance);
                    if (dist.distance <= 1.5 && dist.distanceFlat == dist.distanceY) {
                        Keybind.setKey('shift', true);
                    } else {
                        Keybind.setKey('shift', false);
                    }
                    if (dist.distance <= 0.75) {
                        Keybind.unpressKeys();

                        let nextIndex = (this.closestPointIndex + 1) % this.route.length;

                        for (let i = 0; i < this.route.length; i++) {
                            if (this.route[nextIndex].movements !== 'MINEABLE') {
                                break;
                            }
                            nextIndex = (nextIndex + 1) % this.route.length;
                        }

                        this.closestPointIndex = nextIndex;

                        this.state = this.STATES.MINING;
                        Keybind.setKey('shift', false);
                        this.message('&6Arrived at Walk Point. Checking for ores...');
                        return;
                    }

                    Keybind.setKeysForStraightLineCoords(walkPoint.x + 0.5, walkPoint.y + 1, walkPoint.z + 0.5, true, true);
                    break;
                case this.STATES.ETHERWARPING:
                    MiningBot.toggle(false);
                    Keybind.setKey('leftclick', false);

                    let aotv = Guis.findItemInHotbar('Aspect of the Void');
                    if (aotv === -1) {
                        this.message('&cAspect of the Void not found in hotbar!');
                        this.toggle(false);
                        return;
                    }

                    if (!this.closestPoint) {
                        let currentPoint = this.route[this.closestPointIndex];
                        let target = this.getPointOnBlock(currentPoint);

                        if (!target) {
                            this.message('&cPoint ' + this.closestPointIndex + ' face is not visible!');
                            this.toggle(false);
                            return;
                        }

                        this.closestPoint = target;
                        this.rawPoint = currentPoint;
                        this.rotatedToPoint = false;
                        this.attemptedEtherwarp = false;
                    }

                    this.dist = MathUtils.distanceToPlayerFeet([this.closestPoint.x, this.closestPoint.y, this.closestPoint.z]);
                    this.distance = this.dist.distance;

                    if (this.distance < 2) {
                        this.message('&aArrived at point ' + this.closestPointIndex);

                        this.closestPoint = null;
                        this.rotatedToPoint = false;
                        this.attemptedEtherwarp = false;
                        this.etherwarpTicks = 0;

                        let nextIndex = (this.closestPointIndex + 1) % this.route.length;

                        for (let i = 0; i < this.route.length; i++) {
                            if (this.route[nextIndex].movements !== 'MINEABLE') {
                                break;
                            }
                            nextIndex = (nextIndex + 1) % this.route.length;
                        }

                        this.closestPointIndex = nextIndex;

                        let nextPoint = this.route[this.closestPointIndex + 1];
                        if (nextPoint) {
                            let nextPointVec = new Vec3d(nextPoint?.x + 0.5, nextPoint?.y, nextPoint?.z + 0.5);
                            if (nextPointVec) Rotations.rotateToVector(nextPointVec);
                        }
                        this.state = this.STATES.MINING;
                        return;
                    }

                    if (this.distance > 60) {
                        this.message('&cPoint is too far (60+ blocks)!');
                        this.toggle(false);
                        return;
                    }

                    if (!this.rotatedToPoint) {
                        Guis.setItemSlot(aotv);
                        Keybind.setKey('shift', true);

                        if (!Player.getPlayer().isSneaking()) return;

                        Rotations.rotateToVector(this.closestPoint, 1);
                        Rotations.onEndRotation(() => {
                            if (!this.enabled) return;
                            ScheduleTask(this.FASTAOTV ? 2 : 5, () => {
                                try {
                                    // yes this is retarded ik
                                    this.rightClickEtherWarp(this.closestPoint);

                                    this.attemptedEtherwarp = true;
                                    this.lastX = Player.getX();
                                    this.lastY = Player.getY();
                                    this.lastZ = Player.getZ();
                                    Keybind.setKey('shift', false);
                                } catch (e) {
                                    console.error('V5 Caught error' + e + e.stack);
                                }
                            });
                        });
                        this.rotatedToPoint = true;
                    }

                    if (this.attemptedEtherwarp) {
                        let hasMoved = Math.abs(Player.getX() - this.lastX) > 0.5 || Math.abs(Player.getY() - this.lastY) > 0.5;

                        if (hasMoved) {
                            this.attemptedEtherwarp = false;
                            this.etherwarpTicks = 0;
                        } else {
                            this.etherwarpTicks++;
                            if (this.etherwarpTicks % 20 === 0) {
                                let attemptNum = this.etherwarpTicks / 20;
                                this.recalculateEtherWarp(attemptNum);
                            }
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
                    }

                    this.prepartionTicks++;

                    let mineables = [];

                    for (let i = 0; i < this.route.length; i++) {
                        let checkIndex = (this.closestPointIndex + i) % this.route.length;
                        let point = this.route[checkIndex];
                        if (point.movements !== 'MINEABLE') continue;
                        let block = World.getBlockAt(point.x, point.y, point.z);
                        let reg = block?.type?.getRegistryName();

                        if (!reg.includes('air') && !reg.includes('bedrock')) mineables.push(point);
                    }

                    if (mineables.length > 0) {
                        MiningBot.populateLocations(mineables);
                    }

                    if (MiningBot.foundLocations.length === 0) {
                        MiningBot.toggle(false);
                        this.state = this.STATES.DECIDING;
                        return;
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
        let multiplier;
        if (intensity === 1) multiplier = 0.05;
        else if (intensity === 2) multiplier = 0.2;
        else multiplier = 0.5;

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
                fixedX = point.x + 1;
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
                fixedY = point.y + 1;
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
                fixedZ = point.z + 1;
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

        const offset = 0.1;

        const minX = point.x - offset;
        const maxX = point.x + 1 + offset;
        const minY = point.y - offset;
        const maxY = point.y + 1 + offset;
        const minZ = point.z - offset;
        const maxZ = point.z + 1 + offset;

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

            const isLineOfSightClear = Raytrace.isLineClear(startX, startY, startZ, targetX, targetY, targetZ);
            const dx = targetX - startX;
            const dy = targetY - startY;
            const dz = targetZ - startZ;
            const distance = Math.hypot(dx, dy, dz);

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

    rightClickEtherWarp(targetVec) {
        if (!targetVec) return;

        const player = Player.getPlayer();
        const eyePos = player.getEyePos();

        const dx = targetVec.x - eyePos.x;
        const dy = targetVec.y - eyePos.y;
        const dz = targetVec.z - eyePos.z;

        const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        const pitch = Math.atan2(-dy, Math.hypot(dx, dz)) * (180 / Math.PI);

        const packet = new PlayerInteractItemC2S(Hand.MAIN_HAND, 0, Number.parseFloat(yaw), Number.parseFloat(pitch));
        Client.sendPacket(packet);
    }

    message(msg) {
        Chat.message('&#815bf5Ore Macro: &f' + msg);
    }

    onEnable() {
        if (this.route) RouteState.setRoute(this.route, 'Ore Macro');
        this.message('&aEnabled');
        this.state = this.STATES.DECIDING;
    }

    onDisable() {
        RouteState.clearRoute();
        Rotations.stopRotation();
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
