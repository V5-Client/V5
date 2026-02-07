import Render from '../../utils/render/Render';
import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { MathUtils } from '../../utils/Math';
import { Raytrace } from '../../utils/Raytrace';
import { Rotations } from '../../utils/player/Rotations';
import { Router } from '../../utils/Router';
import { MiningBot } from './MiningBot';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import RouteState from '../../utils/RouteState';
import { PlayerInteractBlockC2S, PlayerInteractItemC2S } from '../../utils/Packets';
import { MiningUtils } from '../../utils/MiningUtils';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Mouse } from '../../utils/Ungrab';
import { ServerInfo } from '../../utils/player/ServerInfo';

class GemstoneMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Gemstone Macro',
            subcategory: 'Mining',
            description: 'Macro for gemstones',
            tooltip: 'Macro for gemstones',
            showEnabledToggle: false,
            isMacro: true,
            autoDisableOnWorldUnload: true,
        });

        this.gemstoneCosts = {
            'minecraft:orange_stained_glass': 4,
            'minecraft:orange_stained_glass_pane': 4,
            'minecraft:purple_stained_glass': 4,
            'minecraft:purple_stained_glass_pane': 4,
            'minecraft:lime_stained_glass': 4,
            'minecraft:lime_stained_glass_pane': 4,
            'minecraft:magenta_stained_glass': 4,
            'minecraft:magenta_stained_glass_pane': 4,
            'minecraft:red_stained_glass': 4,
            'minecraft:red_stained_glass_pane': 4,
            'minecraft:light_blue_stained_glass': 4,
            'minecraft:light_blue_stained_glass_pane': 4,
            'minecraft:yellow_stained_glass': 4,
            'minecraft:yellow_stained_glass_pane': 4,
        };

        this.bindToggleKey();
        this.setTheme('#fb42f5');

        this.FASTAOTV = false;
        this.MOBKILLER = false;

        this.RUBY = false;
        this.SAPPHIRE = false;
        this.AMETHYST = false;
        this.TOPAZ = false;
        this.JADE = false;
        this.JASPER = false;
        this.AMBER = false;

        this.STATES = {
            WAITING: 0,
            DECIDING: 1,
            ETHERWARPING: 2,
            MINING: 3,
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

        this.miningBotEnabled = false;
        this.scanned = false;
        this.locations = null;
        this.scanTimeout = 0;

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => {
                        const key = Object.keys(this.STATES).find((k) => this.STATES[k] === this.state) || 'Unknown';
                        return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
                    },
                    'Route Progress': () => (this.route ? `${this.closestPointIndex || 0}/${this.route.length + 1}` : 'No Route'),
                    'Targets Found': () => MiningBot.foundLocations.length,
                    TPS: () => ServerInfo.getTPS().toFixed(1),
                },
            },
        ]);

        register('command', (action, indexArg) => {
            const actionUpper = action.toUpperCase();
            const indexNum = indexArg && !isNaN(indexArg) ? parseInt(indexArg) : undefined;
            this.route = Router.Edit(actionUpper, this.route, `GemstoneRoutes/${this.loadedFile}`, indexNum);
        }).setName('gemstone');

        this.when(
            () => Utils.area() === 'Crystal Hollows',
            'postRenderWorld',
            () => {
                if (!this.route || this.route.length < 1) return;

                const amethyst = [125, 18, 255];

                for (let i = 0; i < this.route.length; i++) {
                    const current = this.route[i];
                    if (!current || typeof current.x !== 'number') continue;

                    const pos = new Vec3d(current.x, current.y, current.z);

                    Render.drawText(`#${i + 1}`, pos.add(0.5, 1.3, 0.5), 1.2, true, false, true);
                    Render.drawStyledBox(pos, Render.Color(...amethyst, 80), Render.Color(...amethyst, 255), 2, false);

                    const nextIndex = (i + 1) % this.route.length;

                    if (this.route.length > 1) {
                        const next = this.route[nextIndex];
                        if (next && typeof next.x === 'number') {
                            Render.drawLine(
                                new Vec3d(current.x + 0.5, current.y + 0.5, current.z + 0.5),
                                new Vec3d(next.x + 0.5, next.y + 0.5, next.z + 0.5),
                                Render.Color(...amethyst, 255),
                                2
                            );
                        }
                    }
                }
            }
        );

        this.on('tick', () => {
            MiningBot.setCost(this.getGemstoneCosts());

            switch (this.state) {
                // put into etherwarping but gemini wanted to dislike me and do this
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
                    this.state = this.STATES.ETHERWARPING;
                    break;

                case this.STATES.ETHERWARPING:
                    MiningBot.toggle(false);
                    Keybind.setKey('leftclick', false);
                    let aotv = Guis.findItemInHotbar('Aspect of the Void');

                    if (!this.closestPoint) {
                        let currentPoint = this.route[this.closestPointIndex];
                        let block = World.getBlockAt(currentPoint.x, currentPoint.y, currentPoint.z);

                        if (block?.type?.getID() === 0 || block?.type?.getID() === 200) {
                            this.message(`&cPoint is unreachable!`);
                            this.toggle(false);
                            return;
                        }

                        if (!this.isEtherWarpable(block)) {
                            this.message(`&cPoint cannot be etherwarped to!`);
                            this.toggle(false);
                            return;
                        }

                        let target = this.getPointOnBlock(currentPoint);
                        if (!target) {
                            this.message('&cNext point is not visible!');
                            this.toggle(false);
                            return;
                        }
                        this.closestPoint = target;
                        this.rawPoint = currentPoint;
                        this.rotatedToPoint = false;
                        this.attemptedEtherwarp = false;
                    }

                    this.dist = MathUtils.distanceToPlayerFeet([this.closestPoint.x, this.closestPoint.y, this.closestPoint.z]);

                    // Check if we arrived
                    if (this.dist.distance < 2) {
                        this.message(`Arrived at point ${this.closestPointIndex + 1}.`);
                        this.closestPoint = null;
                        this.rotatedToPoint = false;
                        this.attemptedEtherwarp = false;
                        this.etherwarpTicks = 0;
                        this.closestPointIndex = (this.closestPointIndex + 1) % this.route.length;
                        MiningBot.equipDrill = false;

                        this.state = this.STATES.MINING;
                        return;
                    }

                    // Handle the rotation and teleportation
                    if (!this.rotatedToPoint) {
                        Guis.setItemSlot(aotv);
                        Keybind.setKey('shift', true);
                        if (!Player.getPlayer().isSneaking()) return;

                        Rotations.rotateToVector(this.closestPoint, 1);
                        Rotations.onEndRotation(() => {
                            if (!this.enabled) return;
                            ScheduleTask(this.FASTAOTV ? 2 : 5, () => {
                                this.rightClickEtherWarp(this.closestPoint);
                                this.attemptedEtherwarp = true;
                                this.lastX = Player.getX();
                                this.lastY = Player.getY();
                                this.lastZ = Player.getZ();
                                Keybind.setKey('shift', false);
                            });
                        });
                        this.rotatedToPoint = true;
                    }

                    // Logic for handling "What happens after the click"
                    if (this.attemptedEtherwarp) {
                        let hasMoved = Math.abs(Player.getX() - this.lastX) > 0.1 || Math.abs(Player.getY() - this.lastY) > 0.1;

                        if (hasMoved) {
                            // If we moved, but the distance is still > 2, reset rotation to try again
                            if (this.dist.distance >= 2) {
                                this.rotatedToPoint = false;
                                this.attemptedEtherwarp = false;
                                this.etherwarpTicks = 0;
                            } else {
                                // Arrived (will be caught by the distance check at the top of next tick)
                                this.attemptedEtherwarp = false;
                                this.etherwarpTicks = 0;
                            }
                        } else {
                            // Stuck or teleport failed to register
                            this.etherwarpTicks++;
                            if (this.etherwarpTicks % 20 === 0) {
                                this.recalculateEtherWarp(this.etherwarpTicks / 20);
                            }
                        }
                    }
                    break;
                case this.STATES.MINING:
                    MiningBot.FOVPenalty = false;

                    // 1. Trigger the scan once
                    if (!this.scanned) {
                        MiningBot.foundLocations = [];
                        MiningBot.scanForBlock(this.gemstoneCosts);
                        this.scanned = true;
                        return; // STOP HERE. Wait for the next tick to give the async scan time to work.
                    }

                    // 2. Wait for the scan to finish
                    if (MiningBot.isScanning()) {
                        return; // Still searching... don't do anything yet.
                    }

                    // 3. NOW check the results
                    if (MiningBot.foundLocations.length > 0) {
                        if (!MiningBot.enabled) MiningBot.toggle(true, true);

                        // We found gems! Keep the bot enabled.
                    } else {
                        // WE ACTUALLY FINISHED SCANNING AND THE LIST IS EMPTY
                        // this.message('&eNo gems found at this spot, moving on.');
                        MiningBot.foundLocations = [];
                        MiningBot.toggle(false, true);
                        this.scanned = false;
                        this.state = this.STATES.DECIDING;
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
            ['Ruby', 'Sapphire', 'Amethyst', 'Topaz', 'Jade', 'Jasper', 'Amber'],
            false,
            (selected) => {
                const setHas = (name) => selected.some((item) => item.name === name && item.enabled === true);
                this.RUBY = setHas('Ruby');
                this.SAPPHIRE = setHas('Sapphire');
                this.AMETHYST = setHas('Amethyst');
                this.TOPAZ = setHas('Topaz');
                this.JADE = setHas('Jade');
                this.JASPER = setHas('Jasper');
                this.AMBER = setHas('Amber');
            },
            'The types of gemstones to mine'
        );

        this.addToggle('Fast AOTV', (value) => {
            this.FASTAOTV = value;
        });
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

    isEtherWarpable(block) {
        if (!block) return false;
        const above1 = World.getBlockAt(block.x, block.y + 1, block.z);
        const above2 = World.getBlockAt(block.x, block.y + 2, block.z);
        return above1.getType().getID() === 0 && above2.getType().getID() === 0;
    }

    recalculateEtherWarp(intensity) {
        this.rotatedToPoint = false;
        let newTarget = this.getPointOnBlock(this.rawPoint);
        let mult = intensity === 1 ? 0.05 : intensity === 2 ? 0.2 : 0.5;
        if (newTarget) {
            this.closestPoint = {
                x: newTarget.x + (Math.random() - 0.5) * mult,
                y: newTarget.y + (Math.random() - 0.5) * mult,
                z: newTarget.z + (Math.random() - 0.5) * mult,
            };
        }
        if (intensity >= 3) {
            this.toggle(false);
            this.message('&cEtherwarp failed after 3 attempts!');
        }
    }

    getPointOnBlock(point) {
        const randomOffset = (min, max) => Math.random() * (max - min) + min;
        const closestHit = this.raytraceBlockFaces(point);
        if (!closestHit) return null;
        const faceName = closestHit.face;
        const rMin = 0.25,
            rMax = 0.85;
        switch (faceName) {
            case 'EAST':
                return new Vec3d(point.x + 1.0, randomOffset(point.y + rMin, point.y + rMax), randomOffset(point.z + rMin, point.z + rMax));
            case 'WEST':
                return new Vec3d(point.x, randomOffset(point.y + rMin, point.y + rMax), randomOffset(point.z + rMin, point.z + rMax));
            case 'UP':
                return new Vec3d(randomOffset(point.x + rMin, point.x + rMax), point.y + 1.0, randomOffset(point.z + rMin, point.z + rMax));
            case 'DOWN':
                return new Vec3d(randomOffset(point.x + rMin, point.x + rMax), point.y, randomOffset(point.z + rMin, point.z + rMax));
            case 'SOUTH':
                return new Vec3d(randomOffset(point.x + rMin, point.x + rMax), randomOffset(point.y + rMin, point.y + rMax), point.z + 1.0);
            case 'NORTH':
                return new Vec3d(randomOffset(point.x + rMin, point.x + rMax), randomOffset(point.y + rMin, point.y + rMax), point.z);
            default:
                return null;
        }
    }

    raytraceBlockFaces(point) {
        const player = Player.getPlayer();
        const start = player.getEyePos();
        const faces = [
            { name: 'EAST', target: [point.x + 1.1, point.y + 0.5, point.z + 0.5] },
            { name: 'WEST', target: [point.x - 0.1, point.y + 0.5, point.z + 0.5] },
            { name: 'UP', target: [point.x + 0.5, point.y + 1.1, point.z + 0.5] },
            { name: 'DOWN', target: [point.x + 0.5, point.y - 0.1, point.z + 0.5] },
            { name: 'SOUTH', target: [point.x + 0.5, point.y + 0.5, point.z + 1.1] },
            { name: 'NORTH', target: [point.x + 0.5, point.y + 0.5, point.z - 0.1] },
        ];
        let closest = null,
            shortest = Infinity;
        for (const face of faces) {
            const [tx, ty, tz] = face.target;
            if (Raytrace.isLineClear(start.x, start.y, start.z, tx, ty, tz)) {
                let d = Math.sqrt((tx - start.x) ** 2 + (ty - start.y) ** 2 + (tz - start.z) ** 2);
                if (d < shortest) {
                    shortest = d;
                    closest = { face: face.name, hitPos: { x: tx, y: ty, z: tz } };
                }
            }
        }
        return closest;
    }

    getClosestPoint() {
        if (!this.route || this.route.length === 0) return null;
        let closest = null,
            shortest = Infinity;
        for (let i = 0; i < this.route.length; i++) {
            let d = MathUtils.getDistanceToPlayer(this.route[i].x, this.route[i].y, this.route[i].z).distance;
            if (d < shortest) {
                shortest = d;
                closest = { index: i };
            }
        }
        return closest;
    }

    rightClickEtherWarp(targetVec) {
        const player = Player.getPlayer();
        const eye = player.getEyePos();
        const dx = targetVec.x - eye.x,
            dy = targetVec.y - eye.y,
            dz = targetVec.z - eye.z;
        const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        const pitch = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
        Client.sendPacket(new PlayerInteractItemC2S(Hand.MAIN_HAND, 0, parseFloat(yaw), parseFloat(pitch)));
    }

    onEnable() {
        if (this.route) RouteState.setRoute(this.route, 'Gemstone Macro');

        Mouse.ungrab();

        // Reset Logic State
        this.state = this.STATES.DECIDING;
        this.scanned = false;
        this.miningBotEnabled = false;

        // Reset Navigation Variables
        this.closestPoint = null;
        this.rawPoint = null;
        this.closestPointIndex = null;
        this.rotatedToPoint = false;
        this.attemptedEtherwarp = false;

        // Reset Counters/Timers
        this.etherwarpAttempts = 0;
        this.etherwarpTicks = 0;
        this.scanTickTimeout = 0;

        this.message('&aEnabled');
    }

    onDisable() {
        // Clear Global/External States
        RouteState.clearRoute();
        Rotations.stopRotation();
        MiningBot.toggle(false, true);
        MiningBot.foundLocations = [];
        Keybind.unpressKeys();
        Mouse.regrab();

        // Reset Local Logic State
        this.state = this.STATES.WAITING;
        this.scanned = false;
        this.miningBotEnabled = false;

        // Reset Navigation Variables
        this.closestPoint = null;
        this.rawPoint = null;
        this.closestPointIndex = null;
        this.rotatedToPoint = false;
        this.attemptedEtherwarp = false;

        // Reset Counters/Timers
        this.etherwarpAttempts = 0;
        this.etherwarpTicks = 0;
        this.scanTickTimeout = 0;

        this.message('&cDisabled');
    }
}

new GemstoneMacro();
