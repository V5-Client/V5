import { NukerUtils } from '../../Utility/NukerUtils';
import { Chat } from '../../Utility/Chat';
import { Utils } from '../../Utility/Utils';
const BP = net.minecraft.util.math.BlockPos;
const ConcurrentLinkedQueue = Java.type(
    'java.util.concurrent.ConcurrentLinkedQueue'
);
const AtomicBoolean = Java.type('java.util.concurrent.atomic.AtomicBoolean');

class NukerClass {
    constructor() {
        this.ModuleName = 'Nuker';
        this.Enabled = false;

        this.target = null;
        this.lastTime = 0;
        this.lastChestClick = {};
        this.minedBlocks = new Map();
        this.clickQueue = new Set();
        this.chestClickedThisTick = false;
        this.startTime = Date.now();

        this.BLOCK_COOLDOWN = 1000;
        this.REQUIRED_ITEMS = ['Drill', 'Gauntlet', 'Pick'];

        this.lastNukeTime = Date.now();

        this.customBlockID = 0;
        this.customBlockList = [];

        // settings
        this.blockType = 'Custom';
        this.nukeBelow = false;
        this.onGroundOnly = false;
        this.autoChest = false;
        this.heightLimit = 5;

        this.scanQueue = new ConcurrentLinkedQueue();
        this.resultQueue = new ConcurrentLinkedQueue();
        this.workerRunning = new AtomicBoolean(false);
        this.workerThread = null;

        register('command', () => {
            this.toggle();
        }).setName('NukerToggle');

        register('command', (ticks = 1) => {
            let block = Player.lookingAt();

            if (block.getClass() === Block) {
                let pos = [block.getX(), block.getY(), block.getZ()];
                Chat.debugMessage(
                    'Nuking ' + block.type.getRegistryName() + ' at ' + pos
                );
                NukerUtils.nuke(pos, ticks);
            }
        }).setCommandName('nukeit');

        register('command', () => {
            let block = Player.lookingAt();
            if (block.getClass() === Block) {
                const newBlock = {
                    name: block.type.getName(),
                    id: block.type.getID(),
                };
                if (!this.customBlockList.some((b) => b.id === newBlock.id)) {
                    this.customBlockList.push(newBlock);
                    Chat.message(
                        'Added ' +
                            block.type.getName() +
                            ' to custom nuker list.'
                    );
                } else {
                    Chat.message('Block already in custom nuker list.');
                }
            } else {
                Chat.message('Look at a block to add it');
            }
        }).setCommandName('nukeradd');

        register('command', (id) => {
            if (id === undefined) {
                Chat.message('Usage: /nukerremove <id>');
                return;
            }
            let initialLength = this.customBlockList.length;
            this.customBlockList = this.customBlockList.filter(
                (block) => !(block.id === parseInt(id))
            );
            if (this.customBlockList.length < initialLength) {
                Chat.message('Removed block(s) from custom nuker list.');
            } else {
                Chat.message('Block not found in custom nuker list.');
            }
        }).setCommandName('nukerremove');

        register('command', () => {
            this.customBlockList = [];
            Chat.message('Cleared custom nuker list.');
        }).setCommandName('nukerclear');

        register('command', () => {
            if (this.customBlockList.length === 0) {
                Chat.message('Custom nuker list is empty.');
                return;
            }
            Chat.message('Custom Nuker List:');
            this.customBlockList.forEach((block) => {
                Chat.message(`Name: ${block.name} - ID: ${block.id}`);
            });
        }).setCommandName('nukerlist');

        register('worldUnload', () => {
            if (!this.Enabled) return;

            this.toggle();
            Chat.debugMessage(
                this.ModuleName + ': &cDisabled due to world change'
            );
        });

        register('tick', () => {
            if (!this.Enabled) return;

            if (!this.isHoldingRequiredItem()) return;
            if (Client.isInGui() && !Client.isInChat()) return;
            if (Client.getKeyBindFromDescription('key.attack').isKeyDown())
                return;
            if (!this.onGround()) return;
            if (Date.now() - this.lastTime < 0 * 50) return; // delay (0)

            this.lastTime = Date.now();
            this.chestClickedThisTick = false;

            for (const [pos, time] of this.minedBlocks) {
                if (Date.now() - time > this.BLOCK_COOLDOWN) {
                    this.minedBlocks.delete(pos);
                }
            }

            while (!this.resultQueue.isEmpty()) {
                let result = this.resultQueue.poll();
                if (
                    result &&
                    result.validBlocks &&
                    result.validBlocks.length > 0
                ) {
                    let validBlocks = result.validBlocks;
                    let targetPos =
                        validBlocks[
                            Math.floor(Math.random() * validBlocks.length)
                        ];

                    NukerUtils.nuke([targetPos.x, targetPos.y, targetPos.z]);

                    this.target = new BP(targetPos.x, targetPos.y, targetPos.z);
                    this.minedBlocks.set(
                        `${targetPos.x},${targetPos.y},${targetPos.z}`,
                        Date.now()
                    );
                }
            }

            let playerX = Math.floor(Player.getX());
            let playerY = Math.floor(Player.getY());
            let playerZ = Math.floor(Player.getZ());

            let scanTask = {
                playerX: playerX,
                playerY: playerY,
                playerZ: playerZ,
                nukeBelow: this.nukeBelow,
                heightLimit: this.heightLimit,
                minedBlocks: Array.from(this.minedBlocks.keys()),
                blockType: this.blockType,
                customBlockList: [...this.customBlockList],
            };

            this.scanQueue.offer(scanTask);
        });
    }

    startWorkerThread() {
        if (this.workerThread !== null && this.workerRunning.get()) {
            return; // Worker already running
        }

        this.workerRunning.set(true);

        this.workerThread = new Thread(() => {
            while (this.workerRunning.get()) {
                try {
                    let task = this.scanQueue.poll();

                    if (task) {
                        let validBlocks = this.performScan(task);
                        this.resultQueue.offer({ validBlocks: validBlocks });
                    } else {
                        Thread.sleep(10); // Sleep for 10ms when queue is empty
                    }
                } catch (e) {
                    console.error('Worker thread error:', e);
                    Thread.sleep(100);
                }
            }
        });

        this.workerThread.setName('Nuker-Worker-Thread');
        this.workerThread.setDaemon(true);
        this.workerThread.start();
    }

    stopWorkerThread() {
        this.workerRunning.set(false);

        while (!this.scanQueue.isEmpty()) {
            this.scanQueue.poll();
        }
        while (!this.resultQueue.isEmpty()) {
            this.resultQueue.poll();
        }

        this.workerThread = null;
    }

    performScan(task) {
        let validBlocks = [];
        let minedBlocksSet = new Set(task.minedBlocks);

        for (let x = task.playerX - 5; x <= task.playerX + 5; x++) {
            for (
                let y = task.playerY - (task.nukeBelow ? 0 : 5);
                y <= task.playerY + task.heightLimit;
                y++
            ) {
                for (let z = task.playerZ - 5; z <= task.playerZ + 5; z++) {
                    if (task.nukeBelow && y < task.playerY) continue;

                    let posKey = `${x},${y},${z}`;
                    if (minedBlocksSet.has(posKey)) continue;

                    let dx = task.playerX - x;
                    let dy = task.playerY - y;
                    let dz = task.playerZ - z;
                    let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (distance > 4.5) continue;

                    try {
                        let blockPos = new BP(x, y, z);
                        let block = World.getBlockStateAt(blockPos).getBlock();
                        let isValidBlock = false;

                        if (task.blockType === 'Crystal Hollows') {
                            let blockA = World.getBlockAt(x, y, z);
                            isValidBlock =
                                block instanceof
                                    net.minecraft.block.BlockStone ||
                                block instanceof net.minecraft.block.BlockOre ||
                                block instanceof
                                    net.minecraft.block.BlockRedstoneOre ||
                                blockA.type.getID() == 4;
                        } else if (task.blockType === 'Custom') {
                            let blockA = World.getBlockAt(x, y, z);
                            isValidBlock = task.customBlockList.some(
                                (customBlock) =>
                                    blockA.type.getID() === customBlock.id
                            );
                        }

                        if (isValidBlock) {
                            validBlocks.push({ x: x, y: y, z: z });
                        }
                    } catch (e) {}
                }
            }
        }

        return validBlocks;
    }

    isHoldingRequiredItem() {
        if (this.blockType === 'Crystal Hollows') {
            this.REQUIRED_ITEMS = ['Drill', 'Gauntlet', 'Pick'];
        } else if (this.blockType === 'Custom') {
            return true;
        }

        let heldItem = Player.getHeldItem();
        if (!heldItem) return false;
        return this.REQUIRED_ITEMS.some((item) =>
            heldItem.getName().toLowerCase().includes(item.toLowerCase())
        );
    }

    distance(from, to) {
        const diffX = from[0] - to[0];
        const diffY = from[1] - to[1];
        const diffZ = from[2] - to[2];
        const distanceFlat = Math.sqrt(diffX * diffX + diffZ * diffZ);
        const distance = Math.sqrt(distanceFlat * distanceFlat + diffY * diffY);
        return { distance, distanceFlat, distanceY: Math.abs(diffY) };
    }

    onGround() {
        if (!this.onGroundOnly) return true;
        return Player.asPlayerMP().isOnGround();
    }

    cords() {
        let eyeVector = Utils.convertToVector(
            Player.asPlayerMP().getEyePosition(1)
        );
        return [eyeVector.x, eyeVector.y, eyeVector.z];
    }

    rightClickBlock(xyz) {
        var blockPos = new BP(xyz[0], xyz[1], xyz[2]);
        var heldItemStack = Player.getHeldItem()?.getItemStack() || null;
        Client.sendPacket(
            new C08PacketPlayerBlockPlacement(
                blockPos,
                0,
                heldItemStack,
                0,
                0,
                0
            )
        );
    }

    init() {
        this.target = null;
        this.lastTime = 0;
        this.lastChestClick = {};
        this.minedBlocks = new Map();
        this.clickQueue = new Set();
        this.chestClickedThisTick = false;
    }

    stopMacro(msg) {
        if (msg) {
            Utils.warnPlayer(msg);
        }
        this.Enabled = false;
        this.stopWorkerThread();
        this.init();
    }

    toggle() {
        this.Enabled = !this.Enabled;
        if (this.Enabled) {
            this.startTime = Date.now();
            this.init();
            this.startWorkerThread();
            Chat.message(this.ModuleName + ': &aEnabled');
        } else {
            this.stopWorkerThread();
            this.init();
            Chat.message(this.ModuleName + ': &cDisabled');
        }
    }
}

export const Nuker = new NukerClass();
