//@Private
// Vibecoded slop, made for development purposes only.
// Vibecoded slop, made for development purposes only.
// Vibecoded slop, made for development purposes only.
// Vibecoded slop, made for development purposes only.
// Vibecoded slop, made for development purposes only.

import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import RenderUtils from '../../utils/render/RendererUtils';
import { Utils } from '../../utils/Utils';

const ORE_TYPES = {
    glacite: {
        name: 'Glacite',
        ids: [554],
        colors: { fill: [90, 180, 255, 80], edge: [90, 180, 255, 225] },
    },
    peridot: {
        name: 'Peridot',
        ids: [312, 511],
        colors: { fill: [100, 220, 150, 80], edge: [100, 220, 150, 225] },
    },
    umber: {
        name: 'Umber',
        ids: [625, 552, 494],
        colors: { fill: [190, 120, 70, 80], edge: [190, 120, 70, 225] },
    },
    tungstun: {
        name: 'Tungstun',
        ids: [280, 332],
        colors: { fill: [150, 150, 170, 80], edge: [150, 150, 170, 225] },
    },
    aquamarine: {
        name: 'Aquamarine',
        ids: [310, 509],
        colors: { fill: [60, 200, 255, 80], edge: [60, 200, 255, 225] },
    },
    onyx: {
        name: 'Onyx',
        ids: [513, 314],
        colors: { fill: [140, 80, 200, 80], edge: [140, 80, 200, 225] },
    },
    citrine: {
        name: 'Citrine',
        ids: [510, 311],
        colors: { fill: [240, 180, 60, 80], edge: [240, 180, 60, 225] },
    },
};

class OreVeinRecorder extends ModuleBase {
    constructor() {
        super({
            name: 'Ore Vein Recorder',
            subcategory: 'Mining',
            description: 'Records ore veins you look at and renders all saved blocks.',
            tooltip: 'Use /orevein to toggle recording.',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.fileName = 'oreVeins.json';
        this.maxBlocksPerScan = 4096;
        this.renderDistanceSq = 160 * 160;
        this.neighborOffsets = this.buildNeighborOffsets();

        this.oreIdSets = this.buildIdSets();
        this.idLookup = this.buildIdLookup();

        this.veins = this.loadFromDisk();
        this.scannedBlocks = this.buildScannedSets(this.veins);
        this.dirty = false;

        this.on('tick', () => this.handleTick());
        this.on('postRenderWorld', () => this.renderVeins());
    }

    buildIdSets() {
        const sets = {};
        Object.keys(ORE_TYPES).forEach((key) => {
            sets[key] = new Set(ORE_TYPES[key].ids);
        });
        return sets;
    }

    buildIdLookup() {
        const lookup = new Map();
        Object.keys(ORE_TYPES).forEach((key) => {
            ORE_TYPES[key].ids.forEach((id) => lookup.set(id, key));
        });
        return lookup;
    }

    buildNeighborOffsets() {
        const offsets = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    offsets.push([dx, dy, dz]);
                }
            }
        }
        return offsets;
    }

    loadFromDisk() {
        const raw = Utils.getConfigFile(this.fileName) || {};
        const data = {};

        Object.keys(ORE_TYPES).forEach((key) => {
            const entries = Array.isArray(raw[key]) ? raw[key] : [];
            data[key] = entries.map((entry) => this.normalizeVein(entry)).filter((blocks) => blocks && blocks.length > 0);
        });

        return data;
    }

    normalizeVein(entry) {
        if (!entry) return null;

        // Support old shape { blocks, origin, createdAt } and new shape as an array of positions
        const rawBlocks = Array.isArray(entry) ? entry : Array.isArray(entry.blocks) ? entry.blocks : null;
        if (!rawBlocks) return null;

        const blocks = rawBlocks.map((b) => this.toPos(b)).filter((b) => b !== null);

        if (blocks.length === 0) return null;

        return blocks;
    }

    buildScannedSets(data) {
        const sets = {};
        Object.keys(ORE_TYPES).forEach((key) => {
            const set = new Set();
            (data[key] || []).forEach((vein) => {
                vein.forEach((pos) => set.add(this.posKey(pos)));
            });
            sets[key] = set;
        });
        return sets;
    }

    toPos(raw) {
        if (!raw) return null;

        const x = typeof raw.x === 'number' ? raw.x : typeof raw.getX === 'function' ? raw.getX() : null;
        const y = typeof raw.y === 'number' ? raw.y : typeof raw.getY === 'function' ? raw.getY() : null;
        const z = typeof raw.z === 'number' ? raw.z : typeof raw.getZ === 'function' ? raw.getZ() : null;

        if (x === null || y === null || z === null) return null;

        return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
    }

    posKey(pos) {
        return `${pos.x},${pos.y},${pos.z}`;
    }

    handleTick() {
        if (!Player.getPlayer() || Client.isInGui() || Client.isInChat()) return;

        const lookingAt = Player.lookingAt();
        if (!(lookingAt instanceof Block)) return;

        const blockId = lookingAt?.type?.getID();
        const oreKey = this.idLookup.get(blockId);
        if (!oreKey) return;

        const startPos = this.toPos(lookingAt);
        if (!startPos) return;

        const key = this.posKey(startPos);
        if (this.scannedBlocks[oreKey]?.has(key)) return;

        const cluster = this.scanVein(startPos, oreKey);
        if (cluster.length === 0) return;

        if (cluster.length === 1) {
            this.debugNearbyIds(startPos);
        }

        cluster.forEach((pos) => this.scannedBlocks[oreKey].add(this.posKey(pos)));
        this.veins[oreKey].push(cluster);

        this.dirty = true;
        this.saveToDisk();

        const name = ORE_TYPES[oreKey].name;
        const totalBlocks = this.scannedBlocks[oreKey].size;
        Chat.message(`&aCaptured ${cluster.length} ${name} blocks. Saved ${totalBlocks} total ${name} blocks.`);
    }

    scanVein(startPos, oreKey) {
        const ids = this.oreIdSets[oreKey];
        if (!ids) return [];

        const found = [];
        const visited = new Set(); // positions we've fully processed
        const queued = new Set(); // positions we've enqueued for processing
        const queue = [startPos];
        queued.add(this.posKey(startPos));
        let head = 0;
        let hitLimit = false;

        while (head < queue.length) {
            if (found.length >= this.maxBlocksPerScan) {
                hitLimit = true;
                break;
            }

            const pos = queue[head++];
            const posId = this.posKey(pos);
            if (visited.has(posId) || this.scannedBlocks[oreKey].has(posId)) continue;
            visited.add(posId);

            const block = World.getBlockAt(pos.x, pos.y, pos.z);
            const id = block?.type?.getID();
            if (!ids.has(id)) continue;

            found.push(pos);

            for (let i = 0; i < this.neighborOffsets.length; i++) {
                const nx = pos.x + this.neighborOffsets[i][0];
                const ny = pos.y + this.neighborOffsets[i][1];
                const nz = pos.z + this.neighborOffsets[i][2];
                const neighborPos = { x: nx, y: ny, z: nz };
                const neighborKey = this.posKey(neighborPos);

                if (visited.has(neighborKey) || queued.has(neighborKey) || this.scannedBlocks[oreKey].has(neighborKey)) continue;

                const neighborBlock = World.getBlockAt(nx, ny, nz);
                const neighborId = neighborBlock?.type?.getID();

                if (ids.has(neighborId)) {
                    queued.add(neighborKey);
                    queue.push(neighborPos);
                }
            }
        }

        if (hitLimit) {
            Chat.message(`&eReached scan limit (${this.maxBlocksPerScan}) for this vein. Some blocks may be missing.`);
        }

        return found;
    }

    debugNearbyIds(center, radius = 2) {
        const counts = {};
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const bx = center.x + dx;
                    const by = center.y + dy;
                    const bz = center.z + dz;
                    const block = World.getBlockAt(bx, by, bz);
                    const id = block?.type?.getID();
                    if (typeof id !== 'number') continue;
                    counts[id] = (counts[id] || 0) + 1;
                }
            }
        }

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([id, cnt]) => `${id}x${cnt}`)
            .join(', ');

        if (sorted.length > 0) {
            Chat.message(`&eNearby block IDs (r=${radius}): ${sorted}`);
        }
    }

    saveToDisk(force) {
        if (!this.dirty && !force) return;

        Utils.writeConfigFile(this.fileName, this.veins);
        this.dirty = false;
    }

    renderVeins() {
        const player = Player.getPlayer();
        if (!player) return;

        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();

        Object.keys(this.veins).forEach((oreKey) => {
            const config = ORE_TYPES[oreKey];
            if (!config) return;

            const fill = config.colors.fill;
            const edge = config.colors.edge;
            const veins = this.veins[oreKey] || [];

            // Find the closest three veins for this ore type
            const ranked = veins
                .filter((vein) => Array.isArray(vein) && vein.length > 0)
                .map((vein) => {
                    let best = Infinity;
                    for (const pos of vein) {
                        const dx = pos.x + 0.5 - px;
                        const dy = pos.y + 0.5 - py;
                        const dz = pos.z + 0.5 - pz;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        if (distSq < best) best = distSq;
                    }
                    return { vein, distSq: best };
                })
                .sort((a, b) => a.distSq - b.distSq)
                .slice(0, 3);

            ranked.forEach(({ vein }) => {
                vein.forEach((pos) => {
                    const dx = pos.x + 0.5 - px;
                    const dy = pos.y + 0.5 - py;
                    const dz = pos.z + 0.5 - pz;

                    if (dx * dx + dy * dy + dz * dz > this.renderDistanceSq) return;

                    RenderUtils.drawStyledBox(new Vec3d(pos.x, pos.y, pos.z), fill, edge, 3, false);
                });
            });
        });
    }

    totalVeins() {
        return Object.values(this.veins || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
    }

    onEnable() {
        Chat.message(`&aOre vein recorder enabled. ${this.totalVeins()} saved veins loaded.`);
    }

    onDisable() {
        this.saveToDisk();
        Chat.message('&cOre vein recorder disabled.');
    }
}

const oreVeinRecorder = new OreVeinRecorder();

register('command', () => {
    oreVeinRecorder.toggle();
}).setName('orevein');
