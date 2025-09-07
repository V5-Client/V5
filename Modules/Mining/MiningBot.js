/* eslint-disable no-unused-vars */
import { getSetting } from '../../GUI/GuiSave';
import RendererMain from '../../Rendering/RendererMain';
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
const { addCategoryItem, addToggle, addMultiToggle } = global.Categories;

const Vec3d = net.minecraft.util.math.Vec3d;

addCategoryItem(
    'Mining',
    'Mining Bot',
    'Universal settings for Mining & block miner'
);
addToggle('Modules', 'Mining Bot', 'Tick Gliding');
addToggle('Modules', 'Mining Bot', 'Jasper Drill Exploit');
addMultiToggle(
    'Modules',
    'Mining Bot',
    'Fakelook',
    ['Off', 'Instant', 'Queued'],
    true
);
addMultiToggle(
    'Modules',
    'Mining Bot',
    'Types',
    ['Mithril', 'Gemstone', 'Ore'],
    true
);

class MiningBot {
    constructor() {
        this.foundLocations = [];
        this.lastScanTime = 0;
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

        this.COSTTYPE = this.gemstoneCosts;

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

        this.enabled = false;
        this.miningspeed = 0;
        this.currentTarget = null;
        this.tickCount = 0;
        this.lastBlockPos = null;
        this.allowScan = false;
        this.scanning = false;
        this.totalTicks = 0;
        this.miningbot = null;
        this.ability = null;
        this.file = null;
        this.abilityClicked = false;
        this.speedBoost = false;
        this.empty = false;
        this.nuking = false;

        register('step', () => {
            this.TICKGLIDE = getSetting('Mining Bot', 'Tick Gliding');
            this.JASPEREXPLOIT = getSetting(
                'Mining Bot',
                'Jasper Drill Exploit'
            );
            this.FAKELOOK = getSetting('Mining Bot', 'Fakelook', [
                'Off',
                'Instant',
                'Queued',
            ]);

            if (this.JASPEREXPLOIT) this.exploit.register();
        }).setFps(1);

        register('command', () => {
            this.toggle();
        }).setName('startb');

        register('command', () => {
            miningbot.unregister();
            this.enabled = false;
            this.state = this.STATES.WAITING;
            Keybind.setKey('leftclick', false);
            this.foundLocations = [];
            this.lastBlockPos = null;
            this.currentTarget = null;
            this.tickCount = 0;
            ChatLib.chat('§c[Mining Bot] §7Disabled.');
        }).setName('stopb');

        this.exploit = register('packetSent', (packet, event) => {
            if (!this.JASPEREXPLOIT) this.exploit.unregister();
            let packetAction = packet.getAction().toString();

            if (packetAction === 'ABORT_DESTROY_BLOCK') cancel(event);
        }).setFilteredClass(
            net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
        );

        this.miningbot = register('tick', () => {
            if (!this.enabled) return;

            if (Client.isInChat() || Client.isInGui()) return;

            let drillfunc = MiningUtils.getDrills();
            let drill = drillfunc.drill;
            let blueCheese = drillfunc.blueCheese;

            switch (this.state) {
                case this.STATES.ABILITY:
                    Guis.setItemSlot(drill.slot);
                    Keybind.setKey('leftclick', false);

                    if (!this.file) {
                        file = Utils.getConfigFile('miningstats.json');
                        this.ability = file.ability;
                    }

                    if (!this.ability) {
                        Chat.message(
                            '&cFailed to get Pickaxe Ability! Run /getminingstats'
                        );
                        this.miningbot.unregister();
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
                        Chat.message('NOOOO');
                        this.state = this.STATES.WAITING;
                    }

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

                    if (this.FAKELOOK) {
                        if (this.FAKELOOK?.includes('Instant')) {
                            // im not sure if ive done this wrong or the way i coded mining bot prevents seeing change
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

                        if (this.currentTarget)
                            Rotations.rotateTo(targetVector);

                        if (
                            blockName.includes('air') ||
                            blockName.includes('bedrock') ||
                            this.allowScan
                        ) {
                            this.scanForBlock(
                                this.COSTTYPE,
                                true,
                                new BlockPos(
                                    this.currentTarget.x,
                                    this.currentTarget.y,
                                    this.currentTarget.z
                                )
                            );
                            this.lowestCostBlockIndex = 0;
                            this.allowScan = false;
                        }
                    }
                    break;
            }
        }).unregister();

        registerEventSB('abilityready', () => {
            this.state = this.STATES.ABILITY;
        });

        registerEventSB('abilityused', () => {
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
        });

        registerEventSB('abilitygone', () => (this.speedBoost = false));
    }

    scanForBlock(
        target,
        specific = true,
        startPos = null,
        excludedBlock = null
    ) {
        if (this.scanning) return;
        new Thread(() => {
            this.tickCount = 0;
            this.scanning = true;

            this.foundLocations = [];
            let startX, startY, startZ;

            if (startPos) {
                startX = startPos.getX();
                startY = startPos.getY();
                startZ = startPos.getZ();
            } else {
                startX = Math.floor(Player.getX());
                startY = Math.floor(Player.getY());
                startZ = Math.floor(Player.getZ());
            }

            let foundBlock = false;

            let playerX = Player.getX();
            let playerY = Player.getY();
            let playerZ = Player.getZ();
            let playerEyePos = Player.getPlayer().getEyePos();
            let viewVector = Player.asPlayerMP().getLookVector();

            let queue = [{ x: startX, y: startY, z: startZ }];
            let visited = new Set();
            visited.add(`${startX},${startY},${startZ}`);

            let directions = [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ];

            while (queue.length > 0) {
                let { x, y, z } = queue.shift();

                if (
                    excludedBlock &&
                    x === excludedBlock.x &&
                    y === excludedBlock.y &&
                    z === excludedBlock.z
                ) {
                    continue;
                }

                let dist = MathUtils.getDistanceToPlayerEyes(x, y, z).distance;
                if (dist > 5) continue;

                let block = World.getBlockAt(x, y, z);
                let blockName = block?.type?.getRegistryName();

                let isTargetBlock = false;
                if (specific) isTargetBlock = target.hasOwnProperty(blockName);
                else isTargetBlock = Object.keys(target).includes(blockName);

                if (isTargetBlock) {
                    let blockPos = new BlockPos(x, y, z);
                    let dist = Math.sqrt(
                        Math.pow(x - playerX, 2) +
                            Math.pow(y - playerY, 2) +
                            Math.pow(z - playerZ, 2)
                    );
                    let startPoint = [
                        playerEyePos.x,
                        playerEyePos.y,
                        playerEyePos.z,
                    ];

                    let endPoint = [x + 0.5, y + 0.5, z + 0.5];

                    let traversedBlocks = RayTrace.rayTraceBetweenPoints(
                        startPoint,
                        endPoint
                    );

                    let isObstructed = false;
                    if (traversedBlocks) {
                        for (let i = 0; i < traversedBlocks.length; i++) {
                            let blockCoords = traversedBlocks[i];
                            let currentBlockPos = new BlockPos(
                                blockCoords[0],
                                blockCoords[1],
                                blockCoords[2]
                            );
                            if (!currentBlockPos.equals(blockPos)) {
                                let block = World.getBlockAt(
                                    currentBlockPos.getX(),
                                    currentBlockPos.getY(),
                                    currentBlockPos.getZ()
                                );
                                if (block && block.type.getID() !== 0) {
                                    isObstructed = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!isObstructed) {
                        foundBlock = true;
                        let toBlockVector = new Vec3d(
                            x - Player.getX(),
                            y - playerEyePos.getY(),
                            z - Player.getZ()
                        ).normalize();

                        let dotProduct =
                            toBlockVector.x * viewVector.x +
                            toBlockVector.y * viewVector.y +
                            toBlockVector.z * viewVector.z;

                        let priorityAdjustment = -dotProduct * 50;
                        let totalCost =
                            target[blockName] + dist * 5 + priorityAdjustment;

                        this.foundLocations.push({
                            x: x,
                            y: y,
                            z: z,
                            cost: totalCost,
                        });
                    }
                }

                for (let i = 0; i < directions.length; i++) {
                    let [dx, dy, dz] = directions[i];
                    let nextX = x + dx;
                    let nextY = y + dy;
                    let nextZ = z + dz;
                    let nextKey = `${nextX},${nextY},${nextZ}`;
                    let dist = Math.sqrt(
                        Math.pow(nextX - playerX, 2) +
                            Math.pow(nextY - playerY, 2) +
                            Math.pow(nextZ - playerZ, 2)
                    );

                    if (dist <= 5 && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        queue.push({ x: nextX, y: nextY, z: nextZ });
                    }
                }
            }

            if (!foundBlock) {
                // ChatLib.chat('no found');
                this.empty = true;
            } else {
                this.nuking = false;
                this.foundLocations.sort((a, b) => a.cost - b.cost);
                this.currentTarget = this.foundLocations[0];
                this.lowestCostBlockIndex = 0;
                // ChatLib.chat('Scan complete.');
            }
            this.scanning = false;
        }).start();
    }

    toggle(forceAState = null) {
        if (forceAState !== null) this.enabled = forceAState;
        else this.enabled = !this.enabled;

        if (this.enabled) {
            this.miningbot.register();
            this.enabled = true;
            this.empty = false;
            this.allowScan = true;
            this.state = this.STATES.ABILITY;
        }

        if (!this.enabled) {
            this.miningbot.unregister();
            this.enabled = false;
            this.state = this.STATES.WAITING;
            Keybind.setKey('leftclick', false);
            this.foundLocations = [];
            this.lastBlockPos = null;
            this.currentTarget = null;
            this.tickCount = 0;
            this.empty = false;
        }
    }
}
// debugging
const bot = new MiningBot();

register('postRenderWorld', () => {
    if (bot.foundLocations.length > 0) {
        const sortedLocations = bot.foundLocations;

        const numLocations = sortedLocations.length;
        for (let i = 0; i < numLocations; i++) {
            const location = sortedLocations[i];

            if (i === 0) {
                RendererMain.drawWaypoint(
                    new Vec3i(location.x, location.y, location.z),
                    true,
                    new Color(0, 0, 1, 1) // Pure blue*
                );
                continue;
            }

            const t = numLocations > 1 ? i / (numLocations - 1) : 0;
            const r = t;
            const g = 1 - t;
            const b = 0;
            const color = new Color(r, g, b, 1);

            RendererMain.drawWaypoint(
                new Vec3i(location.x, location.y, location.z),
                true,
                color
            );
        }
    }
});
