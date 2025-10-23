import { Keybind } from '../../Utility/Keybinding';
import { MiningUtils } from '../../Utility/MiningUtils';
import { RayTrace } from '../../Utility/Raytrace';
import { Rotations } from '../../Utility/Rotations';
import { Utils } from '../../Utility/Utils';
import { Color } from '../../Utility/Constants';
import { MathUtils } from '../../Utility/Math';
import { Chat } from '../../Utility/Chat';
import { registerEventSB } from '../../Utility/SkyblockEvents';
import { Guis } from '../../Utility/Inventory';
import { NukerUtils } from '../../Utility/NukerUtils';
import RenderUtils from '../../Rendering/RendererUtils';
import { ModuleBase } from '../../Utility/ModuleBase';
const { addCategoryItem, addToggle, addMultiToggle } = global.Categories;

const Vec3d = net.minecraft.util.math.Vec3d;

class Bot extends ModuleBase {
    constructor() {
        super({
            name: 'Mining Bot',
            subcategory: 'Mining',
            description: 'Universal settings for Mining & block miner',
            tooltip: 'Automatically mines.',
            showEnabledToggle: false,
        });
        this.bindToggleKey();
        this.foundLocations = [];
        this.lowestCostBlockIndex = 0;

        this.PRIORITIZE_TITANIUM = true;
        this.TICKGLIDE = true;
        this.FAKELOOK = false;
        this.MOVEMENT = false;

        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 5,
            'minecraft:light_blue_wool': 3,
            'minecraft:prismarine': 5,
            'minecraft:prismarine_bricks': 5,
            'minecraft:dark_prismarine': 5,
            'minecraft:gray_wool': 7,
            'minecraft:cyan_terracotta': 7,
        };

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

        this.oreCosts = {
            'minecraft:coal_block': 4,
            'minecraft:quartz_block': 4,
            'minecraft:iron_block': 4,
            'minecraft:redstone_block': 4,
            'minecraft:gold_block': 4,
            'minecraft:diamond_block': 4,
            'minecraft:emerald_block': 4,
        };

        this.TYPE = null;
        this.COSTTYPE = null;

        this.STATES = {
            WAITING: 0,
            ABILITY: 1,
            MINING: 2,
            BUFF: 3,
            REFUEL: 4,
        };
        this.state = this.STATES.WAITING;

        this.TYPES = {
            MININGBOT: 0,
            COMMISSION: 1,
            GEMSTONE: 2,
            ORE: 3,
            TUNNEL: 4,
        };
        this.type = this.TYPES.MININGBOT;

        this.miningspeed = 0;
        this.currentTarget = null;
        this.tickCount = 0;
        this.lastBlockPos = null;
        this.allowScan = false;
        this.totalTicks = 0;
        this.miningbot = null;
        this.ability = null;
        this.file = null;
        this.abilityClicked = false;
        this.speedBoost = false;
        this.empty = false;
        this.nuking = false;

        this.exploit = register('packetSent', (packet, event) => {
            let packetAction = packet?.getAction()?.toString();

            if (packetAction === 'ABORT_DESTROY_BLOCK') cancel(event);
        })
            .setFilteredClass(
                net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
            )
            .unregister();

        this.debug = register('postRenderWorld', () => {
            if (this.foundLocations.length > 0) {
                let sortedLocations = this.foundLocations;

                let numLocations = sortedLocations.length;
                for (let i = 0; i < numLocations; i++) {
                    let location = sortedLocations[i];

                    if (i === 0) {
                        RenderUtils.drawWireFrame(
                            new Vec3d(location.x, location.y, location.z),
                            [255, 255, 255, 255]
                        );
                        continue;
                    }

                    const t = numLocations > 1 ? i / (numLocations - 1) : 0;
                    const r = t;
                    const g = 1 - t;
                    const b = 0;
                    const color = new Color(r, g, b, 1);

                    RenderUtils.drawWireFrame(
                        new Vec3d(location.x, location.y, location.z),
                        [r * 255, g * 255, b * 255, 255]
                    );
                }
            }
        }).unregister();

        this.on('tick', () => {
            if (Client.isInChat() || Client.isInGui()) return;

            let drillfunc = MiningUtils.getDrills();
            let drill = drillfunc.drill;
            let blueCheese = drillfunc.blueCheese;

            let Type = this.TYPE.find((option) => option.enabled)?.name;

            if (Type) {
                let costPropertyName = Type.toLowerCase() + 'Costs';
                this.COSTTYPE = this[costPropertyName];
            }

            switch (this.state) {
                case this.STATES.ABILITY:
                    Guis.setItemSlot(drill.slot);
                    Keybind.setKey('leftclick', false);

                    if (!this.file) {
                        this.file = Utils.getConfigFile('miningstats.json');
                        this.ability = this.file.ability;
                    }

                    if (!this.ability) {
                        Chat.message(
                            '&cFailed to get Pickaxe Ability! Run /getminingstats'
                        );
                        this.toggle(false);
                        return;
                    }

                    // pickobulus will be done soon
                    if (
                        this.ability !== 'Pickobulus' &&
                        Player.getHeldItemIndex() === drill.slot
                    ) {
                        if (!this.abilityClicked) {
                            Client.scheduleTask(3, () => {
                                Keybind.rightClick();
                                this.scanForBlock(this.COSTTYPE);
                                this.state = this.STATES.MINING;
                                this.abilityClicked = false;
                            });
                            this.abilityClicked = true;
                        }
                    }
                    break;
                case this.STATES.MINING:
                    Guis.setItemSlot(drill.slot);

                    if (this.empty) {
                        Chat.message('No more mineable blocks.');
                        this.toggle(false);
                    }

                    // todo fix this gets called 20 times per second which is intensive due to file read and stuff
                    this.miningspeed =
                        this.type === this.TYPES.TUNNEL
                            ? MiningUtils.getSpeedWithCold()
                            : MiningUtils.getMiningSpeed();

                    let lowestCostBlock =
                        this.foundLocations[this.lowestCostBlockIndex];

                    if (!lowestCostBlock) return;
                    let block = World.getBlockAt(
                        lowestCostBlock.x,
                        lowestCostBlock.y,
                        lowestCostBlock.z
                    );

                    let blockName = block?.type?.getRegistryName();

                    if (
                        !this.lastBlockPos ||
                        this.lastBlockPos.x !== lowestCostBlock.x ||
                        this.lastBlockPos.y !== lowestCostBlock.y ||
                        this.lastBlockPos.z !== lowestCostBlock.z
                    ) {
                        this.tickCount = 0;
                        this.lastBlockPos = lowestCostBlock;
                    }

                    this.currentTarget =
                        this.foundLocations[this.lowestCostBlockIndex];

                    let lookingAt = Player.lookingAt();
                    if (
                        lookingAt &&
                        lookingAt?.getX() === this.currentTarget?.x &&
                        lookingAt?.getY() === this.currentTarget?.y &&
                        lookingAt?.getZ() === this.currentTarget?.z
                    ) {
                        this.tickCount++;
                    }

                    this.totalTicks = MiningUtils.getMineTime(
                        this.miningspeed,
                        this.speedBoost,
                        this.currentTarget
                    );

                    Keybind.setKey('leftclick', true);

                    let blockDist = MathUtils.getDistanceToPlayerEyes(
                        this.currentTarget.x,
                        this.currentTarget.y,
                        this.currentTarget.z
                    ).distance;

                    switch (this.COSTTYPE) {
                        case this.gemstoneCosts:
                            if (blockDist < 1) Keybind.setKey('s', true);
                            else if (blockDist > 4.5) Keybind.setKey('w', true);
                            else Keybind.stopMovement();

                            break;
                    }

                    let Fakelook = this.FAKELOOK.find(
                        (option) => option.enabled
                    )?.name;

                    if (Fakelook !== 'Off') {
                        if (
                            blockName.includes('air') ||
                            blockName.includes('bedrock')
                        ) {
                            this.lowestCostBlockIndex++;
                        }

                        if (Fakelook === 'Instant') {
                            if (!this.currentTarget) return;
                            if (!this.nuking) {
                                NukerUtils.nuke(
                                    [
                                        this.currentTarget.x,
                                        this.currentTarget.y,
                                        this.currentTarget.z,
                                    ],
                                    this.totalTicks
                                );
                                this.nuking = true;
                            }
                        } else if (Fakelook === 'Queued') {
                            if (!this.currentTarget) return;
                            if (!this.nuking) {
                                NukerUtils.nukeQueueAdd(
                                    [
                                        this.currentTarget.x,
                                        this.currentTarget.y,
                                        this.currentTarget.z,
                                    ],
                                    this.totalTicks
                                );
                                this.nuking = true;
                            }
                        }
                    }

                    if (this.TICKGLIDE) {
                        let targetVector = [
                            this.currentTarget.x + 0.5,
                            this.currentTarget.y + 0.5,
                            this.currentTarget.z + 0.5,
                        ];

                        if (this.currentTarget)
                            Rotations.rotateTo(targetVector);

                        if (
                            this.tickCount > this.totalTicks ||
                            this.allowScan
                        ) {
                            this.tickCount = 0;
                            this.allowScan = false;
                            this.scanForBlock(
                                this.COSTTYPE,
                                true,
                                null,
                                this.currentTarget
                            );
                        }
                    } else if (!this.TICKGLIDE) {
                        this.currentTarget = lowestCostBlock;
                        let targetVector = [
                            this.currentTarget.x + 0.5,
                            this.currentTarget.y + 0.5,
                            this.currentTarget.z + 0.5,
                        ];

                        if (
                            blockName.includes('air') ||
                            blockName.includes('bedrock') ||
                            this.allowScan
                        ) {
                            this.scanForBlock(this.COSTTYPE, true, {
                                x: this.currentTarget.x,
                                y: this.currentTarget.y,
                                z: this.currentTarget.z,
                            });
                            this.lowestCostBlockIndex = 0;
                            this.allowScan = false;
                        }

                        if (this.currentTarget)
                            Rotations.rotateTo(targetVector);
                    }
                    break;
            }
        });

        registerEventSB('abilityready', () => {
            this.state = this.STATES.ABILITY;
        });

        registerEventSB('abilityused', () => {
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
        });

        registerEventSB('abilitygone', () => (this.speedBoost = false));

        addToggle(
            'Modules',
            'Mining Bot',
            'Tick Gliding',
            (value) => {
                this.TICKGLIDE = value;
            },
            'Predicts when blocks are broken to begin mining the next block early.'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Jasper Drill Exploit',
            (value) => {
                value ? this.exploit.register() : this.exploit.unregister();
            },
            'Left click a gemstone with a Gemstone Drill to activate exploit. (Permanent +800 Mining speed)'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Prioritze Titanium',
            (value) => {
                this.PRIORITIZE_TITANIUM = value;
            },
            'Whenever Titanium is in range it will be targeted the most'
        );
        addMultiToggle(
            'Modules',
            'Mining Bot',
            'Fakelook',
            ['Off', 'Instant', 'Queued'],
            true,
            (value) => {
                this.FAKELOOK = value;
            },
            'Fakelook begins to mine blocks before the player looks at them.'
        );
        addMultiToggle(
            'Modules',
            'Mining Bot',
            'Types',
            ['Mithril', 'Gemstone', 'Ore'],
            true,
            (value) => {
                this.TYPE = value;
            },
            'Targets specified block type.'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Debug Mode',
            (value) => {
                value ? this.debug.register() : this.debug.unregister();
            },
            'Debugging - not recommended for average use.'
        );
    }

    scanForBlock(
        target,
        specific = true,
        startPos = null,
        excludedBlock = null
    ) {
        const playerX = Player.getX();
        const playerY = Player.getY();
        const playerZ = Player.getZ();
        const playerEyePos = Player.getPlayer().getEyePos();
        const viewVector = Player.asPlayerMP().getLookVector();

        this.tickCount = 0;

        const start = startPos || {
            x: Math.floor(playerX),
            y: Math.floor(playerY),
            z: Math.floor(playerZ),
        };

        const excluded = excludedBlock || null;

        const maxReach = 5;
        const maxReachSq = maxReach * maxReach;

        const foundLocations = [];

        const queue = [{ x: start.x, y: start.y, z: start.z }];
        let head = 0;

        const visited = new Set();
        visited.add(`${start.x},${start.y},${start.z}`);

        const directions = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];

        while (head < queue.length) {
            const { x, y, z } = queue[head++];

            if (
                excluded &&
                x === excluded.x &&
                y === excluded.y &&
                z === excluded.z
            ) {
                continue;
            }

            // Reach check
            const distEye = MathUtils.getDistanceToPlayerEyes(x, y, z).distance;
            if (distEye > maxReach) continue;

            const block = World.getBlockAt(x, y, z);
            const blockName = block?.type?.getRegistryName();

            let isTargetBlock = false;
            if (blockName) {
                if (specific) {
                    isTargetBlock = Object.prototype.hasOwnProperty.call(
                        target,
                        blockName
                    );
                } else {
                    isTargetBlock = blockName in target;
                }
            }

            if (isTargetBlock) {
                const blockPos = new BlockPos(x, y, z);

                const startPoint = [
                    playerEyePos.x,
                    playerEyePos.y,
                    playerEyePos.z,
                ];
                const endPoint = [x + 0.5, y + 0.5, z + 0.5];

                // line of sight by ray tracing from eyes check
                const traversedBlocks = RayTrace.rayTraceBetweenPoints(
                    startPoint,
                    endPoint
                );
                let isObstructed = false;
                if (traversedBlocks) {
                    for (let i = 0; i < traversedBlocks.length; i++) {
                        const [bx, by, bz] = traversedBlocks[i];
                        const currentBlockPos = new BlockPos(bx, by, bz);
                        if (!currentBlockPos.equals(blockPos)) {
                            const obBlock = World.getBlockAt(
                                currentBlockPos.getX(),
                                currentBlockPos.getY(),
                                currentBlockPos.getZ()
                            );
                            if (obBlock && obBlock.type.getID() !== 0) {
                                isObstructed = true;
                                break;
                            }
                        }
                    }
                }

                if (!isObstructed) {
                    const dx = x - playerX;
                    const dy = y - playerEyePos.y;
                    const dz = z - playerZ;
                    const dotProduct =
                        (dx * viewVector.x +
                            dy * viewVector.y +
                            dz * viewVector.z) /
                        (distEye || 1); // divide by zero fix

                    // Favor blocks in the center of view
                    const priorityAdjustment = -dotProduct * 50;
                    const totalCost =
                        target[blockName] + distEye * 5 + priorityAdjustment;

                    foundLocations.push({ x, y, z, cost: totalCost });
                }
            }

            for (let i = 0; i < directions.length; i++) {
                const [dx, dy, dz] = directions[i];
                const nextX = x + dx;
                const nextY = y + dy;
                const nextZ = z + dz;
                const nextKey = `${nextX},${nextY},${nextZ}`;

                if (!visited.has(nextKey)) {
                    const ddx = nextX - playerX;
                    const ddy = nextY - playerY;
                    const ddz = nextZ - playerZ;
                    const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
                    if (distSq <= maxReachSq) {
                        visited.add(nextKey);
                        queue.push({ x: nextX, y: nextY, z: nextZ });
                    }
                }
            }
        }

        // Sort by cost (ascending) and set the first as current target
        if (foundLocations.length > 0) {
            foundLocations.sort((a, b) => a.cost - b.cost);
            this.nuking = false;
            this.foundLocations = foundLocations;
            this.currentTarget = this.foundLocations[0];
            this.lowestCostBlockIndex = 0;
            this.empty = false;
        } else {
            this.empty = true;
        }
    }

    setCost(cost) {
        this.COSTTYPE = cost;
    }

    onEnable() {
        Chat.message('Mining Bot Enabled');
        this.empty = false;
        this.allowScan = true;
        this.state = this.STATES.ABILITY;
    }

    onDisable() {
        Chat.message('Mining Bot Disabled');
        this.state = this.STATES.WAITING;
        Keybind.setKey('leftclick', false);
        this.foundLocations = [];
        this.lastBlockPos = null;
        this.currentTarget = null;
        this.tickCount = 0;
        this.empty = false;
    }
}

export const MiningBot = new Bot();
