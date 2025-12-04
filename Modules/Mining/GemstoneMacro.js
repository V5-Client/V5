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
import { Utils } from '../../Utility/Utils';

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
        this.closestPointIndex = null;
        this.rotatedToPoint = false;
        this.toggled = false;

        register('command', (action, indexArg) => {
            this.routesDir = Router.getFilesinDir('GemstoneRoutes');
            let indexNum = undefined;

            if (indexArg !== undefined) {
                let parsedNum = parseInt(indexArg);

                if (!isNaN(parsedNum) && parsedNum >= 1) {
                    indexNum = parsedNum;
                }
            }

            this.route = Router.Edit(action.toUpperCase(), this.route, 'GemstoneRoutes/' + this.loadedFile, indexNum);

            Chat.message(`Action ${action} performed on route. Route now has ${this.route?.length} points.`);
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
                        RenderUtils.drawStyledBox(new Vec3d(current.x, current.y, current.z), [0, 100, 200, 120], [0, 100, 200, 255], 4, false);
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
                        this.closestPointIndex = this.closestPoint.index;
                        this.closestPoint = this.getPointOnBlock(this.closestPoint.point);
                    }

                    this.dist = MathUtils.distanceToPlayerFeet([this.closestPoint.x + 0.5, this.closestPoint.y + 0.5, this.closestPoint.z + 0.5]);
                    this.distance = this.dist.distance;

                    /*if (this.distance < 2 && !this.rotatedToPoint) {
                        this.message('Already at point ' + this.closestPointIndex);
                        this.closestPointIndex++;
                        this.closestPoint = this.getPointOnBlock(this.route[this.closestPointIndex]);
                        this.state = this.STATES.MINING;
                        return;
                    }*/

                    if (!this.rotatedToPoint) {
                        Keybind.setKey('shift', true);
                        if (!Player.getPlayer().isSneaking()) return;

                        Rotations.rotateToVector(this.closestPoint, 1);
                        Rotations.onEndRotation(() => {
                            Keybind.rightClickDelay(this.FASTAOTV ? 4 : 7);
                        });
                        this.message('Rotating to point ' + this.closestPointIndex);
                        this.rotatedToPoint = true;
                    }

                    if (this.rotatedToPoint) {
                        Chat.message('Distance to point ' + this.closestPointIndex + ': ' + this.distance);

                        if (this.distance < 2) {
                            this.message('Arrived at point ' + this.closestPointIndex);
                            this.rotatedToPoint = false;
                            this.closestPointIndex++;
                            this.closestPoint = this.getPointOnBlock(this.route[this.closestPointIndex]);
                            this.state = this.STATES.MINING;
                            return;
                        }
                    }
                    break;
                case this.STATES.MINING:
                    if (!this.toggled) {
                        this.toggled = true;
                        MiningBot.toggle(true);
                        return;
                    }

                    if (MiningBot.isEmpty()) {
                        this.toggled = false;

                        this.message('No more gemstones found');
                        this.state = this.STATES.ETHERWARPING;
                        return;
                    }

                    /*if (MiningBot.isEmpty()) { 
                        this.toggle(false);
                        this.message('No more gemstones found');
                        return;
                    }*/
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

        const newX = point.x + randomOffset(0.1, 0.9);
        const newY = point.y + randomOffset(0.1, 0.9);
        const newZ = point.z + randomOffset(0.1, 0.9);

        return new Vec3d(newX, newY, newZ);
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
        this.message('&aEnabled');
        this.state = this.STATES.ETHERWARPING;
    }

    onDisable() {
        this.toggled = false;
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        MiningBot.toggle(false);
    }
}

new GemstoneMacro();
