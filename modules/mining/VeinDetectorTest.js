//@Private
// Vibecoded slop, the logic itself is VERY simple and i love the centers that come out of this.
// I love this
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import Render from '../../utils/render/Render';
import { v5Command } from '../../utils/V5Commands';

const TARGET_BLOCKS = {
    mithril: [
        'minecraft:light_blue_wool',
        'minecraft:prismarine',
        'minecraft:prismarine_bricks',
        'minecraft:dark_prismarine',
        'minecraft:gray_wool',
        'minecraft:cyan_terracotta',
    ],
    titanium: ['minecraft:polished_diorite'],
    glacite: ['minecraft:packed_ice'],
    umber: ['minecraft:smooth_red_sandstone', 'minecraft:terracotta', 'minecraft:brown_terracotta'],
    tungsten: ['minecraft:clay', 'minecraft:infested_cobblestone'],
    aquamarine: ['minecraft:blue_stained_glass', 'minecraft:blue_stained_glass_pane'],
    peridot: ['minecraft:green_stained_glass', 'minecraft:green_stained_glass_pane'],
    onyx: ['minecraft:black_stained_glass', 'minecraft:black_stained_glass_pane'],
    citrine: ['minecraft:brown_stained_glass', 'minecraft:brown_stained_glass_pane'],
    amber: ['minecraft:orange_stained_glass', 'minecraft:orange_stained_glass_pane'],
    amethyst: ['minecraft:purple_stained_glass', 'minecraft:purple_stained_glass_pane'],
    jade: ['minecraft:lime_stained_glass', 'minecraft:lime_stained_glass_pane'],
    jasper: ['minecraft:magenta_stained_glass', 'minecraft:magenta_stained_glass_pane'],
    ruby: ['minecraft:red_stained_glass', 'minecraft:red_stained_glass_pane'],
    sapphire: ['minecraft:light_blue_stained_glass', 'minecraft:light_blue_stained_glass_pane'],
    topaz: ['minecraft:yellow_stained_glass', 'minecraft:yellow_stained_glass_pane'],
    coal: ['minecraft:coal_block'],
    quartz: ['minecraft:quartz_block'],
    iron: ['minecraft:iron_block'],
    redstone: ['minecraft:redstone_block'],
    gold: ['minecraft:gold_block'],
    diamond: ['minecraft:diamond_block'],
    emerald: ['minecraft:emerald_block'],
};

const NEIGHBOR_OFFSETS = [];
for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
            if (x === 0 && y === 0 && z === 0) continue;
            NEIGHBOR_OFFSETS.push([x, y, z]);
        }
    }
}

class VeinDetectorTest extends ModuleBase {
    constructor() {
        super({
            name: 'Vein Detector',
            subcategory: 'Mining',
            description: 'Temporary vein detector and stand-point visualizer.',
            tooltip: 'Testing helper for vein detection.',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.scanRadius = 18;
        this.maxVeinSize = 200;
        this.targetType = null;
        this.targetBlockSet = null;
        this.detectedVein = [];
        this.detectedVeinSet = new Set();
        this.detectedSeed = null;
        this.veinCentroid = null;
        this.standPoint = null;
        this.lastScanSummary = '';
        this.lastNoVeinMessageAt = 0;

        this.blockFillColor = Render.Color(80, 220, 255, 60);
        this.blockWireColor = Render.Color(80, 220, 255, 255);
        this.seedFillColor = Render.Color(255, 210, 80, 70);
        this.seedWireColor = Render.Color(255, 210, 80, 255);
        this.centerFillColor = Render.Color(90, 255, 120, 70);
        this.centerWireColor = Render.Color(90, 255, 120, 255);
        this.lineColor = Render.Color(255, 255, 255, 180);

        v5Command('veintest', (action) => this.handleCommand(action));

        this.on('step', () => {
            if (!this.enabled || !this.targetType || !Player.getPlayer() || !World.isLoaded()) return;
            this.scanVein();
        }).setDelay(5);

        this.on('postRenderWorld', () => this.renderVein());
    }

    handleCommand(action) {
        const normalized = String(action || '')
            .trim()
            .toLowerCase();
        if (!normalized) {
            this.message('&cUsage: /v5 mining veintest <' + Object.keys(TARGET_BLOCKS).join('|') + '|off|rescan|list>');
            return;
        }

        if (normalized === 'list') {
            this.message('&bSupported: &f' + Object.keys(TARGET_BLOCKS).join(', '));
            return;
        }

        if (normalized === 'off') {
            this.toggle(false);
            return;
        }

        if (normalized === 'rescan') {
            if (!this.enabled) {
                this.message('&cDetector is not enabled.');
                return;
            }
            this.scanVein(true);
            return;
        }

        const blocks = TARGET_BLOCKS[normalized];
        if (!blocks) {
            this.message('&cUnknown target type: &f' + normalized);
            return;
        }

        this.targetType = normalized;
        this.targetBlockSet = new Set(blocks);
        this.toggle(true);
        this.scanVein(true);
    }

    onEnable() {
        this.clearDetection();
        this.message('&aEnabled' + (this.targetType ? ' &7for &f' + this.targetType : ''));
    }

    onDisable() {
        this.clearDetection();
        this.message('&cDisabled');
    }

    clearDetection() {
        this.detectedVein = [];
        this.detectedVeinSet = new Set();
        this.detectedSeed = null;
        this.veinCentroid = null;
        this.standPoint = null;
        this.lastScanSummary = '';
    }

    scanVein(forceMessage = false) {
        if (!this.targetBlockSet?.size) return;

        const seed = this.findNearestTargetBlock();
        if (!seed) {
            this.clearDetection();
            const now = Date.now();
            if (forceMessage || now - this.lastNoVeinMessageAt > 3000) {
                this.message('&eNo ' + this.targetType + ' block found within ' + this.scanRadius + ' blocks.');
                this.lastNoVeinMessageAt = now;
            }
            return;
        }

        const vein = this.collectConnectedVein(seed);
        if (!vein.length) {
            this.clearDetection();
            return;
        }

        this.detectedSeed = seed;
        this.detectedVein = vein;
        this.detectedVeinSet = new Set(vein.map((block) => this.posKey(block.x, block.y, block.z)));
        this.veinCentroid = this.computeVeinCentroid(vein);
        this.standPoint = this.findBestStandPoint(vein, this.getStandSearchAnchor(vein));

        const standText = this.standPoint ? this.standPoint.x + ', ' + this.standPoint.y + ', ' + this.standPoint.z : 'none';
        const nextSummary = this.targetType + ':' + vein.length + ':' + standText;
        if (forceMessage || this.lastScanSummary !== nextSummary) {
            this.message('&b' + this.targetType + '&f vein: &a' + vein.length + ' blocks&f, stand point: &a' + standText);
            this.lastScanSummary = nextSummary;
        }
    }

    findNearestTargetBlock() {
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const minX = Math.floor(px - this.scanRadius);
        const maxX = Math.floor(px + this.scanRadius);
        const minY = Math.floor(py - this.scanRadius);
        const maxY = Math.floor(py + this.scanRadius);
        const minZ = Math.floor(pz - this.scanRadius);
        const maxZ = Math.floor(pz + this.scanRadius);
        const maxDistSq = this.scanRadius * this.scanRadius;

        let best = null;
        let bestDistSq = Infinity;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const dx = x + 0.5 - px;
                    const dy = y + 0.5 - py;
                    const dz = z + 0.5 - pz;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    if (distSq > maxDistSq || distSq >= bestDistSq) continue;

                    const blockName = World.getBlockAt(x, y, z)?.type?.getRegistryName?.();
                    if (!this.targetBlockSet.has(blockName)) continue;

                    best = { x, y, z, blockName };
                    bestDistSq = distSq;
                }
            }
        }

        return best;
    }

    collectConnectedVein(seed) {
        const queue = [seed];
        const visited = new Set([this.posKey(seed.x, seed.y, seed.z)]);
        const vein = [];

        while (queue.length && vein.length < this.maxVeinSize) {
            const block = queue.shift();
            const blockName = World.getBlockAt(block.x, block.y, block.z)?.type?.getRegistryName?.();
            if (!this.targetBlockSet.has(blockName)) continue;

            vein.push({ x: block.x, y: block.y, z: block.z, blockName });

            for (let i = 0; i < NEIGHBOR_OFFSETS.length; i++) {
                const [dx, dy, dz] = NEIGHBOR_OFFSETS[i];
                const nx = block.x + dx;
                const ny = block.y + dy;
                const nz = block.z + dz;
                const key = this.posKey(nx, ny, nz);
                if (visited.has(key)) continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, z: nz });
            }
        }

        return vein;
    }

    computeVeinCentroid(vein) {
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;

        for (let i = 0; i < vein.length; i++) {
            sumX += vein[i].x + 0.5;
            sumY += vein[i].y + 0.5;
            sumZ += vein[i].z + 0.5;
        }

        const count = vein.length || 1;
        return {
            x: sumX / count,
            y: sumY / count,
            z: sumZ / count,
        };
    }

    getStandSearchAnchor(vein) {
        if (this.targetType !== 'mithril') return this.veinCentroid;

        const seed = this.detectedSeed;
        if (!seed) return this.veinCentroid;

        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let count = 0;

        for (let i = 0; i < vein.length; i++) {
            const block = vein[i];
            const dx = block.x - seed.x;
            const dy = block.y - seed.y;
            const dz = block.z - seed.z;
            if (dx * dx + dz * dz > 49 || Math.abs(dy) > 4) continue;
            if (!this.isExposedVeinBlock(block)) continue;

            sumX += block.x + 0.5;
            sumY += block.y + 0.5;
            sumZ += block.z + 0.5;
            count++;
        }

        if (count === 0) return seed ? { x: seed.x + 0.5, y: seed.y + 0.5, z: seed.z + 0.5 } : this.veinCentroid;

        return {
            x: sumX / count,
            y: sumY / count,
            z: sumZ / count,
        };
    }

    isExposedVeinBlock(block) {
        for (let i = 0; i < NEIGHBOR_OFFSETS.length; i++) {
            const offset = NEIGHBOR_OFFSETS[i];
            if (!Pathfinder.isBlockWalkable(block.x + offset[0], block.y + offset[1], block.z + offset[2])) continue;
            return true;
        }

        return false;
    }

    findBestStandPoint(vein, anchor) {
        if (!vein.length || !anchor) return null;

        const centerX = Math.floor(anchor.x);
        const centerY = Math.floor(anchor.y);
        const centerZ = Math.floor(anchor.z);
        const desiredDistance = this.targetType === 'mithril' ? 1.35 : 2.5;
        const minDistanceSq = this.targetType === 'mithril' ? 1 : 4;
        let best = null;
        let bestScore = Infinity;

        for (let radius = 1; radius <= 8; radius++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                    const edge = Math.max(Math.abs(x - centerX), Math.abs(z - centerZ));
                    if (edge !== radius) continue;

                    for (let groundY = centerY - 6; groundY <= centerY + 4; groundY++) {
                        if (!this.isStandable(x, groundY, z)) continue;

                        const nearestVeinDist = this.getNearestVeinDistanceSq(x, groundY, z, vein);
                        if (nearestVeinDist < minDistanceSq) continue;

                        const dx = x + 0.5 - anchor.x;
                        const dz = z + 0.5 - anchor.z;
                        const horizDist = Math.hypot(dx, dz);
                        const score = Math.abs(horizDist - desiredDistance) * 5 + Math.abs(groundY + 1 - anchor.y) * 0.75 + horizDist;

                        if (score < bestScore) {
                            bestScore = score;
                            best = {
                                x,
                                y: groundY + 1,
                                z,
                            };
                        }
                    }
                }
            }

            if (best) return best;
        }

        return null;
    }

    isStandable(x, groundY, z) {
        if (this.detectedVeinSet.has(this.posKey(x, groundY + 1, z))) return false;
        if (Pathfinder.isBlockWalkable(x, groundY, z)) return false;
        if (!Pathfinder.isBlockWalkable(x, groundY + 1, z)) return false;
        if (!Pathfinder.isBlockWalkable(x, groundY + 2, z)) return false;
        return true;
    }

    getNearestVeinDistanceSq(x, groundY, z, vein) {
        let best = Infinity;

        for (let i = 0; i < vein.length; i++) {
            const dx = vein[i].x + 0.5 - (x + 0.5);
            const dy = vein[i].y + 0.5 - (groundY + 1.5);
            const dz = vein[i].z + 0.5 - (z + 0.5);
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq < best) best = distSq;
        }

        return best;
    }

    renderVein() {
        if (!this.enabled || !this.detectedVein.length) return;

        for (let i = 0; i < this.detectedVein.length; i++) {
            const block = this.detectedVein[i];
            Render.drawStyledBox(new Vec3d(block.x, block.y, block.z), this.blockFillColor, this.blockWireColor, 3, true);
        }

        if (this.detectedSeed) {
            Render.drawStyledBox(new Vec3d(this.detectedSeed.x, this.detectedSeed.y, this.detectedSeed.z), this.seedFillColor, this.seedWireColor, 4, true);
        }

        if (this.standPoint) {
            Render.drawStyledBox(new Vec3d(this.standPoint.x, this.standPoint.y, this.standPoint.z), this.centerFillColor, this.centerWireColor, 4, true);
            Render.drawText(
                this.targetType + ' center' + this.standPoint.x + ', ' + this.standPoint.y + ', ' + this.standPoint.z,
                new Vec3d(this.standPoint.x + 0.5, this.standPoint.y + 1.2, this.standPoint.z + 0.5),
                1,
                true,
                true,
                true
            );
        }

        if (this.standPoint && this.veinCentroid) {
            Render.drawLine(
                new Vec3d(this.standPoint.x + 0.5, this.standPoint.y + 0.5, this.standPoint.z + 0.5),
                new Vec3d(this.veinCentroid.x, this.veinCentroid.y, this.veinCentroid.z),
                this.lineColor,
                2,
                true
            );
        }
    }

    posKey(x, y, z) {
        return x + ',' + y + ',' + z;
    }
}

export const veinDetectorTest = new VeinDetectorTest();
