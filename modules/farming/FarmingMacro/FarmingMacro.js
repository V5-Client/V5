//@VIP
import { Chat } from '../../../utils/Chat';
import { Vec3d } from '../../../utils/Constants';
import { Mixin } from '../../../utils/MixinManager';
import { ModuleBase } from '../../../utils/ModuleBase';
import { Keybind } from '../../../utils/player/Keybinding';
import { Rotations } from '../../../utils/player/Rotations';
import Render from '../../../utils/render/Render';
import { Mouse } from '../../../utils/Ungrab';
import { Utils } from '../../../utils/Utils';
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

import CaneSunflowerRose from './farms/CaneSunflowerRose';
import MelonKingDeMP from './farms/MelonKingDeMP';
import VerticalCrop from './farms/VerticalFarm';

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
        this.speedCommandSent = false;
        this.decidePrompted = false;
        this.points = Utils.getConfigFile('FarmingMacro/points.txt') || {};

        this.DEBUG = false;
        this.HIDEPARTICLES = false;

        this.HANDLERS = {
            'Vertical NetherWart / Potato / Wheat / Carrot': new VerticalCrop(this),
            "MelonKingDe's Melon / Pumpkin": new MelonKingDeMP(this),
            'Cane / Sunflower / Rose': new CaneSunflowerRose(this),
        };

        this.crop = FARMING_DATA[0].name;
        this.currentHandler = this.HANDLERS[this.crop];
        Object.assign(this, FARMING_DATA[0]);

        this.initGui();
        this.initCommands();
        this.initListeners();
    }

    applyCropSelection(selected) {
        if (!selected) selected = this.crop || FARMING_DATA[0].name;
        this.currentHandler = this.HANDLERS[selected] || null;
        this.crop = selected;

        this.createOverlay([
            {
                title: 'INFO',
                data: {
                    Crop: this.crop || 'None',
                },
            },
        ]);

        const data = FARMING_DATA.find((entry) => entry.name === selected);
        if (data) Object.assign(this, data);
        if (this.currentHandler) this.currentHandler.reset();
    }

    initGui() {
        this.addMultiToggle(
            'Crop',
            FARMING_DATA.map((data) => data.name),
            true,
            (selectedOptions) => {
                const selected = selectedOptions.find((option) => option.enabled)?.name;
                this.applyCropSelection(selected);
            },
            'Type of crop to farm'
        );

        this.applyCropSelection(this.crop);

        this.addToggle(
            'Hide Crop Particles',
            (isEnabled) => ((this.HIDEPARTICLES = isEnabled), Mixin.set('hideParticles', isEnabled))
        );
        this.addToggle('Debug Messages', (isEnabled) => (this.DEBUG = isEnabled));

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

            if (this.state === this.STATES.SCANFORCROP) {
                if (!this.points.start || !this.points.end) {
                    this.message('&cYou need to set both start and end points!');
                    this.toggle(false);
                    return;
                }

                if (this.hasRanchersBoots()) {
                    let correctSpeed = this.speed;
                    let currentSpeed = this.getCurrentSpeedCap();

                    if (correctSpeed !== currentSpeed) {
                        if (!this.speedCommandSent) {
                            ChatLib.command(`setmaxspeed ${correctSpeed}`);
                            this.speedCommandSent = true;
                        }
                        return;
                    }

                    this.speedCommandSent = false;
                } else {
                    this.message('&cNo rancher boots speed may be incorrect!');
                }
            }

            this.currentHandler.onTick();
        });

        this.when(
            () => Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                if (!this.points) return;

                if (this.points.end) {
                    Render.drawStyledBox(
                        new Vec3d(this.points.end.x, this.points.end.y, this.points.end.z),
                        Render.Color(240, 90, 90, 100),
                        Render.Color(240, 90, 90, 255),
                        4,
                        false
                    );
                }

                if (this.points.start) {
                    Render.drawStyledBox(
                        new Vec3d(this.points.start.x, this.points.start.y, this.points.start.z),
                        Render.Color(100, 220, 150, 100),
                        Render.Color(100, 220, 150, 255),
                        4,
                        false
                    );
                }
            }
        );
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
            .map((loreLine) => ChatLib.removeFormatting(loreLine))
            .join(' ');

        let match = lore.match(/Current Speed Cap:\s*(\d+)/i);

        if (match) return Number.parseInt(match[1], 10);

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
        this.currentHandler?.reset();

        Mouse.ungrab();
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;

        this.warping = false;
        this.movementKey = null;
        this.ignoreKeys = [];
        this.decidePrompted = false;
        this.speedCommandSent = false;
        this.currentHandler?.reset();

        Mouse.regrab();
        Keybind.unpressKeys();
        Rotations.stopRotation();
        Keybind.setKey('leftclick', false);
    }
}

export default new FarmingMacro();
