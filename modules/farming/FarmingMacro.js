import { Chat } from '../../utils/Chat';
import { BP, Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { Mixin } from '../../utils/MixinManager';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import Render from '../../utils/render/Render';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';

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

// todo : rewarp

class FarmingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Farming Macro',
            subcategory: 'Farming',
            description: 'Automates farming for various crops.',
            tooltip: 'WIP farming macro',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
            isMacro: true,
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

        // universal
        this.farmAxis = null;
        this.movementKey = null;
        this.ignoreKey = null;
        this.deciding = false;
        this.warping = false;

        // vertical crops
        this.inAir = false;

        // pumpking / melon
        this.offWall = false;

        this.points = Utils.getConfigFile('FarmingMacro/points.txt') || {};

        this.bindToggleKey();

        this.DEBUG = false;
        this.HIDEPARTICLES = false;

        this.addMultiToggle(
            'Crop',
            FARMING_DATA.map((data) => data.name),
            true,
            (v) => {
                this.CROPS = v;
            },
            'Type of crop to farm',
            'Vertical NetherWart / Potato / Wheat / Carrot'
        );

        this.addToggle(
            'Hide Crop Particles',
            (v) => {
                this.HIDEPARTICLES = v;
                Mixin.set('hideParticles', v);
            },
            'Prevents crop particles from being shown when you break a crop',
            false
        );

        this.addToggle(
            'Debug Messages (Highly recommended)',
            (v) => {
                this.DEBUG = v;
            },
            'Various debug messages to help with debugging',
            false
        );

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
                y: Math.floor(Player.getY()),
                z: Math.floor(Player.getZ()),
            };

            Utils.writeConfigFile('FarmingMacro/points.txt', this.points);
            this.message('&aEnd point saved!');
        });

        this.when(
            () => Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                let sideBlocks = this.scanSides();
                sideBlocks.forEach((block) => {
                    let isWall = block.name && !block.name.includes('air') && !block.name.includes('water');

                    // Color logic: Green for walls, Red for air/passable
                    let fillColor = isWall ? Render.Color(0, 255, 0, 80) : Render.Color(255, 0, 0, 50);
                    let outlineColor = isWall ? Render.Color(0, 255, 0, 200) : Render.Color(255, 0, 0, 150);

                    Render.drawStyledBox(
                        new Vec3d(block.x, block.y, block.z),
                        fillColor,
                        outlineColor,
                        2, // Thinner line for side blocks
                        false
                    );
                });
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

        this.on('tick', () => {
            if (Utils.area() !== 'Garden') {
                this.message('&cYou are not on the Garden!');
                this.toggle(false);
                return;
            }

            switch (this.state) {
                case this.STATES.SCANFORCROP:
                    if (!this.points.start || !this.points.end) {
                        this.message('&cYou need to set both start and end points!');
                        this.message('&c/setstart and /setend');
                        this.toggle(false);
                        return;
                    }

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

                    if (targetBlocks.length > 0 && !this.warping) {
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

                        if (Player.isFlying()) {
                            Keybind.setKey('shift', true);
                        } else {
                            Keybind.setKey('shift', false);
                            this.state = this.STATES.DECIDEROTATION;
                        }
                    } else if (!this.warping) {
                        if (
                            this.isAtPoint(this.points.start.x, this.points.start.y, this.points.start.z) &&
                            this.areChunksLoaded(this.points.start.x, this.points.start.z)
                        ) {
                            this.message('&cAt start point but no crops found!');
                            this.toggle(false);
                        } else {
                            this.message('&cNot near your selected crop! Warping...');
                            ChatLib.command('warp garden');
                            this.warping = true;
                        }
                    } else if (this.warping && this.isAtPoint(this.points.start.x, this.points.start.y, this.points.start.z)) this.warping = false;
                    break;
                case this.STATES.DECIDEROTATION:
                    const isCrop = (reg) => (Array.isArray(this.registry) ? this.registry.includes(reg) : reg === this.registry);

                    let targetYaw;

                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        const blockAhead = this.getBlockInFront(1, 1);
                        const aheadRegistry = blockAhead?.name;

                        if (isCrop(aheadRegistry)) {
                            this.message('&7Targetting crop by getting the block ahead!', true);
                            targetYaw = this.getAngle(blockAhead);
                        } else {
                            const lookingAt = Player.lookingAt();
                            const lookReg = lookingAt ? this.getRegistry(lookingAt) : null;

                            if (lookingAt && isCrop(lookReg)) {
                                this.message('&7Targetting crop by looking at!', true);
                                targetYaw = this.getAngle(lookingAt);
                            } else {
                                this.message('&7Targetting crop by fallback!', true);

                                let target = {
                                    x: this.targetX,
                                    y: this.targetY,
                                    z: this.targetZ,
                                };

                                targetYaw = this.getAngle(target);
                            }
                        }
                    }

                    if (this.name === "MelonKingDe's Melon / Pumpkin") {
                        let target = {
                            x: this.targetX,
                            y: this.targetY,
                            z: this.targetZ,
                        };

                        targetYaw = this.getAngle(target);
                    }

                    targetYaw = ((((targetYaw + 180) % 360) + 360) % 360) - 180;

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
                    let registry = null;
                    let requiredToolName = null;

                    let block = null;

                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        block = this.getBlockInFront(1, 1);
                        registry = block?.name;

                        if (!registry) {
                            let looking = Player.lookingAt();
                            if (!looking) {
                                Chat.message('Errored big');
                                this.toggle(false);
                                return;
                            }
                            registry = World.getBlockAt(looking.x, looking.y, looking.z)?.type?.getRegistryName();
                        }

                        const cropTools = {
                            'minecraft:nether_wart': 'Nether Wart Hoe',
                            'minecraft:potatoes': 'Potato Hoe',
                            'minecraft:wheat': 'Wheat Hoe',
                            'minecraft:carrots': 'Carrot Hoe',
                        };

                        requiredToolName = cropTools[registry];

                        if (!requiredToolName) {
                            this.message(`&cNo tool mapped for block: ${registry}`);
                            this.toggle(false);
                            break;
                        }
                    }

                    if (this.name === "MelonKingDe's Melon / Pumpkin") {
                        block = this.getBlockInFront(2, 1);
                        registry = block?.name;

                        let sides = Utils.sidesOfCollision();

                        if (!sides.front) return Keybind.setKey('w', true);

                        if (sides.front) {
                            let lookingAt = Player.lookingAt();
                            if (!registry.includes('stem')) {
                                Chat.message('got from looking');

                                // i mean this isnt really needed ?
                                registry = this.getRegistry(lookingAt);
                            } else Chat.message('got with func');

                            const cropTools = {
                                'minecraft:melon': 'Melon Dicer',
                                'minecraft:melon_stem': 'Melon Dicer',

                                'minecraft:carved_pumpkin': 'Pumpkin Dicer',
                                'minecraft:pumpkin_stem': 'Pumpkin Dicer',
                            };

                            requiredToolName = cropTools[registry];

                            if (!requiredToolName) {
                                this.message(`&cMake sure you are looking at a melon or pumpkin!`);
                                this.toggle(false);
                                break;
                            }
                        }

                        this.checkSidesFirst = true;
                    }

                    let targetSlot = Guis.findItemInHotbar(requiredToolName);

                    if (targetSlot !== -1) {
                        Guis.setItemSlot(targetSlot);
                        if (Player.getHeldItemIndex() === targetSlot) this.state = this.STATES.DECIDEMOVEMENT;
                    } else {
                        this.message(`&cMissing "${requiredToolName}"!`);
                        this.toggle(false);
                    }

                    break;
                case this.STATES.DECIDEMOVEMENT:
                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        Keybind.setKey('leftclick', true);

                        let blockData = this.getBlockInFront(1, 0);
                        let distCheck = MathUtils.getDistanceToPlayer(blockData.x, blockData.y, blockData.z);
                        let distance = distCheck.distanceFlat;

                        if (distance > 1) {
                            Keybind.setKey('w', true);
                            return;
                        } else Keybind.setKey('w', false);

                        this.decideDirection(true);
                        if (this.movementKey === null) return;

                        this.state = this.STATES.IDLECHECKS;
                    }

                    if (this.name === "MelonKingDe's Melon / Pumpkin") {
                        this.decideDirection(false);
                        if (this.movementKey === null) return;

                        this.state = this.STATES.IDLECHECKS; // Move to the actual farming state
                    }
                    break;
                case this.STATES.IDLECHECKS:
                    if (this.isAtPoint(this.points.end.x, this.points.end.y, this.points.end.z, 1)) {
                        this.message('&aReached end of farm! rewarping.');
                        Keybind.unpressKeys();
                        Keybind.setKey('leftclick', false);
                        this.state = this.STATES.REWARP;
                        return;
                    }

                    if (this.name === 'Vertical NetherWart / Potato / Wheat / Carrot') {
                        Keybind.setKey('leftclick', true);
                        Keybind.setKey(this.movementKey, true);
                        this.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                        let isOnGround = Player.asPlayerMP().isOnGround();
                        if (!isOnGround) {
                            Keybind.stopMovement();
                            this.inAir = true;
                        }

                        if (this.inAir && isOnGround) {
                            this.inAir = false;
                            this.state = this.STATES.DECIDEMOVEMENT;
                        }
                    }

                    if (this.name === "MelonKingDe's Melon / Pumpkin") {
                        Chat.message(this.movementKey);
                        Keybind.setKey('w', true);
                        Keybind.setKey('leftclick', true);
                        Keybind.setKey(this.movementKey, true);
                        //this.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                        let sides = Utils.sidesOfCollision();

                        if (!sides.front) {
                            this.offWall = true;
                            Keybind.stopMovement();
                            Keybind.setKey('w', true);
                        }

                        if (this.offWall && sides.front) {
                            this.offWall = false;
                            Keybind.stopMovement();
                            this.state = this.STATES.DECIDEMOVEMENT;
                        }
                    }
                    break;
                case this.STATES.REWARP:
                    if (!this.warpDelay) {
                        const randomDelay = Math.floor(Math.random() * (750 - 500 + 1)) + 500;
                        this.warpDelay = Date.now() + randomDelay;
                        this.message(`&7Warping in ${randomDelay}ms...`, true);
                        return;
                    }

                    if (Date.now() >= this.warpDelay) {
                        ChatLib.command('warp garden');
                    }

                    if (this.isAtPoint(this.points.start.x, this.points.start.y, this.points.start.z, 1)) {
                        if (this.areChunksLoaded(this.points.start.x, this.points.start.z)) {
                            this.warpDelay = null;
                            this.state = this.STATES.SCANFORCROP;
                        } else {
                            this.message('Waiting for chunks to load', true);
                        }
                    }

                    break;
            }
        });
    }

    decideDirection(actualAge, yOffset = 1) {
        const { maxDistLeft, maxDistRight } = this.getSidesDistance();

        if (maxDistRight > maxDistLeft) {
            this.message(`&7Wall RIGHT moving LEFT!`, true);
            this.movementKey = 'a';
            this.ignoreKeys = ['d', 's'];
        } else if (maxDistLeft > maxDistRight) {
            this.message(`&7Wall LEFT moving RIGHT!`, true);
            this.movementKey = 'd';
            this.ignoreKeys = ['a', 's'];
        } else {
            let corners = this.checkForCrop(actualAge, yOffset);

            let leftAge = actualAge ? corners.left.age : corners.left.exists;
            let rightAge = actualAge ? corners.right.age : corners.right.exists;

            if (leftAge > rightAge) {
                this.message(`&7Older crop LEFT, moving LEFT!`, true);
                this.movementKey = 'a';
                this.ignoreKeys = ['d', 's'];
            } else if (rightAge > leftAge) {
                this.message(`&7Older crop RIGHT, moving RIGHT!`, true);
                this.movementKey = 'd';
                this.ignoreKeys = ['a', 's'];
            } else if (leftAge === rightAge) {
                if (!this.deciding) this.message(`Macro can't decide which way to move, press A or D to proceed!`);
                this.deciding = true;

                let aDown = Client.getMinecraft().options.leftKey.isPressed();
                let dDown = Client.getMinecraft().options.rightKey.isPressed();

                if (aDown) {
                    this.movementKey = 'a';
                    this.ignoreKeys = ['d', 's'];
                    this.message(`Direction set to LEFT!`, true);
                } else if (dDown) {
                    this.movementKey = 'd';
                    this.ignoreKeys = ['a', 's'];
                    this.message(`Direction set to RIGHT!`, true);
                }
            }
        }
    }

    getSidesDistance() {
        let sides = this.scanSides();

        let maxDistLeft = 0;
        let maxDistRight = 0;

        sides.forEach((block) => {
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

        return { maxDistLeft, maxDistRight };
    }

    /**
     * Scans a 3x3x3 area around the player.
     * @returns {Array} An array of objects containing block information.
     */
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

    /**
     * UNIVERSAL FUNCTION
     * Scans the sides of the player for 20 blocks eachside in the direction the player is facing.
     * @returns {Array} An array of objects containing block information.
     */
    scanSides() {
        const player = Player.getPlayer();
        const playerBlockX = Math.floor(player.getX());
        const playerBlockY = Math.round(player.getY());
        const playerBlockZ = Math.floor(player.getZ());

        let yaw = ((player.getYaw() % 360) + 360) % 360;

        const scanResults = [];
        const range = [];
        for (let i = -5; i <= 5; i++) {
            if (i === 0) continue;
            range.push(i);
        }

        let dx = 0;
        let dz = 0;

        if (yaw >= 315 || yaw < 45) {
            // SOUTH (+Z): Right is West (-X)
            dx = -1;
        } else if (yaw >= 45 && yaw < 135) {
            // WEST (-X): Right is North (-Z)
            dz = -1;
        } else if (yaw >= 135 && yaw < 225) {
            // NORTH (-Z): Right is East (+X)
            dx = 1;
        } else if (yaw >= 225 && yaw < 315) {
            // EAST (+X): Right is South (+Z)
            dz = 1;
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
                offset: offset, // Positive = Right, Negative = Left
            });
        }

        return scanResults;
    }

    /**
     * UNIVERSAL FUNCTION
     * Gets the block in front of the player.
     * @param {*} offsetDist The distance to offset the block in front of the player.
     * @param {*} yOffset The y offset of the block.
     * @returns The block in front of the player.
     */
    getBlockInFront(offsetDist = 1, yOffset = 0) {
        const player = Player.getPlayer();

        let yaw = ((player.getYaw() % 360) + 360) % 360;

        let dx = 0;
        let dz = 0;

        if (yaw >= 315 || yaw < 45) {
            // SOUTH
            dz = 1;
        } else if (yaw >= 45 && yaw < 135) {
            // WEST
            dx = -1;
        } else if (yaw >= 135 && yaw < 225) {
            // NORTH
            dz = -1;
        } else if (yaw >= 225 && yaw < 315) {
            // EAST
            dx = 1;
        }

        const targetX = Math.floor(player.getX() + dx * offsetDist);
        const targetY = Math.round(player.getY() + yOffset);
        const targetZ = Math.floor(player.getZ() + dz * offsetDist);

        const block = World.getBlockAt(targetX, targetY, targetZ);

        if (!block) return null;

        return {
            x: targetX + 0.5,
            y: targetY,
            z: targetZ + 0.5,
            name: block.type.getRegistryName(),
            id: block.type.getID(),
        };
    }

    /**
     * Checks the front corners (left and right) of the player based on Yaw.
     * @param {number} yOffset - The y offset of the block relative to player feet.
     * @param {boolean} checkForAge - If true, returns age. If false, returns 1 for valid, 0 for air/water/dirt.
     * @returns {object} Object containing left and right block data.
     */
    checkForCrop(checkForAge = true, yOffset = 1) {
        const p = Player.getPlayer();

        // Standardize Yaw to 0-360 (matching getBlockInFront logic)
        let yaw = ((p.getYaw() % 360) + 360) % 360;

        let fx = 0,
            fz = 0; // Forward vectors
        let sx = 0,
            sz = 0; // Side vectors (Right)

        // Determine direction vectors based on Yaw
        if (yaw >= 315 || yaw < 45) {
            // SOUTH (+Z) -> Right is -X
            fx = 0;
            fz = 1;
            sx = -1;
            sz = 0;
        } else if (yaw >= 45 && yaw < 135) {
            // WEST (-X) -> Right is -Z
            fx = -1;
            fz = 0;
            sx = 0;
            sz = -1;
        } else if (yaw >= 135 && yaw < 225) {
            // NORTH (-Z) -> Right is +X
            fx = 0;
            fz = -1;
            sx = 1;
            sz = 0;
        } else if (yaw >= 225 && yaw < 315) {
            // EAST (+X) -> Right is +Z
            fx = 1;
            fz = 0;
            sx = 0;
            sz = 1;
        }

        const getInfo = (offX, offZ) => {
            const targetX = Math.floor(p.getX() + offX);
            const targetY = Math.round(p.getY()) + yOffset;
            const targetZ = Math.floor(p.getZ() + offZ);

            const pos = new BP(targetX, targetY, targetZ);
            const state = World.getWorld().getBlockState(pos);
            const block = state.getBlock();

            const CTBlock = World.getBlockAt(targetX, targetY, targetZ);

            if (checkForAge) {
                const ageProp = block.getStateManager().getProperty('age');
                return { age: ageProp ? state.get(ageProp) : -1 };
            }

            const blockName = CTBlock?.type?.getRegistryName();
            const isInvalid = blockName.includes('air') || blockName.includes('water') || blockName.includes('dirt');

            return { exists: isInvalid ? 0 : 1 };
        };

        // Calculate Right: (Forward + Side)
        // Calculate Left:  (Forward - Side)
        const right = getInfo(fx + sx, fz + sz);
        const left = getInfo(fx - sx, fz - sz);

        return { left, right };
    }

    isAtPoint(x, y, z, minDist = 1) {
        let check = MathUtils.getDistanceToPlayer(x, y, z).distance;
        if (check < minDist) return true;
        return false;
    }

    areChunksLoaded(x, z) {
        const chunkX = Math.floor(x) >> 4;
        const chunkZ = Math.floor(z) >> 4;
        return World.getWorld().getChunkManager().isChunkLoaded(chunkX, chunkZ);
    }

    getAngle(point) {
        return MathUtils.calculateAbsoluteAngles([point.x, point.y, point.z]).yaw;
    }

    getRegistry(point) {
        if (!point) return null;
        return World.getBlockAt(point.x, point.y, point.z)?.type?.getRegistryName();
    }

    message(msg, debug = false) {
        let prefix = 'Farming Macro:';
        if (this.DEBUG && debug) prefix = 'Farming Macro: &c[DEBUG]';
        Chat.message(`&#33ba11${prefix}&f ${msg}`);
    }

    onEnable() {
        Mouse.ungrab();
        this.message('&aEnabled');
        this.state = this.STATES.SCANFORCROP;
    }

    onDisable() {
        Mouse.regrab();
        Rotations.stopRotation();
        Keybind.setKey('leftclick', false);
        this.movementKey = null;
        this.deciding = false;
        this.warping = false;
        this.ignoreKey = null;
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.farmAxis = null;
    }
}

new FarmingMacro();
