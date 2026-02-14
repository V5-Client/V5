import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { BlockUpdateS2C, ChunkDataS2C } from '../../utils/Packets';
import Render from '../../utils/render/Render';
import { manager } from '../../utils/SkyblockEvents';

const Long2ObjectOpenHashMap = Java.type('it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap');
const ReentrantLock = Java.type('java.util.concurrent.locks.ReentrantLock');
const ChunkPos = net.minecraft.util.math.ChunkPos;

class StructureESP extends ModuleBase {
    constructor() {
        super({
            name: 'Structure ESP',
            subcategory: 'Visuals',
            description: 'FastUtil Synchronized ESP',
        });

        this.workerThread = java.util.concurrent.Executors.newSingleThreadExecutor((r) => {
            const t = new java.lang.Thread(r);
            t.setDaemon(true);
            t.setName('V5-StructureESP-Worker');
            return t;
        });

        this.lock = new ReentrantLock();
        this.chunks = new Long2ObjectOpenHashMap();

        this.on('packetReceived', (packet) => {
            try {
                const cx = packet.getChunkX();
                const cz = packet.getChunkZ();
                setTimeout(() => {
                    this.searchChunk(cx, cz);
                }, 50);
            } catch (e) {
                console.log('PROBABLY DUE TO CHATTRIGGERS packet handling being stupid as fuck!' + e);
            }
            // console.log(`[ESP] Packet received: ${cx}, ${cz}`);
        }).setFilteredClass(ChunkDataS2C);

        this.on('packetReceived', (packet) => {
            try {
                const pos = packet.getPos();
                this.updateBlock(pos.getX(), pos.getY(), pos.getZ());
            } catch (e) {
                console.log('PROBABLY DUE TO CHATTRIGGERS getPos being stupid as fuck!' + e);
            }
        }).setFilteredClass(BlockUpdateS2C);

        this.on('postRenderWorld', () => {
            this.render();
        });

        manager.subscribe('warp', () => {
            console.log('Warp detected! Resetting module data...');
            this.chunks.clear();
        });

        register('gameUnload', () => {
            if (this.workerThread) {
                this.workerThread.shutdownNow();
            }
        });
    }

    getChunkKey(x, z) {
        return ChunkPos.toLong(x, z);
    }

    searchChunk(cx, cz) {
        this.workerThread.submit(
            new java.lang.Runnable({
                run: () => {
                    try {
                        const world = Client.getMinecraft().world;
                        if (!world) return;

                        const chunk = world.getChunk(cx, cz);
                        if (!chunk || chunk.isEmpty()) {
                            // console.log(`[ESP] Chunk ${cx}, ${cz} empty/not loaded`);
                            return;
                        }

                        const targetBlocks = [];
                        const sections = chunk.getSectionArray();
                        const minY = world.getBottomY();

                        for (const [sectionY, section] of sections.entries()) {
                            if (!section || section.isEmpty()) continue;

                            for (let y = 0; y < 16; y++) {
                                for (let x = 0; x < 16; x++) {
                                    for (let z = 0; z < 16; z++) {
                                        const state = section.getBlockState(x, y, z);
                                        if (state.isAir()) continue;

                                        const name = state.getBlock().getTranslationKey().toLowerCase();

                                        if (name.includes('glass') || name.includes('coal')) {
                                            targetBlocks.push({
                                                x: (cx << 4) + x,
                                                y: (sectionY << 4) + y + minY,
                                                z: (cz << 4) + z,
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        const key = this.getChunkKey(cx, cz);
                        this.lock.lock();
                        try {
                            if (targetBlocks.length > 0) {
                                this.chunks.put(key, targetBlocks);
                                // console.log(`[ESP] Found ${targetBlocks.length} in ${cx}, ${cz}`);
                            } else {
                                this.chunks.remove(key);
                            }
                        } finally {
                            this.lock.unlock();
                        }
                    } catch (e) {
                        console.log('[ESP] Error: ' + e);
                    }
                },
            })
        );
    }

    updateBlock(bx, by, bz) {
        this.workerThread.submit(
            new java.lang.Runnable({
                run: () => {
                    try {
                        const world = Client.getMinecraft().world;
                        if (!world) return;

                        const cx = bx >> 4;
                        const cz = bz >> 4;
                        const key = this.getChunkKey(cx, cz);

                        const state = world.getBlockState(new net.minecraft.util.math.BlockPos(bx, by, bz));
                        const name = state.getBlock().getTranslationKey().toLowerCase();
                        const isTarget = name.includes('glass') || name.includes('coal');

                        this.lock.lock();
                        try {
                            let blocks = this.chunks.get(key);

                            if (isTarget) {
                                if (!blocks) {
                                    blocks = [];
                                    this.chunks.put(key, blocks);
                                }
                                if (!blocks.some((b) => b.x === bx && b.y === by && b.z === bz)) {
                                    blocks.push({ x: bx, y: by, z: bz });
                                    // console.log(`[ESP] Block +: ${bx}, ${by}, ${bz}`);
                                }
                            } else if (blocks) {
                                const filtered = blocks.filter((b) => !(b.x === bx && b.y === by && b.z === bz));
                                if (filtered.length === 0) {
                                    this.chunks.remove(key);
                                } else {
                                    this.chunks.put(key, filtered);
                                }
                            }
                        } finally {
                            this.lock.unlock();
                        }
                    } catch (e) {
                        console.log('[ESP] Update Error: ' + e);
                    }
                },
            })
        );
    }

    render() {
        this.lock.lock();
        try {
            const iterator = this.chunks.long2ObjectEntrySet().fastIterator();
            while (iterator.hasNext()) {
                const entry = iterator.next();
                const blockList = entry.getValue();
                for (const b of blockList) {
                    Render.drawBox(new Vec3d(b.x, b.y, b.z), Render.Color(0, 255, 200, 100), false);
                }
            }
        } catch (e) {
        } finally {
            this.lock.unlock();
        }
    }
}

new StructureESP();
