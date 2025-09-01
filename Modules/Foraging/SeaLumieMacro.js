import RendererMain from '../Rendering/RendererMain';
import { Chat } from '../Utility/Chat';
import { Keybind } from '../Utility/Keybinding';
import { Rotations } from '../Utility/Rotations';
import { MathUtils } from '../Utility/Math';
import { Color } from '../../Utility/Constants';

const ConcurrentLinkedQueue = Java.type(
    'java.util.concurrent.ConcurrentLinkedQueue'
);
const AtomicBoolean = Java.type('java.util.concurrent.atomic.AtomicBoolean');

class SeaLumie {
    constructor() {
        this.STATES = {
            WAITING: 0,
            SCANNING: 1,
            GOINGTO: 2,
            RESURFACING: 3,
        };

        this.state = this.STATES.WAITING;
        this.enabled = false;
        this.closestPickle = null;
        this.renderer = null;
        this.startedScan = false;
        this.tryBreak = false;
        this.hasBroken = false;

        this.scanQueue = new ConcurrentLinkedQueue();
        this.resultQueue = new ConcurrentLinkedQueue();
        this.workerRunning = new AtomicBoolean(false);
        this.workerThread = null;

        register('tick', () => {
            if (!this.enabled) return;

            while (!this.resultQueue.isEmpty()) {
                let result = this.resultQueue.poll();
                if (result) {
                    if (result.pickle) {
                        this.closestPickle = result.pickle;
                        ChatLib.chat(
                            `Found the closest pickle using BFS at x=${this.closestPickle.x}, y=${this.closestPickle.y}, z=${this.closestPickle.z}`
                        );
                        this.hasBroken = false;
                        this.state = this.STATES.GOINGTO;
                    } else {
                        Chat.message('Failed to find a pickle!');
                        setTimeout(() => {
                            if (
                                this.enabled &&
                                this.state === this.STATES.SCANNING
                            ) {
                                this.queueScan();
                            }
                        }, 1000);
                    }
                }
            }

            switch (this.state) {
                case this.STATES.SCANNING:
                    if (!this.startedScan) {
                        this.startedScan = true;
                        this.queueScan();
                    }
                    break;

                case this.STATES.GOINGTO:
                    if (Player.getAirLevel() <= 0) {
                        this.state = this.STATES.RESURFACING;
                        Chat.message('Ran out of air, resurfacing');
                    }
                    break;
            }
        });

        register('postRenderWorld', () => {
            if (this.enabled && this.closestPickle) {
                let waypointPos = new Vec3i(
                    this.closestPickle.x,
                    this.closestPickle.y,
                    this.closestPickle.z
                );

                RendererMain.drawWaypoint(
                    waypointPos,
                    false,
                    new Color(1, 0, 0, 1)
                );
            }
        });

        register('command', () => {
            this.enabled = !this.enabled;
            if (this.enabled) {
                ChatLib.chat('SeaLumie enabled');
                this.startWorkerThread();
                this.state = this.STATES.SCANNING;
                this.startedScan = false;
            } else {
                ChatLib.chat('SeaLumie disabled');
                this.stopWorkerThread();
                this.state = this.STATES.WAITING;
                this.closestPickle = null;
            }
        }).setName('sealum');
    }

    queueScan() {
        let scanTask = {
            playerX: Math.floor(Player.getX()),
            playerY: Math.floor(Player.getY()),
            playerZ: Math.floor(Player.getZ()),
            radius: 64,
        };
        this.scanQueue.offer(scanTask);
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
                        let pickle = this.performBFS(task);
                        this.resultQueue.offer({ pickle: pickle });
                    } else {
                        Thread.sleep(50); // Sleep for 50ms when queue is empty
                    }
                } catch (e) {
                    console.error('Worker thread error:', e);
                    Thread.sleep(100);
                }
            }
        });

        this.workerThread.setName('SeaLumie-Worker-Thread');
        this.workerThread.setDaemon(true);
        this.workerThread.start();
    }

    stopWorkerThread() {
        this.workerRunning.set(false);

        // Clear queues
        while (!this.scanQueue.isEmpty()) {
            this.scanQueue.poll();
        }
        while (!this.resultQueue.isEmpty()) {
            this.resultQueue.poll();
        }

        this.workerThread = null;
    }

    performBFS(task) {
        let queue = [
            {
                x: task.playerX,
                y: task.playerY,
                z: task.playerZ,
            },
        ];

        let visited = new Set();
        let radius = task.radius;
        let count = 0;
        let maxIterations = radius * radius * radius * 8;

        while (queue.length > 0 && count < maxIterations) {
            // Check if we should stop
            if (!this.workerRunning.get()) {
                return null;
            }

            let currentBlock = queue.shift();
            count++;

            let distance = Math.sqrt(
                Math.pow(currentBlock.x - task.playerX, 2) +
                    Math.pow(currentBlock.y - task.playerY, 2) +
                    Math.pow(currentBlock.z - task.playerZ, 2)
            );

            if (distance > radius) continue;

            let key = `${currentBlock.x},${currentBlock.y},${currentBlock.z}`;
            if (visited.has(key)) continue;
            visited.add(key);

            try {
                let block = World.getBlockAt(
                    currentBlock.x,
                    currentBlock.y,
                    currentBlock.z
                );

                if (block?.type?.getRegistryName()?.includes('pickle')) {
                    let blockAbove = World.getBlockAt(
                        currentBlock.x,
                        currentBlock.y + 1,
                        currentBlock.z
                    );
                    if (
                        blockAbove?.type?.getRegistryName()?.includes('water')
                    ) {
                        return currentBlock; // Found a valid pickle
                    }
                }

                let neighbors = [
                    {
                        x: currentBlock.x + 1,
                        y: currentBlock.y,
                        z: currentBlock.z,
                    },
                    {
                        x: currentBlock.x - 1,
                        y: currentBlock.y,
                        z: currentBlock.z,
                    },
                    {
                        x: currentBlock.x,
                        y: currentBlock.y + 1,
                        z: currentBlock.z,
                    },
                    {
                        x: currentBlock.x,
                        y: currentBlock.y - 1,
                        z: currentBlock.z,
                    },
                    {
                        x: currentBlock.x,
                        y: currentBlock.y,
                        z: currentBlock.z + 1,
                    },
                    {
                        x: currentBlock.x,
                        y: currentBlock.y,
                        z: currentBlock.z - 1,
                    },
                ];

                neighbors.forEach((neighbor) => {
                    let neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                    if (!visited.has(neighborKey)) {
                        try {
                            let neighborBlock = World.getBlockAt(
                                neighbor.x,
                                neighbor.y,
                                neighbor.z
                            );
                            if (
                                neighborBlock?.type
                                    ?.getRegistryName()
                                    ?.includes('water') ||
                                neighborBlock?.type
                                    ?.getRegistryName()
                                    ?.includes('air') ||
                                neighborBlock?.type
                                    ?.getRegistryName()
                                    ?.includes('pickle')
                            ) {
                                queue.push(neighbor);
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}
        }

        return null;
    }
}

new SeaLumie();
