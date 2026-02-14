import { BlockUpdateS2C, ChunkDataS2C } from '../../utils/Packets';
import { manager } from '../../utils/SkyblockEvents';

const Long2ObjectOpenHashMap = Java.type('it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap');
const ReentrantLock = Java.type('java.util.concurrent.locks.ReentrantLock');
const ChunkPos = net.minecraft.util.math.ChunkPos;
const BP = net.minecraft.util.math.BlockPos;
const Runnable = java.lang.Runnable;

class Scanner {
    constructor() {
        this.executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        this.lock = new ReentrantLock();
        this.chunks = new Long2ObjectOpenHashMap();

        this.enabled = false;
        this.targets = ['glass', 'coal'];
        this.bounds = null;

        this.onChunkData = null;
        this.onBlockUpdate = null;

        this.init();
    }

    init() {
        this.onChunkData = register('packetReceived', (packet) => {
            const cx = packet.getChunkX();
            const cz = packet.getChunkZ();
            setTimeout(() => this.searchChunk(cx, cz), 50);
        })
            .setFilteredClass(ChunkDataS2C)
            .unregister();

        this.onBlockUpdate = register('packetReceived', (packet) => {
            const pos = packet.getPos();
            this.updateBlock(pos.getX(), pos.getY(), pos.getZ());
        })
            .setFilteredClass(BlockUpdateS2C)
            .unregister();

        manager.subscribe('warp', () => this.clear());
    }

    toggle(state) {
        this.enabled = state ?? !this.enabled;

        if (this.enabled) {
            this.onChunkData.register();
            this.onBlockUpdate.register();
        } else {
            this.onChunkData.unregister();
            this.onBlockUpdate.unregister();
            this.clear();
        }
    }

    setTargets(targetList) {
        this.targets = targetList.map((t) => t.toLowerCase());
        this.clear();
    }

    setBounds(minX, maxX, minY, maxY, minZ, maxZ) {
        this.bounds = { minX, maxX, minY, maxY, minZ, maxZ };
    }

    clear() {
        this.lock.lock();
        try {
            this.chunks.clear();
        } finally {
            this.lock.unlock();
        }
    }

    isInBounds(x, y, z) {
        if (!this.bounds) return true;
        const b = this.bounds;
        return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;
    }

    searchChunk(cx, cz) {
        this.executor.submit(
            new Runnable({
                run: () => {
                    try {
                        const world = Client.getMinecraft().world;
                        const chunk = world?.getChunk(cx, cz);
                        if (!chunk || chunk.isEmpty()) return;

                        const found = [];
                        const sections = chunk.getSectionArray();
                        const minY = world.getBottomY();

                        sections.forEach((section, sIndex) => {
                            if (!section || section.isEmpty()) return;

                            for (let y = 0; y < 16; y++) {
                                for (let x = 0; x < 16; x++) {
                                    for (let z = 0; z < 16; z++) {
                                        const wx = (cx << 4) + x;
                                        const wy = (sIndex << 4) + y + minY;
                                        const wz = (cz << 4) + z;

                                        if (!this.isInBounds(wx, wy, wz)) continue;

                                        const state = section.getBlockState(x, y, z);
                                        if (state.isAir()) continue;

                                        const name = state.getBlock().getTranslationKey().toLowerCase();
                                        if (this.targets.some((t) => name.includes(t))) {
                                            found.push({ x: wx, y: wy, z: wz });
                                        }
                                    }
                                }
                            }
                        });

                        const key = ChunkPos.toLong(cx, cz);
                        this.lock.lock();
                        try {
                            if (found.length > 0) this.chunks.put(key, found);
                            else this.chunks.remove(key);
                        } finally {
                            this.lock.unlock();
                        }
                    } catch (e) {
                        console.log(`[Scanner] Search Error: ${e}`);
                    }
                },
            })
        );
    }

    updateBlock(bx, by, bz) {
        if (!this.isInBounds(bx, by, bz)) return;

        this.executor.submit(
            new Runnable({
                run: () => {
                    try {
                        const world = Client.getMinecraft().world;
                        if (!world) return;

                        const state = world.getBlockState(new BP(bx, by, bz));
                        const name = state.getBlock().getTranslationKey().toLowerCase();
                        const isTarget = this.targets.some((t) => name.includes(t));

                        const key = ChunkPos.toLong(bx >> 4, bz >> 4);

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
                                }
                            } else if (blocks) {
                                const filtered = blocks.filter((b) => !(b.x === bx && b.y === by && b.z === bz));
                                if (filtered.length === 0) this.chunks.remove(key);
                                else this.chunks.put(key, filtered);
                            }
                        } finally {
                            this.lock.unlock();
                        }
                    } catch (e) {
                        console.log(`[Scanner] Update Error: ${e}`);
                    }
                },
            })
        );
    }
}

export const WorldScanner = new Scanner();
