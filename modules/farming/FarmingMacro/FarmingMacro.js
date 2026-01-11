import { Chat } from '../../../utils/Chat';
import { MathUtils } from '../../../utils/Math';
import { ModuleBase } from '../../../utils/ModuleBase';
import { Rotations } from '../../../utils/player/Rotations';
import { Mouse } from '../../../utils/Ungrab';
import { Utils } from '../../../utils/Utils';
import { Guis } from '../../../utils/player/Inventory';
import { Keybind } from '../../../utils/player/Keybinding';
import { Router } from '../../../utils/Router';
import RenderUtils from '../../../utils/render/RendererUtils';
import { Vec3d } from '../../../utils/Constants';
import { attachMixin } from '../../../utils/AttachMixin';
import { spawnBreakParticles } from '../../../mixins/SpawnBreakParticlesMixin';
import { v5Command } from '../../../utils/V5Commands';

const FARMING_DATA = [
    {
        name: 'Vertical NetherWart / Potato / Wheat / Carrot',
        registry: ['minecraft:nether_wart', 'minecraft:potatoes', 'minecraft:wheat', 'minecraft:carrots'],
        speed: 93,
        pitch: 3,
    },
    {
        name: "MelonKingDe's Melon / Pumpkin",
        registry: ['minecraft:melon', 'minecraft:carved_pumpkin'],
        speed: 400,
        pitch: -59.2,
    },
    {
        name: 'Cane / Sunflower / Rose',
        registry: ['minecraft:sugar_cane', 'minecraft:sunflower', 'minecraft:rose_bush'],
        speed: 328,
        pitch: 0,
    },
];

import VerticalCrop from './farms/VerticalFarm';
import MelonKingDeMP from './farms/MelonKingDeMP';
import CaneSunflowerRose from './farms/CaneSunflowerRose';

class FarmingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Macro',
            subcategory: 'Farming',
            description: 'Automates farming for various crops.',
            tooltip: 'WIP farming macro',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
        });

        this.STATES = {
            WAITING: 0,
            SCANFORCROP: 1,
            DECIDEROTATION: 2,
            DECIDEITEM: 3,
            DECIDEMOVEMENT: 4,
            IDLECHECKS: 5,
            REWARP: 6,
        };

        this.state = this.STATES.WAITING;

        this.farmAxis = null;
        this.movementKey = null;
        this.ignoreKeys = [];
        this.warping = false;
        this.saidCommand = false;
        this.points = Utils.getConfigFile('FarmingMacro/points.txt') || {};

        this.DEBUG = false;
        this.HIDEPARTICLES = false;

        this.HANDLERS = {
            'Vertical NetherWart / Potato / Wheat / Carrot': new VerticalCrop(this),
            "MelonKingDe's Melon / Pumpkin": new MelonKingDeMP(this),
            'Cane / Sunflower / Rose': new CaneSunflowerRose(this),
        };

        this.currentHandler = null;

        this.initGui();
        this.initCommands();
        this.initListeners();
    }

    initGui() {
        this.addMultiToggle(
            'Crop',
            FARMING_DATA.map((data) => data.name),
            true,
            (v) => {
                const selected = v.find((option) => option.enabled)?.name;
                this.currentHandler = this.HANDLERS[selected];

                this.crop = selected;

                this.createOverlay([
                    {
                        title: 'INFO',
                        data: {
                            Crop: this.crop || 'None',
                        },
                    },
                ]);

                if (this.currentHandler) {
                    const data = FARMING_DATA.find((d) => d.name === selected);
                    Object.assign(this, data);
                }
            },
            'Type of crop to farm'
        );

        this.addToggle('Hide Crop Particles', (v) => (this.HIDEPARTICLES = v));
        this.addToggle('Debug Messages', (v) => (this.DEBUG = v));

        this.bindToggleKey();
    }

    initCommands() {
        v5Command('setstart', () => {
            if (Utils.area() !== 'Garden') return this.message('&cNot in garden!');
            this.points.start = {
                x: Math.floor(Player.getX()),
                y: Math.round(Player.getY()),
                z: Math.floor(Player.getZ()),
            };
            ChatLib.command('sethome');
            Utils.writeConfigFile('FarmingMacro/points.txt', this.points);
            this.message('&aStart point saved!');
        });

        v5Command('setend', () => {
            if (Utils.area() !== 'Garden') return this.message('&cNot in garden!');
            this.points.end = {
                x: Math.floor(Player.getX()),
                y: Math.round(Player.getY()),
                z: Math.floor(Player.getZ()),
            };
            Utils.writeConfigFile('FarmingMacro/points.txt', this.points);
            this.message('&aEnd point saved!');
        });
    }

    initListeners() {
        this.on('tick', () => {
            if (Utils.area() !== 'Garden') {
                this.message('&cYou are not on the Garden!');
                this.toggle(false);
                return;
            }

            if (!this.currentHandler) {
                this.message('&cNo handler found for this crop!');
                this.toggle(false);
                return;
            }

            switch (this.state) {
                case this.STATES.SCANFORCROP:
                    if (!this.points.start || !this.points.end) {
                        this.message('&cYou need to set both start and end points!');
                        this.toggle(false);
                        return;
                    }

                    if (this.hasRanchersBoots()) {
                        let correctSpeed = this.speed;
                        let currentSpeed = this.getCurrentSpeedCap();

                        if (correctSpeed !== currentSpeed) {
                            if (!this.saidCommand) {
                                ChatLib.command(`setmaxspeed ${correctSpeed}`);
                                this.saidCommand = true;
                            }
                            return;
                        }

                        this.saidCommand = false;
                    } else {
                        this.message('&cNo rancher boots speed may be incorrect!');
                    }

                    break;
                case this.STATES.DECIDEROTATION:
                    break;

                case this.STATES.REWARP:
                    break;

                case this.STATES.WAITING:
                    break;
            }

            this.currentHandler.onTick();
        });

        this.when(
            () => Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                if (!this.points) return;

                if (this.points.end) {
                    RenderUtils.drawStyledBox(
                        new Vec3d(this.points.end.x, this.points.end.y, this.points.end.z),
                        [240, 90, 90, 100],
                        [240, 90, 90, 255],
                        4,
                        false
                    );
                }

                if (this.points.start) {
                    RenderUtils.drawStyledBox(
                        new Vec3d(this.points.start.x, this.points.start.y, this.points.start.z),
                        [100, 220, 150, 100],
                        [100, 220, 150, 255],
                        4,
                        false
                    );
                }
            }
        );

        attachMixin(spawnBreakParticles, 'Block', (instance, cir) => {
            if (!this.HIDEPARTICLES) return;
            const blockKey = instance.getTranslationKey();
            const targetKeys = [
                'block.minecraft.melon',
                'block.minecraft.pumpkin',
                'block.minecraft.carrots',
                'block.minecraft.potatoes',
                'block.minecraft.wheat',
                'block.minecraft.nether_wart',
            ];
            if (targetKeys.includes(blockKey)) cir.cancel();
        });
    }

    hasRanchersBoots() {
        let boots = Player.getInventory().getStackInSlot(36);
        if (!boots) return false;

        return boots.getName().removeFormatting().includes("Rancher's Boots");
    }

    getCurrentSpeedCap() {
        let boots = Player.getInventory()?.getStackInSlot(36);
        if (!boots) return null;

        let lore = boots
            .getLore()
            .map((l) => ChatLib.removeFormatting(l))
            .join(' ');

        let match = lore.match(/Current Speed Cap:\s*(\d+)/i);

        if (match) return parseInt(match[1]);

        return null;
    }

    message(msg, debug = false) {
        if (debug && !this.DEBUG) return;
        const prefix = debug ? '&#33ba11Farming Macro: &c[DEBUG]' : '&#33ba11Farming Macro:';
        Chat.message(`${prefix}&f ${msg}`);
    }

    onEnable() {
        this.message('&aEnabled');
        this.state = this.STATES.SCANFORCROP;

        Mouse.ungrab();
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;

        this.warping = false;
        this.movementKey = null;
        this.ignoreKeys = null;

        Mouse.regrab();
        Keybind.unpressKeys();
        Rotations.stopRotation();
        Keybind.setKey('leftclick', false);
    }
}

export default new FarmingMacro();
