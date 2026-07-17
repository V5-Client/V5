import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Veins } from './GlaciteData';
import { MiningBot } from './MiningBot';

const PATH_ARRIVAL_RADIUS = 0.75;

class TunnelsMiner extends ModuleBase {
    constructor() {
        super({
            name: 'Tunnels Miner',
            subcategory: 'Mining',
            developerMode: true,
            description: 'Pathfind to recorded tunnels veins and hand off to MiningBot',
            tooltip: 'Select an ore type, find the closest vein edge, path, then mine.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });

        this.bindToggleKey();

        this.oreTypes = Object.keys(Veins); // glacite,peridot,umber,tungsten,aquamarine,onyx,citrine
        this.selectedOres = [this.oreTypes[0]]; // glacite
        this.travelMode = 'Walk';
        this.coldThreshold = 20;
        this.waitingForCold = false;
        this.botManaged = false;
        this.botStartedWork = false;
        this.botIdleTicks = 0;
        this.activeMiningPosition = null;
        this.pendingTargets = [];
        this.exhaustedPositions = new Set();
        this.veinDataCache = new Map();

        this.edgeOffsets = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];
        this.neighborOffsets = [];
        for (let x = -4; x <= 4; x++) {
            for (let z = -4; z <= 4; z++) {
                if ((x || z) && Math.hypot(x, z) <= 4) this.neighborOffsets.push([x, 0, z]);
            }
        }
        this.neighborOffsets.sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]));

        this.addMultiToggle(
            'Ore Type',
            this.oreTypes,
            false,
            (value) => this.setSelectedOres(value),
            'Select which ore type to scan for.',
            this.selectedOres[0]
        );

        this.addSlider('Cold Warp Threshold', 10, 90, this.coldThreshold, (value) => (this.coldThreshold = value));

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
        this.on('worldUnload', () => {
            this.exhaustedPositions.clear();
            this.stopAll();
            if (!this.waitingForCold) this.toggle(false);
        });
    }

    onEnable() {
        this.exhaustedPositions.clear();
        this.startPathfind();
    }

    onDisable() {
        this.waitingForCold = false;
        this.stopAll();
        this.exhaustedPositions.clear();
    }

    setSelectedOres(value) {
        return this.setSelectedOreNames(value.filter((entry) => entry.enabled).map((entry) => entry.name));
    }

    setSelectedOreNames(ores) {
        const nextOres = Array.isArray(ores) ? [...new Set(ores.filter((ore) => this.oreTypes.includes(ore)))] : [];
        if (nextOres.some((ore) => !this.selectedOres.includes(ore)) || this.selectedOres.some((ore) => !nextOres.includes(ore))) {
            this.exhaustedPositions.clear();
        }
        this.selectedOres = nextOres;
        return this.selectedOres;
    }

    restart() {
        if (!this.enabled) return;
        this.stopAll();
        this.startPathfind(true);
    }

    setTravelMode(mode) {
        this.travelMode = mode === 'Etherwarp' ? mode : 'Walk';
    }

    onTick() {
        if (!Player.getPlayer()) return;
        if (!this.isParentManaged && this.handleCold()) return;
        if (!this.botManaged) return;
        if (MiningBot.enabled) {
            this.forceTunnelMiningBotCosts();
        }

        const hasActiveWork = MiningBot.isScanning() || MiningBot.currentTarget || MiningBot.foundLocations.length > 0;
        if (hasActiveWork) {
            this.botStartedWork = true;
            this.botIdleTicks = 0;
            return;
        }

        if (MiningBot.enabled && MiningBot.state !== MiningBot.STATES.MINING) {
            return;
        }

        if (!this.botStartedWork && ++this.botIdleTicks < 10) return;

        if (this.activeMiningPosition)
            this.exhaustedPositions.add(this.posKey(this.activeMiningPosition.x, this.activeMiningPosition.y, this.activeMiningPosition.z));
        this.exhaustedPositions.add(this.posKey(Math.floor(Player.getX()), Math.floor(Player.getY()), Math.floor(Player.getZ())));

        MiningBot.toggle(false, true);
        this.botManaged = false;
        this.botStartedWork = false;
        this.botIdleTicks = 0;
        this.activeMiningPosition = null;
        this.startPathfind(true);
    }

    handleCold() {
        const cold = MiningUtils.getDebuff('cold');
        if (this.waitingForCold) {
            if (cold > 0) return true;

            this.waitingForCold = false;
            this.message('&aCold reached 0, resuming...');
            this.startPathfind(true);
            return true;
        }

        if (cold <= this.coldThreshold) return false;

        this.waitingForCold = true;
        this.stopAll();
        this.message(`&eCold exceeded ${this.coldThreshold}, warping to camp...`);
        ChatLib.command('warp camp');
        return true;
    }

    stopAll() {
        EtherwarpPathfinder.cancel(true);
        Pathfinder.resetPath();
        if (this.botManaged) {
            MiningBot.toggle(false, true);
            MiningBot.isParentManaged = false;
        }
        this.botManaged = false;
        this.botStartedWork = false;
        this.botIdleTicks = 0;
        this.activeMiningPosition = null;
        this.pendingTargets = [];
    }

    startPathfind(requireMovement = false) {
        this.pendingTargets = [];
        const scan = this.scanForVeins(this.selectedOres);
        if (!scan?.targets?.length) {
            this.message('&cNo reachable veins found.');
            return;
        }

        this.pendingTargets = scan.targets.filter((target) => {
            const { candidate } = target;
            if (this.exhaustedPositions.has(this.posKey(candidate.x, candidate.y, candidate.z))) return false;
            const end = [candidate.x + 0.5, candidate.y - 1, candidate.z + 0.5];
            if (!requireMovement || !Player.getPlayer()?.onGround()) return true;
            const heightDifference = Player.getY() - end[1];
            return Math.hypot(Player.getX() - end[0], Player.getZ() - end[2]) > PATH_ARRIVAL_RADIUS || heightDifference < -0.1 || heightDifference > 5.5;
        });
        const ends = this.pendingTargets.map((target) => {
            const { candidate } = target;
            return [candidate.x + 0.5, candidate.y - 1, candidate.z + 0.5];
        });
        if (!ends.length) {
            this.pendingTargets = [];
            this.message('&cNo new mining position found.');
            return;
        }
        this.message(`&bPathing to best target (${ends.length} options)...`);

        if (this.travelMode === 'Etherwarp') {
            let walking = false;
            const fallback = () => {
                if (walking || !this.pendingTargets.length) return;
                walking = true;
                this.startWalkPath(ends);
            };
            const started = EtherwarpPathfinder.findPath(ends, {
                silent: true,
                onSuccess: () => this.onPathSuccess(),
                onFail: fallback,
            });
            if (!started) fallback();
            return;
        }

        this.startWalkPath(ends);
    }

    startWalkPath(ends) {
        Pathfinder.findPath(
            ends,
            (success) => {
                if (!success) {
                    this.pendingTargets = [];
                    this.message('&cPathfinding failed.');
                    return;
                }

                this.onPathSuccess();
            },
            false,
            null,
            false,
            PATH_ARRIVAL_RADIUS
        );
    }

    onPathSuccess() {
        this.activeMiningPosition = this.pendingTargets.reduce((closest, target) => {
            if (!closest) return target.candidate;
            const targetDistance = Math.hypot(
                Player.getX() - (target.candidate.x + 0.5),
                Player.getY() - target.candidate.y,
                Player.getZ() - (target.candidate.z + 0.5)
            );
            const closestDistance = Math.hypot(Player.getX() - (closest.x + 0.5), Player.getY() - closest.y, Player.getZ() - (closest.z + 0.5));
            return targetDistance < closestDistance ? target.candidate : closest;
        }, null);
        this.pendingTargets = [];
        MiningBot.toggle(true, true);
        this.forceTunnelMiningBotCosts();
        this.botManaged = true;
        this.botStartedWork = false;
        this.botIdleTicks = 0;
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
                const { veinBlocks } = this.getVeinData(ore, index, vein);
                const remainingBlocks = veinBlocks.filter((block) => this.isOreBlock(block, ore));
                if (!remainingBlocks.length) return;

                const veinSet = new Set(remainingBlocks.map((block) => this.posKey(block.x, block.y, block.z)));
                const edgeBlocks = this.getEdgeBlocks(remainingBlocks, veinSet);
                const candidates = this.getVeinCandidates(edgeBlocks, veinSet, passableCache);
                if (!candidates.length) return;

                candidates.forEach((candidate) => {
                    targets.push({
                        ore,
                        veinIndex: index,
                        candidate,
                        veinBlocks: remainingBlocks,
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
        for (const block of vein) {
            const { x, y, z } = Array.isArray(block) ? { x: block[0], y: block[1], z: block[2] } : block;
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
        const accepted = new Set();
        const candidates = [];

        for (const edge of edgeBlocks) {
            for (const [dx, , dz] of this.neighborOffsets) {
                const start = { x: edge.x + dx, y: edge.y, z: edge.z + dz };
                const key = this.posKey(start.x, start.y, start.z);
                let candidate = checked.get(key);
                if (candidate === undefined) {
                    candidate = this.findStandPosition(start, veinSet, passableCache);
                    checked.set(key, candidate);
                }
                if (!candidate?.valid) continue;
                const candidateKey = this.posKey(candidate.pos.x, candidate.pos.y, candidate.pos.z);
                if (accepted.has(candidateKey) || !this.canMineBlockFrom(candidate.pos, edge)) continue;
                accepted.add(candidateKey);
                candidates.push(candidate.pos);
            }
        }

        return candidates;
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
        if (veinSet.has(this.posKey(start.x, groundY, start.z))) return false;

        const standPos = { x: start.x, y: groundY + 1, z: start.z };
        if (veinSet.has(this.posKey(standPos.x, standPos.y, standPos.z))) return false;

        if (!this.hasClearance(standPos, passableCache)) return false;

        return { valid: true, pos: standPos };
    }

    canMineBlockFrom(standPos, block) {
        const eyeHeight = Player.getPlayer()?.getEyeHeight?.() || 1.62;
        const eyePos = new Vec3d(standPos.x + 0.5, standPos.y + eyeHeight, standPos.z + 0.5);
        const maxReachSq = MiningBot.mineReach * MiningBot.mineReach;

        return MiningBot.findVisibleAimPoint(block.x, block.y, block.z, eyePos, null, maxReachSq, false) !== null;
    }

    isPassable(blockVec, passableCache) {
        const cacheKey = this.posKey(blockVec.x, blockVec.y, blockVec.z);
        if (passableCache?.has(cacheKey)) return passableCache.get(cacheKey);

        const block = World.getBlockAt(blockVec.x, blockVec.y, blockVec.z);
        const registryName = block?.type?.getRegistryName?.();
        if (registryName === 'minecraft:snow') {
            passableCache?.set(cacheKey, true);
            return true;
        }

        if (!block?.type) {
            passableCache?.set(cacheKey, false);
            return false;
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

    isOreBlock(block, ore) {
        const blockName = World.getBlockAt(block.x, block.y, block.z)?.type?.getRegistryName?.() || '';
        return MiningBot.tunnelOreCosts?.[ore]?.[blockName] != null;
    }

    forceTunnelMiningBotCosts() {
        MiningBot.selectedTypeName = 'Tunnel';
        MiningBot.setCost(MiningBot.getTunnelCostsForOres(this.selectedOres));
    }

    posKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    getVeinData(ore, index, vein) {
        const key = `${ore}:${index}`;
        const cached = this.veinDataCache.get(key);
        if (cached?.veinRef === vein) return cached;

        const veinBlocks = vein.map((block) => ({ x: block[0], y: block[1], z: block[2] }));

        const data = { veinBlocks, veinRef: vein };
        this.veinDataCache.set(key, data);
        return data;
    }
}

export const tunnelsMiner = isDeveloperModeEnabled() ? new TunnelsMiner() : null;
