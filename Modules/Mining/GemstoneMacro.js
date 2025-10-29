import { findAndFollowPath } from '../../Pathfinding/PathAPI';
import RenderUtils from '../../Rendering/RendererUtils';
import { Chat } from '../../Utility/Chat';
import { Vec3d } from '../../Utility/Constants';
import { Guis } from '../../Utility/Inventory';
import { Keybind } from '../../Utility/Keybinding';
import { MathUtils } from '../../Utility/Math';
import { RayTrace } from '../../Utility/Raytrace';
import { Rotations } from '../../Utility/Rotations';
import { Router } from '../../Utility/Router';
import { MiningBot } from './MiningBot';
import { ModuleBase } from '../../Utility/ModuleBase';
const { addToggle, addSlider, addMultiToggle, addCategoryItem } = global.Categories;

/**TODO
 * a thing which reads all files in the folder and sets them to a multitoggle
 * mob killer
 * gemstone type selector
 * ticks with msb etc
 */

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

        this.gemstoneCosts = {
            'minecraft:orange_stained_glass': this.AMBER ? 1 : null,
            'minecraft:orange_stained_glass_pane': this.AMBER ? 1 : null,
            'minecraft:purple_stained_glass': this.AMETHYST ? 1 : null,
            'minecraft:purple_stained_glass_pane': this.AMETHYST ? 1 : null,
            'minecraft:lime_stained_glass': this.JADE ? 1 : null,
            'minecraft:lime_stained_glass_pane': this.JADE ? 1 : null,
            'minecraft:magenta_stained_glass': this.JASPER ? 1 : null,
            'minecraft:magenta_stained_glass_pane': this.JADE ? 1 : null,
            'minecraft:red_stained_glass': this.RUBY ? 1 : null,
            'minecraft:red_stained_glass_pane': this.RUBY ? 1 : null,
            'minecraft:light_blue_stained_glass': this.SAPPHIRE ? 1 : null,
            'minecraft:light_blue_stained_glass_pane': this.SAPPHIRE ? 1 : null,
            'minecraft:yellow_stained_glass': this.TOPAZ ? 1 : null,
            'minecraft:yellow_stained_glass_pane': this.TOPAZ ? 1 : null,
        };

        this.STATES = {
            WAITING: 0,
            ETHERWARPING: 1,
            MINING: 2,
        };

        this.state = this.STATES.WAITING;

        this.enabled = false;
        this.setCost = false;
        this.point = null;
        this.loadedRoute = Router.loadRouteFromFile('gemstoneroutes/default_route.txt');
        this.route = this.loadedRoute;
        this.foundFirstPoint = false;
        this.enableMiningBot = false;
        this.completedFirstPoint = false;

        register('command', () => {
            this.toggle(true);
            this.state = this.STATES.ETHERWARPING;
        }).setName('startg');

        register('command', (action, indexArg) => {
            this.loadedRoute = Router.loadRouteFromFile('gemstoneroutes/default_route.txt');
            this.route = this.loadedRoute;
            let indexNum = undefined;

            if (indexArg !== undefined) {
                let parsedNum = parseInt(indexArg);

                if (!isNaN(parsedNum) && parsedNum >= 1) {
                    indexNum = parsedNum;
                }
            }

            this.route = Router.Edit(action.toUpperCase(), this.route, 'gemstoneroutes/default_route.txt', indexNum);

            Chat.message(`Action ${action} performed on route. Route now has ${this.route?.length} points.`);
        }).setName('gemstone');

        this.on('postRenderWorld', () => {
            const route = this.loadedRoute;

            if (!route || route.length === 0) return;

            for (let i = 0; i < route.length - 1; i++) {
                const p1 = route[i];
                const p2 = route[i + 1];

                if (p1 && p2 && typeof p1.x === 'number' && typeof p2.x === 'number') {
                }
            }

            for (let i = 0; i < route.length; i++) {
                const point = route[i];
                const index = i + 1;

                if (point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') {
                    RenderUtils.drawWireFrame(new Vec3d(point.x, point.y, point.z), [255, 0, 255, 255]);

                    RenderUtils.drawString(`${index}`, point?.x + 0.5, point?.y + 1.2, point?.z + 0.5, Renderer.WHITE, false);
                }
            }
        });

        this.on('tick', () => {
            MiningBot.setCost(this.gemstoneCosts);

            switch (this.state) {
                case this.STATES.ETHERWARPING:
                    let aotv = Guis.findItemInHotbar('Aspect of the');
                    if (aotv !== -1) Player.setHeldItemIndex(aotv);

                    Keybind.setKey('leftclick', false);

                    if (!this.completedFirstPoint) {
                        this.nearestPoint = this.getClosestPoint();

                        if (this.nearestPoint.distance < 2) {
                            this.state = this.STATES.MINING;
                            return;
                        }
                    }

                    if (!this.foundFirstPoint) {
                        if (this.nearestPoint) {
                            let playerEyePos = Player.getPlayer().getEyePos();
                            let begin = [playerEyePos.x, playerEyePos.y, playerEyePos.z];
                            let end = [this.nearestPoint.point?.x, this.nearestPoint.point?.y, this.nearestPoint.point?.z];

                            let traversedBlocks = RayTrace.rayTraceBetweenPoints(begin, end);

                            let lineOfSightIsClear = true;

                            if (traversedBlocks && traversedBlocks.length > 0) {
                                for (let i = 0; i < traversedBlocks.length - 1; i++) {
                                    const [x, y, z] = traversedBlocks[i];

                                    const block = World.getBlockAt(x, y, z);

                                    if (block.type.getID() !== 0) {
                                        lineOfSightIsClear = false;
                                        break;
                                    }
                                }
                            }

                            if (lineOfSightIsClear) {
                                Keybind.setKey('shift', true);

                                Rotations.rotateTo(
                                    [this.nearestPoint.point?.x + 0.5, this.nearestPoint.point?.y + 0.5, this.nearestPoint.point?.z + 0.5],
                                    false,
                                    150
                                );

                                Rotations.onEndRotation(() => {
                                    Keybind.rightClickDelay(this.FASTAOTV ? 4 : 7);
                                });
                                this.foundFirstPoint = true;
                            } else {
                                Chat.message('Failed to reach first point');
                            }
                        } else {
                            Chat.message('No route points found!');
                        }
                    } else if (this.completedFirstPoint) {
                        if (MiningBot.empty) {
                            Keybind.setKey('shift', true);

                            Rotations.rotateTo([this.nextPoint?.x + 0.5, this.nextPoint?.y + 0.5, this.nextPoint?.z + 0.5], false, 150);

                            Rotations.onEndRotation(() => {
                                Keybind.rightClickDelay(this.FASTAOTV ? 4 : 7);
                            });
                            MiningBot.empty = false;
                        } else {
                            Chat.message('£H');
                            let distData = MathUtils.getDistanceToPlayer(this.nextPoint?.x, this.nextPoint?.y, this.nextPoint?.z);
                            let currentDistance = distData.distance;

                            this.enableMiningBot = false;
                            if (currentDistance < 2) this.state = this.STATES.MINING;
                        }
                    }

                    break;
                case this.STATES.MINING:
                    Keybind.setKey('shift', true);

                    if (!this.enableMiningBot) {
                        MiningBot.miningbot.register();
                        MiningBot.enabled = true;
                        MiningBot.state = MiningBot.STATES.ABILITY;
                        this.enableMiningBot = true;
                    }

                    if (MiningBot.empty) {
                        this.currentIndex = this.nearestPoint.index;
                        this.nextIndex = this.currentIndex + 1;

                        this.nextPoint = this.route[this.nextIndex];
                        this.nearestPoint = {
                            point: this.nextPoint,
                            index: this.nextIndex,
                        };

                        Chat.message(this.nearestPoint.index);

                        this.completedFirstPoint = true;
                        this.state = this.STATES.ETHERWARPING;
                    }

                    break;
            }
        });

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
        this.addMultiToggle(
            'Gemstone Types',
            ['Ruby', 'Amethyst', 'Sapphire', 'Topaz', 'Amber', 'Jade', 'Jasper'],
            false,
            (selected) => {
                const setHas = (name) => selected.includes(name);
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
            'Use Preset Ticks',
            (value) => {
                this.PRESETTICKS = value;
            },
            'Use an amount of ticks instead of a calculation with mining speed'
        );
        this.addSlider(
            'Ticks with MSB',
            0,
            20,
            7,
            (value) => {
                this.TICKSWITHMSB = value;
            },
            'Amount of ticks on each block with mining speed boost'
        );
        this.addSlider(
            'Ticks without MSB',
            0,
            40,
            15,
            (value) => {
                this.TICKSWITHOUTMSB = value;
            },
            'Amount of ticks on each block without mining speed boost'
        );
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
}

new GemstoneMacro();
