import { NukerUtils } from '../../Utility/NukerUtils';
import { Chat } from '../../Utility/Chat';
import { Utils } from '../../Utility/Utils';
import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { ModuleBase } from '../../Utility/ModuleBase';
const BP = net.minecraft.util.math.BlockPos;

const ConcurrentLinkedQueue = Java.type(
    'java.util.concurrent.ConcurrentLinkedQueue'
);
const AtomicBoolean = Java.type('java.util.concurrent.atomic.AtomicBoolean');

class NukerClass extends ModuleBase {
    constructor() {
        super({
            name: 'Nuker',
            subcategory: 'Mining',
            description: 'Automatically nukes nearby blocks.',
            tooltip: 'Automatically nukes nearby blocks',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });
        this.bindToggleKey();

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

        // worker thread stuff
        this.workerThread = null;
        this.taskQueue = new ConcurrentLinkedQueue();
        this.resultQueue = new ConcurrentLinkedQueue();
        this.workerRunning = new AtomicBoolean(false);

        // settings
        this.blockType = 'Custom';
        this.targetMode = 'Random';
        this.nukeBelow = false;
        this.onGroundOnly = false;
        this.autoChest = false;
        this.heightLimit = 5;

        register('command', (ticks = 1) => {
            let block = Player.lookingAt();

            if (block?.getClass() === Block) {
                let pos = [block.getX(), block.getY(), block.getZ()];
                Chat.debugMessage(
                    'Nuking ' + block.type.getRegistryName() + ' at ' + pos
                );
                NukerUtils.nuke(pos, ticks);
            }
        }).setCommandName('nukeit');

        register('command', () => {
            let block = Player.lookingAt();
            if (block?.getClass() === Block) {
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

        this.on('tick', () => {
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
                const result = this.resultQueue.poll();
                if (result) {
                    NukerUtils.nuke([result.x, result.y, result.z]);
                    this.target = result;
                    this.minedBlocks.set(result.toString(), Date.now());
                }
            }

            let playerX = Math.floor(Player.getX());
            let playerY = Math.floor(Player.getY());
            let playerZ = Math.floor(Player.getZ());

            const task = {
                type: 'SCAN_BLOCKS',
                playerPos: { x: playerX, y: playerY, z: playerZ },
                blockType: this.blockType,
                targetMode: this.targetMode,
                nukeBelow: this.nukeBelow,
                heightLimit: this.heightLimit,
                customBlockList: [...this.customBlockList],
                minedBlocks: new Set(this.minedBlocks.keys()),
                playerCords: this.cords(),
            };

            this.taskQueue.offer(task);
        });

        this.on('postRenderWorld', () => {
            if (this.target) {
                this.renderRGB([
                    this.target.getX(),
                    this.target.getY(),
                    this.target.getZ(),
                ]);
            }

            if (!this.chestPos) return;

            if (
                this.distance(this.cords(), [
                    this.chestPos.x,
                    this.chestPos.y,
                    this.chestPos.z,
                ]).distance > 8 ||
                !this.autoChest
            )
                return;

            RenderUtils.drawBox(
                new Vec3d(this.chestPos.x, this.chestPos.y, this.chestPos.z),
                [100, 100, 255, 150],
                false
            );
        });

        this.on('renderBlockEntity', (entity) => {
            if (Client.isInGui() && !Client.isInChat()) return;
            if (!this.isHoldingRequiredItem()) return;

            if (
                entity?.getBlockType() != null &&
                entity?.getBlockType()?.getID() === 188
            ) {
                const chest = entity?.getBlock()?.pos;
                this.chestPos = chest;
                if (!chest) return;

                const pos = `${chest.x},${chest.y},${chest.z}`;

                if (this.clickQueue.has(pos)) return; // Skip if already queued

                if (
                    this.distance(this.cords(), [chest.x, chest.y, chest.z])
                        .distance > 6
                )
                    return;

                if (
                    this.autoChest &&
                    !this.chestClickedThisTick &&
                    (!this.lastChestClick[pos] ||
                        Date.now() - this.lastChestClick[pos] >
                            Math.floor(Math.random() * 50) + 50)
                ) {
                    this.clickQueue.add(pos);
                    this.rightClickBlock([chest.x, chest.y, chest.z]);
                    this.lastChestClick[pos] = Date.now();
                    this.chestClickedThisTick = true;
                }
            }
        });

        this.addToggle(
            'Auto Chest',
            (v) => (this.autoChest = v),
            'Auto-opens chests'
        );
        this.addToggle(
            "Don't nuke below",
            (v) => (this.nukeBelow = v),
            'Prevents nuking below'
        );
        this.addMultiToggle(
            'Target Mode',
            ['Random', 'Closest'],
            true,
            (v) => (this.targetMode = v),
            'Choose between random or closest block targeting'
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
                        Thread.sleep(10);
                        continue;
                    }

                    if (task.type === 'SCAN_BLOCKS') {
                        this.processScanTask(task);
                    }
                } catch (e) {
                    if (e instanceof java.lang.InterruptedException) {
                        break; // interrupted, what do i do
                    }
                    Chat.debugMessage('Worker thread error: ' + e);
                }
            }
        });

        //this.workerThread.setName('NukerWorker'); //these dont exist apparently
        //this.workerThread.setDaemon(true); // grrr
        this.workerThread.start();
        Chat.debugMessage('Worker thread started');
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
            } catch (e) {}
            this.workerThread = null;
        }

        this.taskQueue.clear();
        this.resultQueue.clear();
        Chat.debugMessage('Worker thread stopped');
    }

    processScanTask(task) {
        const {
            playerPos,
            blockType,
            targetMode,
            nukeBelow,
            heightLimit,
            customBlockList,
            minedBlocks,
            playerCords,
        } = task;

        const validBlocks = [];

        for (let x = playerPos.x - 5; x <= playerPos.x + 5; x++) {
            for (
                let y = playerPos.y - (nukeBelow ? 0 : 5);
                y <= playerPos.y + heightLimit;
                y++
            ) {
                for (let z = playerPos.z - 5; z <= playerPos.z + 5; z++) {
                    if (nukeBelow && y < playerPos.y) continue;

                    let pos = new BlockPos(x, y, z);
                    if (minedBlocks.has(pos.toString())) continue;

                    if (this.distance(playerCords, [x, y, z]).distance > 4.5) {
                        continue;
                    }

                    let block = World.getBlockStateAt(pos).getBlock();
                    let isValidBlock = false;

                    if (blockType === 'Crystal Hollows') {
                        let blockA = World.getBlockAt(x, y, z);
                        isValidBlock =
                            block instanceof net.minecraft.block.BlockStone ||
                            block instanceof net.minecraft.block.BlockOre ||
                            block instanceof
                                net.minecraft.block.BlockRedstoneOre ||
                            blockA.type.getID() == 4;
                    } else if (blockType === 'Custom') {
                        let blockCheck = World.getBlockAt(x, y, z);
                        isValidBlock = customBlockList.some(
                            (customBlock) =>
                                blockCheck.type.getID() === customBlock.id
                        );
                    }

                    if (isValidBlock) {
                        validBlocks.push(pos);
                    }
                }
            }
        }

        if (validBlocks.length > 0) {
            let targetPos;

            if (targetMode === 'Closest') {
                // Find the closest block
                let minDistance = Infinity;
                let closestBlock = null;

                for (let pos of validBlocks) {
                    const dist = this.distance(playerCords, [
                        pos.getX(),
                        pos.getY(),
                        pos.getZ(),
                    ]).distance;

                    if (dist < minDistance) {
                        minDistance = dist;
                        closestBlock = pos;
                    }
                }

                targetPos = closestBlock;
            } else {
                // Pick a random block
                targetPos =
                    validBlocks[Math.floor(Math.random() * validBlocks.length)];
            }

            if (targetPos) {
                this.resultQueue.offer(targetPos);
            }
        }
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

    renderRGB(location) {
        let time = Date.now() / 1000;
        let r = Math.sin(time) * 127 + 128;
        let g = Math.sin(time + 2) * 127 + 128;
        let b = Math.sin(time + 4) * 127 + 128;

        RenderUtils.drawWireFrame(
            new Vec3d(location[0], location[1], location[2]),
            [r, g, b, 255],
            5,
            true
        );
    }

    rightClickBlock(xyz) {
        let blockPos = new BP(xyz[0], xyz[1], xyz[2]);
        let direction = net.minecraft.util.math.Direction.UP;
        let hitVec = new Vec3d(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);

        let blockHitResult = new net.minecraft.util.hit.BlockHitResult(
            hitVec,
            direction,
            blockPos,
            false
        );

        let hand = net.minecraft.util.Hand.MAIN_HAND;
        let sequence = 0;
        Client.sendPacket(
            new net.minecraft.network.packet.c2s.play.PlayerInteractBlockC2SPacket(
                hand,
                blockHitResult,
                sequence
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

    onEnable() {
        Chat.message('Nuker &aEnabled');
        this.startWorker();
        this.init();
        this.startTime = Date.now();
    }

    onDisable() {
        Chat.message('Nuker &cDisabled');
        this.stopWorker();
        this.init();
    }
}

export const Nuker = new NukerClass();
