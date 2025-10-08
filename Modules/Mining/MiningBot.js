/* eslint-disable no-unused-vars */
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
const { addCategoryItem, addToggle, addMultiToggle } = global.Categories;

const Vec3d = net.minecraft.util.math.Vec3d;

const ConcurrentLinkedQueue = Java.type(
    'java.util.concurrent.ConcurrentLinkedQueue'
);
const AtomicBoolean = Java.type('java.util.concurrent.atomic.AtomicBoolean');

class Bot {
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

        // worker thread stuff
        this.workerThread = null;
        this.taskQueue = new ConcurrentLinkedQueue();
        this.resultQueue = new ConcurrentLinkedQueue();
        this.workerRunning = new AtomicBoolean(false);

        register('command', () => {
            this.toggle();
            Chat.message('§c[Mining Bot] §7Enabled.');
        }).setName('startb', true);

        register('command', () => {
            this.miningbot.unregister();
            this.enabled = false;
            this.state = this.STATES.WAITING;
            Keybind.setKey('leftclick', false);
            this.foundLocations = [];
            this.lastBlockPos = null;
            this.currentTarget = null;
            this.tickCount = 0;
            this.stopWorker();
            Chat.message('§c[Mining Bot] §7Disabled.');
        }).setName('stopb', true);

        this.exploit = register('packetSent', (packet, event) => {
            let packetAction = packet?.getAction()?.toString();

            if (packetAction === 'ABORT_DESTROY_BLOCK') cancel(event);
        }).setFilteredClass(
            net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
        );

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
        });

        this.miningbot = register('tick', () => {
            if (!this.enabled) return;

            if (Client.isInChat() || Client.isInGui()) return;

            while (!this.resultQueue.isEmpty()) {
                const result = this.resultQueue.poll();
                if (result) {
                    if (result.type === 'SCAN_COMPLETE') {
                        this.scanning = false;

                        if (result.foundLocations.length === 0) {
                            this.empty = true;
                        } else {
                            this.nuking = false;
                            this.foundLocations = result.foundLocations;
                            this.currentTarget = this.foundLocations[0];
                            this.lowestCostBlockIndex = 0;
                        }
                    }
                }
            }

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
                        Chat.message('No more mineable blocks.');
                        this.miningbot.unregister();
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

                    if (
                        Fakelook !== 'Off' &&
                        this.COSTTYPE === this.gemstoneCosts
                    ) {
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

                        if (this.currentTarget)
                            Rotations.rotateTo(targetVector);
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

        addCategoryItem(
            'Mining',
            'Mining Bot',
            'Universal settings for Mining & block miner',
            'Automatically mines.'
        );
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

    startWorker() {
        if (this.workerThread && this.workerRunning.get()) {
            return;
        }

        this.workerRunning.set(true);
        this.workerThread = new Thread(() => {
            while (this.workerRunning.get()) {
                try {
                    const task = this.taskQueue.poll();

                    if (!task) {
                        Thread.sleep(10); // sleep if no task
                        continue;
                    }

                    if (task.type === 'SCAN_BLOCKS') {
                        this.processScanTask(task);
                    }
                } catch (e) {
                    if (e instanceof java.lang.InterruptedException) {
                        break; // thread interrupted, idk what to do here either!!
                    }
                    Chat.debugMessage('Worker thread error: ' + e);
                }
            }
        });

        this.workerThread.start();
        Chat.debugMessage('Mining Bot worker thread started');
    }

    stopWorker() {
        if (!this.workerThread || !this.workerRunning.get()) {
            return;
        }

        Chat.debugMessage('Stopping worker thread...');
        this.workerRunning.set(false);

        if (this.workerThread) {
            try {
                this.workerThread.interrupt();
                this.workerThread.join(1000);
            } catch (e) {
                // ignore errors !!
            }
            this.workerThread = null;
        }

        this.taskQueue.clear();
        this.resultQueue.clear();
        Chat.debugMessage('Mining Bot worker thread stopped');
    }

    processScanTask(task) {
        const {
            target,
            specific,
            startPos,
            excludedBlock,
            playerX,
            playerY,
            playerZ,
            playerEyePos,
            viewVector,
        } = task;

        this.tickCount = 0;

        let foundLocations = [];
        let startX, startY, startZ;

        if (startPos) {
            startX = startPos.x;
            startY = startPos.y;
            startZ = startPos.z;
        } else {
            startX = Math.floor(playerX);
            startY = Math.floor(playerY);
            startZ = Math.floor(playerZ);
        }

        let foundBlock = false;

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
            if (dist > 4.5) continue;

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
                        x - playerX,
                        y - playerEyePos.y,
                        z - playerZ
                    ).normalize();

                    let dotProduct =
                        toBlockVector.x * viewVector.x +
                        toBlockVector.y * viewVector.y +
                        toBlockVector.z * viewVector.z;

                    let priorityAdjustment = -dotProduct * 50;
                    let totalCost =
                        target[blockName] + dist * 5 + priorityAdjustment;

                    foundLocations.push({
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

        // sort and send blocks back to main thread
        if (foundBlock) {
            foundLocations.sort((a, b) => a.cost - b.cost);
        }

        this.resultQueue.offer({
            type: 'SCAN_COMPLETE',
            foundLocations: foundLocations,
        });
    }

    scanForBlock(
        target,
        specific = true,
        startPos = null,
        excludedBlock = null
    ) {
        if (this.scanning) return;
        this.scanning = true;

        let playerX = Player.getX();
        let playerY = Player.getY();
        let playerZ = Player.getZ();
        let playerEyePos = Player.getPlayer().getEyePos();
        let viewVector = Player.asPlayerMP().getLookVector();

        const task = {
            type: 'SCAN_BLOCKS',
            target: { ...target },
            specific: specific,
            startPos: startPos
                ? { x: startPos.getX(), y: startPos.getY(), z: startPos.getZ() }
                : null,
            excludedBlock: excludedBlock
                ? { x: excludedBlock.x, y: excludedBlock.y, z: excludedBlock.z }
                : null,
            playerX: playerX,
            playerY: playerY,
            playerZ: playerZ,
            playerEyePos: {
                x: playerEyePos.x,
                y: playerEyePos.y,
                z: playerEyePos.z,
            },
            viewVector: {
                x: viewVector.x,
                y: viewVector.y,
                z: viewVector.z,
            },
        };

        this.taskQueue.offer(task);
    }

    setCost(cost) {
        this.COSTTYPE = cost;
    }

    toggle(forceAState = null) {
        if (forceAState !== null) this.enabled = forceAState;
        else this.enabled = !this.enabled;

        if (this.enabled) {
            this.startWorker();
            this.miningbot.register();
            this.enabled = true;
            this.empty = false;
            this.allowScan = true;
            this.state = this.STATES.ABILITY;
        }

        if (!this.enabled) {
            this.stopWorker();
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

export const MiningBot = new Bot();
