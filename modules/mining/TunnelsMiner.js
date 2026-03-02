//@VIP
import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Veins } from './GlaciteData';
import { MiningBot } from './MiningBot';

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
        this.targets = [];
        this.targetIndex = -1;
        this.currentTarget = null;
        this.completedVeins = new Set();

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

        this.on('tick', () => this.onTick());
        this.on('worldUnload', () => this.stopAll());
    }

    onEnable() {
        MiningBot.setCost(MiningBot.tunnelCosts);
        this.buildTargetQueue();
        this.pathfindNextTarget();
    }

    onDisable() {
        this.stopAll();
    }

    setSelectedOres(value) {
        this.selectedOres = [...new Set(value.filter((entry) => entry.enabled).map((entry) => entry.name))];
    }

    onTick() {
        if (!this.botManaged) return;
        if (MiningBot.foundLocations.length > 0) return;

        MiningBot.toggle(false, true);
        this.botManaged = false;
        if (this.currentTarget?.veinKey) this.completedVeins.add(this.currentTarget.veinKey);
        this.pathfindNextTarget();
    }

    stopAll() {
        Pathfinder.resetPath();
        if (this.botManaged) {
            MiningBot.toggle(false, true);
            MiningBot.isParentManaged = false;
        }
        this.botManaged = false;
        this.targets = [];
        this.targetIndex = -1;
        this.currentTarget = null;
        this.completedVeins.clear();
    }

    buildTargetQueue() {
        const scan = this.scanForVeins(this.selectedOres);
        if (!scan?.targets?.length) {
            this.targets = [];
            this.targetIndex = -1;
            return;
        }

        this.targets = scan.targets.filter((target) => !this.completedVeins.has(target.veinKey));
        this.targetIndex = -1;
    }

    pathfindNextTarget() {
        if (!this.enabled) return;

        while (true) {
            this.targetIndex++;

            if (this.targetIndex >= this.targets.length) {
                this.buildTargetQueue();
                if (!this.targets.length) {
                    Chat.message('&cNo reachable veins found.');
                    return;
                }
                this.targetIndex++;
            }

            const target = this.targets[this.targetIndex];
            if (!target) {
                Chat.message('&cNo reachable veins found.');
                return;
            }

            this.currentTarget = target;
            Chat.message(`&bPathing to ${target.ore} vein...`);
            const end = [[target.candidate.x, target.candidate.y - 1, target.candidate.z]];

            Pathfinder.findPath(
                end,
                (success) => {
                    if (!this.enabled) return;
                    if (!success) {
                        if (this.currentTarget?.veinKey) this.completedVeins.add(this.currentTarget.veinKey);
                        return this.pathfindNextTarget();
                    }
                    this.onPathSuccess();
                },
                false
            );

            return;
        }
    }

    onPathSuccess() {
        if (!this.currentTarget) return;

        const didStart = MiningBot.populateLocations(this.currentTarget.veinBlocks, true);
        if (!didStart || MiningBot.foundLocations.length === 0) {
            MiningBot.toggle(false, true);
            if (this.currentTarget.veinKey) this.completedVeins.add(this.currentTarget.veinKey);
            this.botManaged = false;
            this.pathfindNextTarget();
            return;
        }

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
                const candidate = this.getFirstVeinCandidate(edgeBlocks, veinSet, passableCache);
                if (!candidate) return;

                targets.push({
                    ore,
                    veinIndex: index,
                    veinKey: `${ore}:${index}`,
                    candidate,
                    veinBlocks,
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
        for (const [x, y, z] of vein) {
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

    getFirstVeinCandidate(edgeBlocks, veinSet, passableCache) {
        const checked = new Map();

        for (const edge of edgeBlocks) {
            for (const [dx, , dz] of this.neighborOffsets) {
                const start = { x: edge.x + dx, y: edge.y, z: edge.z + dz };
                const key = this.posKey(start.x, start.y, start.z);
                if (checked.has(key)) continue;

                const candidate = this.findStandPosition(start, veinSet, passableCache);
                checked.set(key, candidate);
                if (!candidate?.valid) continue;
                return candidate.pos;
            }
        }

        return null;
    }

    findStandPosition(start, veinSet, passableCache) {
        if (veinSet.has(this.posKey(start.x, start.y, start.z))) return false;

        let groundY = null;

        for (let i = 0; i <= 4; i++) {
            const y = start.y - i;
            const blockVec = { x: start.x, y, z: start.z };

            if (this.isPassable(blockVec, passableCache)) continue;

            groundY = y;
            break;
        }

        if (groundY === null) return false;

        const standPos = { x: start.x, y: groundY + 1, z: start.z };
        if (veinSet.has(this.posKey(standPos.x, standPos.y, standPos.z))) return false;

        if (!this.hasClearance(standPos, passableCache)) return false;

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
