import { Chat } from '../../utils/Chat';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';

const FARMING_DATA = [
    {
        name: 'Vertical NetherWart / Potato / Wheat / Carrot',
        registry: ['minecraft:nether_wart', 'minecraft:potatoes', 'minecraft:wheat', 'minecraft:carrots'],
        avgBPS: 2.19,
        pitch: 3,
    },
    {
        name: "MelonKingDe's Melon / Pumpkin",
        registry: ['minecraft:melon', 'minecraft:carved_pumpkin'],
        blockCheck: 1,
        avgBPS: 2.19,
        pitch: -59.2,
    },
];

// how i decided to make this work
// big decision making :sob:
// decide roations and item
// then decide Movement only tells Idlechecks where to go and what to do
// if you plan on adding other crops follow this pattern

// todo : rewarp, check block  metadata for crop type when sides is balanced out etc

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
        };

        this.state = this.STATES.WAITING;
        this.farmAxis = null;
        this.movementKey = null;
        this.ignoreKey = null;
        this.inAir = false;

        this.bindToggleKey();

        this.addMultiToggle(
            'Crop',
            FARMING_DATA.map((data) => data.name),
            true,
            (v) => {
                this.CROPS = v;
            }
        );

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
                    let lookingAt = Player.lookingAt();
                    let isTargetCrop = false;

                    if (lookingAt) {
                        let block = World.getBlockAt(lookingAt.x, lookingAt.y, lookingAt.z);
                        let registry = block?.type?.getRegistryName();

                        isTargetCrop = Array.isArray(this.registry) ? this.registry.includes(registry) : registry === this.registry;
                    }

                    let targetYaw;

                    if (isTargetCrop) {
                        let currentBlockAngles = MathUtils.calculateAbsoluteAngles([lookingAt.x, lookingAt.y, lookingAt.z]);
                        targetYaw = currentBlockAngles.yaw;
                    } else {
                        let targetAngles = MathUtils.calculateAbsoluteAngles([this.targetX, this.targetY, this.targetZ]);
                        targetYaw = targetAngles.yaw;
                    }

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

                    Rotations.rotateToAngles(this.yaw, this.pitch, 0.1);
                    Rotations.onEndRotation(() => (this.state = this.STATES.DECIDEITEM));
                    break;
                case this.STATES.DECIDEITEM:
                    let looking = Player.lookingAt();

                    if (!looking) {
                        // rare case
                        this.message('&cYou are not looking at a crop!');
                        this.toggle(false);
                        return;
                    }

                    let block = World.getBlockAt(looking.x, looking.y, looking.z);
                    let registry = block?.type?.getRegistryName();

                    const cropTools = {
                        'minecraft:nether_wart': 'Nether Wart Hoe',
                        'minecraft:potatoes': 'Potato Hoe',
                        'minecraft:wheat': 'Wheat Hoe',
                        'minecraft:carrots': 'Carrot Hoe',
                        'minecraft:melon': 'Melon Dicer',
                        'minecraft:carved_pumpkin': 'Pumpkin Dicer',
                        // fungi
                        // dead rose or smth
                        // the other two
                    };

                    let requiredToolName = cropTools[registry];

                    if (!requiredToolName) {
                        this.message(`&cNo tool mapped for block: ${registry}`);
                        this.toggle(false);
                        break;
                    }

                    let targetSlot = Guis.findItemInHotbar(requiredToolName);

                    if (targetSlot !== -1) {
                        Guis.setItemSlot(targetSlot);
                        this.message(`Found ${requiredToolName} in slot ${targetSlot}`);
                        if (Player.getHeldItemIndex() === targetSlot) this.state = this.STATES.DECIDEMOVEMENT;
                    } else {
                        this.message(`&cRequired tool "${requiredToolName}" not found in hotbar!`);
                        this.toggle(false);
                    }

                    break;
                case this.STATES.DECIDEMOVEMENT:
                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        Keybind.setKey('leftclick', true);
                        let scan = this.scanSides();

                        let maxDistLeft = 0;
                        let maxDistRight = 0;

                        scan.forEach((block) => {
                            let diff = block.offset;
                            let distance = Math.abs(diff);

                            if (block.name && !block.name.includes('air') && !block.name.includes('water')) {
                                if (diff < 0) {
                                    if (distance > maxDistLeft) maxDistLeft = distance;
                                } else if (diff > 0) {
                                    if (distance > maxDistRight) maxDistRight = distance;
                                }
                            }
                        });

                        if (maxDistRight > maxDistLeft) {
                            this.message(`Wall detected on RIGHT. Moving LEFT to avoid!`);
                            this.movementKey = 'a';
                            this.ignoreKeys = ['d', 's'];
                        } else if (maxDistLeft > maxDistRight) {
                            this.message(`Wall detected on LEFT. Moving RIGHT to avoid!`);
                            this.movementKey = 'd';
                            this.ignoreKeys = ['a', 's'];
                        } else {
                            // check the crop metadata here then smh
                        }

                        this.state = this.STATES.IDLECHECKS;
                    }
                    break;
                case this.STATES.IDLECHECKS:
                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        Keybind.setKey('leftclick', true);
                        Keybind.setKey(this.movementKey, true);
                        this.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                        let isOnGround = Player.asPlayerMP().isOnGround();

                        if (!isOnGround) {
                            ChatLib.chat('&cNot on ground!');
                            Keybind.stopMovement();
                            this.inAir = true;
                        }

                        if (this.inAir && isOnGround) {
                            this.message('&aLanded! Recalculating movement...');

                            this.inAir = false;
                            this.state = this.STATES.DECIDEMOVEMENT;
                        }
                    }
                    break;
            }
        });
    }

    scan3x3x3() {
        const playerBlockX = Math.floor(Player.getPlayer().getX());
        const playerBlockY = Math.round(Player.getPlayer().getY());
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

    scanSides() {
        const playerBlockX = Math.floor(Player.getPlayer().getX());
        const playerBlockY = Math.round(Player.getPlayer().getY());
        const playerBlockZ = Math.floor(Player.getPlayer().getZ());

        let yaw = ((Player.getYaw() % 360) + 360) % 360;

        const scanResults = [];
        const range = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

        let dx = 0;
        let dz = 0;

        if (yaw >= 315 || yaw < 45) {
            // Facing South (+Z)
            dx = -1; // Right is West (-X)
        } else if (yaw >= 45 && yaw < 135) {
            // Facing West (-X)
            dz = -1; // Right is North (-Z)
        } else if (yaw >= 135 && yaw < 225) {
            // Facing North (-Z)
            dx = 1; // Right is East (+X)
        } else if (yaw >= 225 && yaw < 315) {
            // Facing East (+X)
            dz = 1; // Right is South (+Z)
        }

        for (const offset of range) {
            let scanX = playerBlockX + dx * offset;
            let scanZ = playerBlockZ + dz * offset;

            const block = World.getBlockAt(scanX, playerBlockY, scanZ);

            scanResults.push({
                x: scanX,
                y: playerBlockY,
                z: scanZ,
                name: block?.type?.getRegistryName(),
                offset: offset, // Positive = Right of player, Negative = Left of player
            });
        }

        return scanResults;
    }

    message(msg) {
        Chat.message('&#33ba11Farming Macro: &f' + msg);
    }

    onEnable() {
        global.macrostate.setMacroRunning(true, 'FARMING');
        Mouse.ungrab();
        this.message('&aEnabled');
        this.state = this.STATES.SCANFORCROP;
    }

    onDisable() {
        global.macrostate.setMacroRunning(false, 'FARMING');
        Mouse.regrab();
        Rotations.stopRotation();
        this.movementKey = null;
        this.ignoreKey = null;
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.farmAxis = null;
    }
}

new FarmingMacro();
