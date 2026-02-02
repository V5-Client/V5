import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { MiningBot } from './MiningBot';
import { Veins } from './GlaciteData';
import Pathfinder from '../../utils/pathfinder/PathFinder';

// TODO:
// Optimise shitcode
// Check if vein is mined already
// find new vein after it mines current one
// Add more stuff to the TODO list

class TunnelsMiner extends ModuleBase {
    constructor() {
        super({
            name: 'Tunnels Miner',
            subcategory: 'Mining',
            description: 'Pathfind to recorded tunnels veins and hand off to MiningBot',
            tooltip: 'Select an ore type, find the closest vein edge, path, then mine.',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });

        this.bindToggleKey();

        this.oreTypes = Object.keys(Veins); // glacite,peridot,umber,tungsten,aquamarine,onyx,citrine
        this.selectedOres = [this.oreTypes[0]]; // glacite
        this.botManaged = false;
        this.veinDataCache = new Map();

        this.edgeOffsets = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];
        this.neighborOffsets = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];

        this.addMultiToggle(
            'Ore Type',
            this.oreTypes,
            false,
            (value) => this.setSelectedOres(value),
            'Select which ore type to scan for.',
            this.selectedOres[0]
        );

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => (this.botManaged ? 'Mining' : 'Pathing'),
                    Ore: () => (this.selectedOres.length ? this.selectedOres.join(', ') : 'None'),
                },
            },
        ]);

        this.on('worldUnload', () => this.stopAll());
    }

    onEnable() {
        this.startPathfind();
    }

    onDisable() {
        this.stopAll();
    }

    setSelectedOres(value) {
        this.selectedOres = [...new Set(value.filter((entry) => entry.enabled).map((entry) => entry.name))];
    }

    stopAll() {
        Pathfinder.resetPath();
        if (this.botManaged) {
            MiningBot.toggle(false, true);
            MiningBot.isParentManaged = false;
        }
        this.botManaged = false;
    }

    startPathfind() {
        const scan = this.scanForVeins(this.selectedOres);
        if (!scan?.targets?.length) {
            Chat.message('&cNo reachable veins found.');
            return;
        }

        const ends = scan.targets.map((target) => [target.candidate.x, target.candidate.y - 1, target.candidate.z]);
        Chat.message(`&bPathing to best target (${scan.targets.length} options)...`);

        const callback = (success) => {
            if (!success) {
                return Chat.message('&cPathfinding failed.');
            }
            this.onPathSuccess();
        };

        Pathfinder.findPath(ends, callback, false);
    }

    onPathSuccess() {
        MiningBot.setCost(MiningBot.tunnelCosts);
        MiningBot.toggle(true, true);
        this.botManaged = true;
    }

    scanForVeins(ores) {
        const oreList = Array.isArray(ores) ? ores : [ores];
        const validOres = oreList.filter((ore) => ore && Veins[ore]);
        if (!validOres.length) {
            return { ores: oreList, targets: [] };
        }

        const targets = [];
        const passableCache = new Map();

        validOres.forEach((ore) => {
            const veins = Veins[ore];
            veins.forEach((vein, index) => {
                const { veinSet, edgeBlocks, veinBlocks } = this.getVeinData(ore, index, vein);
                const candidates = this.getVeinCandidates(edgeBlocks, veinSet, passableCache);

                if (!candidates.length) return

                candidates.forEach((candidate) => {
                    targets.push({
                        ore,
                        veinIndex: index,
                        candidate,
                        veinBlocks,
                    });
                });
            });
        });

        if (targets.length === 0) {
            return { ores: validOres, targets: [] };
        }

        return { ores: validOres, targets };
    }

    getEdgeBlocks(vein, veinSet) {
        const edges = [];
        for (let i = 0; i < vein.length; i++) {
            const [x, y, z] = vein[i];
            for (const [dx, dy, dz] of this.edgeOffsets) {
                const key = this.posKey(x + dx, y + dy, z + dz);
                if (!veinSet.has(key)) {
                    edges.push({ x, y, z });
                    break;
                }
            }
        }
        return edges;
    }

    getVeinCandidates(edgeBlocks, veinSet, passableCache) {
        const checked = new Map();
        const candidates = [];

        for (const edge of edgeBlocks) {
            for (const [dx, , dz] of this.neighborOffsets) {
                const start = { x: edge.x + dx, y: edge.y, z: edge.z + dz };
                const key = this.posKey(start.x, start.y, start.z);
                if (checked.has(key)) continue;

                const candidate = this.findStandPosition(start, veinSet, passableCache);
                checked.set(key, candidate);
                if (!candidate?.valid) continue;
                candidates.push(candidate.pos);
            }
        }

        return candidates;
    }

    findStandPosition(start, veinSet, passableCache) {
        if (veinSet.has(this.posKey(start.x, start.y, start.z))) return false

        let groundY = null;
        let stepDown = 0;

        for (let i = 0; i <= 4; i++) {
            const y = start.y - i;
            const blockVec = { x: start.x, y, z: start.z };

            if (this.isPassable(blockVec, passableCache)) continue;

            groundY = y;
            stepDown = start.y - (y + 1);
            break;
        }

        if (groundY === null) return false

        const standPos = { x: start.x, y: groundY + 1, z: start.z };
        if (veinSet.has(this.posKey(standPos.x, standPos.y, standPos.z))) return false

        if (!this.hasClearance(standPos, passableCache)) return false

        return { valid: true, pos: standPos };
    }

    isPassable(blockVec, passableCache) {
        const cacheKey = this.posKey(blockVec.x, blockVec.y, blockVec.z);
        if (passableCache?.has(cacheKey)) return passableCache.get(cacheKey);

        const block = World.getBlockAt(blockVec.x, blockVec.y, blockVec.z);
        if (block.type.getRegistryName() === 'minecraft:snow') {
            passableCache?.set(cacheKey, true);
            return true;
        }

        const result = Pathfinder.isBlockWalkable(blockVec.x, blockVec.y, blockVec.z);
        passableCache?.set(cacheKey, result);
        return result;
    }

    hasClearance(standPos, passableCache) {
        for (let i = 0; i < 3; i++) {
            const vec = { x: standPos.x, y: standPos.y + i, z: standPos.z };
            if (!this.isPassable(vec, passableCache)) return false;
        }
        return true;
    }

    posKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    getVeinData(ore, index, vein) {
        const key = `${ore}:${index}`;
        const cached = this.veinDataCache.get(key);
        if (cached?.veinRef === vein) return cached;

        const veinSet = new Set(vein.map((b) => this.posKey(b[0], b[1], b[2])));
        const edgeBlocks = this.getEdgeBlocks(vein, veinSet);
        const veinBlocks = vein.map((b) => ({ x: b[0], y: b[1], z: b[2] }));

        const data = { veinSet, edgeBlocks, veinBlocks, veinRef: vein };
        this.veinDataCache.set(key, data);
        return data;
    }
}

export const tunnelsMiner = new TunnelsMiner();
