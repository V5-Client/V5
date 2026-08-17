import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { executeAsync, scheduleClient } from '../../utils/ThreadExecutor';

const TREE_TYPES = {
    Fig: {
        block: new BlockType('minecraft:stripped_spruce_wood'),
        bounds: {
            minX: -769,
            minY: 110,
            minZ: -92,
            maxX: -531,
            maxY: 151,
            maxZ: 100,
        },
    },
    Mangrove: {
        block: new BlockType('minecraft:mangrove_wood'),
        bounds: {
            minX: -739,
            minY: 84,
            minZ: -88,
            maxX: -583,
            maxY: 117,
            maxZ: 105,
        },
    },
};
const NEIGHBOR_OFFSETS = [];

for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx || dy || dz) NEIGHBOR_OFFSETS.push([dx, dy, dz]);
        }
    }
}

class TreeESP extends ModuleBase {
    constructor() {
        super({
            name: 'Tree ESP',
            subcategory: 'Foraging',
            description: 'Highlights trees in the selected grove.',
        });

        this.trees = [];
        this.scanActive = false;
        this.scanToken = 0;
        this.treeType = TREE_TYPES.Fig;
        this.addMultiToggle(
            'Tree Type',
            Object.keys(TREE_TYPES),
            true,
            (options) => {
                this.treeType = TREE_TYPES[options.find((option) => option.enabled)?.name] || TREE_TYPES.Fig;
                this.trees = [];
            },
            'Select which grove to scan.',
            'Fig'
        );
        this.on('step', () => {
            this.scan();
        }).setDelay(1);
        this.when(
            () => this.enabled && this.trees.length > 0,
            'postRenderWorld',
            () => this.render()
        );
        this.on('worldUnload', () => (this.trees = []));
    }

    scan() {
        if (!this.enabled || !World.isLoaded()) {
            this.trees = [];
            return;
        }
        if (this.scanActive) return;

        this.scanActive = true;
        const token = ++this.scanToken;
        const treeType = this.treeType;
        const { block, bounds } = treeType;
        const blocks = World.getBlocksInBox(bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ, [block]).map(({ x, y, z }) => ({
            x,
            y,
            z,
        }));

        const submitted = executeAsync((generation) => {
            const remaining = new Map(blocks.map((entry) => [`${entry.x},${entry.y},${entry.z}`, entry]));

            const trees = [];

            while (remaining.size) {
                const startBlock = remaining.values().next().value;
                const tree = [startBlock];
                remaining.delete(`${startBlock.x},${startBlock.y},${startBlock.z}`);

                for (let i = 0; i < tree.length; i++) {
                    const pos = tree[i];
                    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
                        const key = `${pos.x + dx},${pos.y + dy},${pos.z + dz}`;
                        const neighbor = remaining.get(key);
                        if (!neighbor) continue;
                        remaining.delete(key);
                        tree.push(neighbor);
                    }
                }

                trees.push(tree);
            }

            scheduleClient(
                () => {
                    if (this.enabled && World.isLoaded() && token === this.scanToken && this.treeType === treeType) this.trees = trees;
                    if (token === this.scanToken) this.scanActive = false;
                },
                0,
                generation
            );
        });
        if (!submitted) this.scanActive = false;
    }

    render() {
        this.trees.forEach((tree, index) => {
            const hue = (index * 360) / this.trees.length;
            const color = new RenderColor(
                128 + 127 * Math.sin((hue * Math.PI) / 180),
                128 + 127 * Math.sin(((hue + 120) * Math.PI) / 180),
                128 + 127 * Math.sin(((hue + 240) * Math.PI) / 180),
                100
            );
            tree.forEach((block) => Render3D.drawSizedBox(new Vec3d(block.x + 0.5, block.y, block.z + 0.5), 1, 1, 1, color, true, 1, true));
        });
    }

    onDisable() {
        this.scanToken++;
        this.scanActive = false;
        this.trees = [];
    }
}

new TreeESP();
