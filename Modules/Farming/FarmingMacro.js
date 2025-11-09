import RenderUtils from '../../Rendering/RendererUtils';
import { Chat } from '../../Utility/Chat';
import { Vec3d } from '../../Utility/Constants';
import { Guis } from '../../Utility/Inventory';
import { Keybind } from '../../Utility/Keybinding';
import { MathUtils } from '../../Utility/Math';
import { ModuleBase } from '../../Utility/ModuleBase';
import { RotationRedo } from '../../Utility/RotationsTest';
import { Mouse } from '../../Utility/Ungrab';
import { Utils } from '../../Utility/Utils';

class FarmingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Macro',
            subcategory: 'Farming',
            description: 'Automates farming for various crops.',
            tooltip: 'WIP farming macro, requires farm layouts. Make a suggestion for more farm layouts.',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
        });

        this.STATES = {
            WAITING: 0,
            SCANFORCROP: 1,
            DECIDEROTATION: 2,
            MOVEMENT: 3,
        };

        this.state = this.STATES.WAITING;
        this.farmAxis = null;

        this.bindToggleKey();
        this.addMultiToggle('Crop', ['Vertical Netherwart', 'Vertical Potato', 'Vertical Wheat', 'Vertical Carrot', 'Melon/Pumpkin'], true, (v) => {
            this.CROPS = v;
        });

        this.on('tick', () => {
            if (Utils.area() !== 'Garden') {
                this.message('&cYou are not on the Garden!');
                this.toggle(false);
                return;
            }

            switch (this.state) {
                case this.STATES.SCANFORCROP:
                    const crop = this.CROPS.find((option) => option.enabled)?.name;
                    const cropData = FARMING_DATA.find((data) => data.name === crop);

                    if (!cropData) {
                        this.message('§cUnable to find the correct crop. Report this!');
                        this.toggle(false);
                        return;
                    }

                    Object.assign(this, cropData);

                    let targetBlocks;
                    const cube = this.scan3x3x3();

                    if (Array.isArray(this.registry)) targetBlocks = cube.filter((block) => this.registry.includes(block.name));
                    else targetBlocks = cube.filter((block) => block.name === this.registry);

                    if (targetBlocks.length > 0) {
                        const sumX = targetBlocks.reduce((sum, block) => sum + block.x, 0);
                        const sumY = targetBlocks.reduce((sum, block) => sum + block.y, 0);
                        const sumZ = targetBlocks.reduce((sum, block) => sum + block.z, 0);

                        const count = targetBlocks.length;
                        const avgX = sumX / count;
                        const avgY = sumY / count;
                        const avgZ = sumZ / count;

                        this.targetX = avgX + 0.5;
                        this.targetY = avgY;
                        this.targetZ = avgZ + 0.5;

                        const xCoords = targetBlocks.map((b) => b.x);
                        const zCoords = targetBlocks.map((b) => b.z);

                        const minX = Math.min(...xCoords);
                        const maxX = Math.max(...xCoords);
                        const minZ = Math.min(...zCoords);
                        const maxZ = Math.max(...zCoords);

                        const spanX = maxX - minX;
                        const spanZ = maxZ - minZ;

                        if (spanX > spanZ) this.farmAxis = 'X';
                        else if (spanZ > spanX) this.farmAxis = 'Z';
                        else this.farmAxis = 'X'; // idk what the fuck to do here

                        this.state = this.STATES.DECIDEROTATION;
                    } else {
                        this.message('&cYou are not near your selected crop!');
                        this.toggle(false);
                        return;
                    }
                    break;
                case this.STATES.DECIDEROTATION:
                    let targetAngles = MathUtils.calculateAbsoluteAngles([this.targetX, this.targetY, this.targetZ]);
                    let targetYaw = targetAngles.yaw;

                    if (targetYaw > 180) targetYaw -= 360;
                    if (targetYaw <= -180) targetYaw += 360;

                    let allowedYaws;
                    if (this.farmAxis === 'X') allowedYaws = [0, -180];
                    else if (this.farmAxis === 'Z') allowedYaws = [90, -90];
                    else allowedYaws = [0, 90, -90, -180];

                    let snappedYaw = targetYaw;
                    let minDifference = 361;

                    for (const allowed of allowedYaws) {
                        let diff = Math.abs(targetYaw - allowed);
                        let shortestDiff = Math.min(diff, 360 - diff);

                        if (shortestDiff < minDifference) {
                            minDifference = shortestDiff;
                            snappedYaw = allowed;
                        }
                    }

                    this.yaw = snappedYaw;

                    RotationRedo.rotateToAngles(this.yaw, this.pitch);
                    this.state = this.STATES.MOVEMENT;
                    break;
                case this.STATES.MOVEMENT:
                    // this.scan3x3x3(); //
                    break;
            }
        });
    }

    scan3x3x3() {
        const playerBlockX = Math.floor(Player.getPlayer().getX());
        const playerBlockY = Math.floor(Player.getPlayer().getY());
        const playerBlockZ = Math.floor(Player.getPlayer().getZ());

        const scanResults = [];
        const xzOffsets = [-1, 0, 1];
        const yOffsets = [0, 1, 2];

        for (const yOffset of yOffsets) {
            const scanY = playerBlockY + yOffset;
            for (const xOffset of xzOffsets) {
                const scanX = playerBlockX + xOffset;
                for (const zOffset of xzOffsets) {
                    const scanZ = playerBlockZ + zOffset;

                    const block = World.getBlockAt(scanX, scanY, scanZ);

                    scanResults.push({
                        x: scanX,
                        y: scanY,
                        z: scanZ,
                        name: block?.type?.getRegistryName(),
                    });
                }
            }
        }

        return scanResults;
    }

    message(msg) {
        Chat.message('&#33ba11Farming Macro: &f' + msg);
    }

    onEnable() {
        Mouse.Ungrab();
        this.message('&aEnabled');
        this.state = this.STATES.SCANFORCROP;
    }

    onDisable() {
        Mouse.Regrab();
        RotationRedo.stopRotation();
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.farmAxis = null;
    }
}

new FarmingMacro();

// ig this could be improved somehow
const FARMING_DATA = [
    {
        name: 'Vertical Netherwart',
        registry: 'minecraft:nether_wart',
        item: 'Nether Warts Hoe',
        avgBPS: 2.19,
        pitch: 3,
    },
    {
        name: 'Vertical Potato',
        registry: 'minecraft:potatoes',
        item: 'Pythagorean Potato Hoe',
        avgBPS: 2.19,
        pitch: 3,
    },
    {
        name: 'Vertical Wheat',
        registry: 'minecraft:wheat',
        item: "Euclid's Wheat Hoe",
        avgBPS: 2.19,
        pitch: 3,
    },
    {
        name: 'Vertical Carrot',
        registry: 'minecraft:carrots',
        item: 'Gauss Carrot Hoe',
        avgBPS: 2.19,
        pitch: 3,
    },
    {
        name: 'Melon/Pumpkin',
        registry: ['minecraft:melon', 'minecraft:carved_pumpkin'],
        item: 'Pumpkin Dicer' || 'Melon Dicer',
        avgBPS: 2.19,
        pitch: -59.2,
    },
];
