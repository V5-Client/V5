import { BP, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { executeAsync } from '../../utils/ThreadExecutor';

const TREE_TYPES = {
    Fig: {
        block: new BlockType('minecraft:stripped_spruce_wood'),
        bounds: { minX: -769, minY: 110, minZ: -92, maxX: -531, maxY: 151, maxZ: 100 },
    },
    Mangrove: {
        block: new BlockType('minecraft:mangrove_wood'),
        bounds: { minX: -739, minY: 84, minZ: -88, maxX: -583, maxY: 117, maxZ: 105 },
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
        executeAsync(() => {
            if (!this.enabled || !World.isLoaded()) return (this.trees = []);

            const treeType = this.treeType;
            const { block, bounds } = treeType;
            const blocks = World.getBlocksInBox(bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ, [block]);
            const remaining = new java.util.HashMap();
            for (const block of blocks) remaining.put(new BP(block.x, block.y, block.z), block);

            const trees = [];

            while (!remaining.isEmpty()) {
                const entry = remaining.entrySet().iterator().next();
                const startPos = entry.getKey();
                const startBlock = entry.getValue();
                const tree = [startBlock];
                const positions = [startPos];
                remaining.remove(startPos);

                for (let i = 0; i < tree.length; i++) {
                    const pos = positions[i];
                    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
                        const neighborPos = pos.offset(dx, dy, dz);
                        const neighbor = remaining.remove(neighborPos);
                        if (!neighbor) continue;
                        tree.push(neighbor);
                        positions.push(neighborPos);
                    }
                }

                trees.push(tree);
            }

            if (this.enabled && World.isLoaded() && this.treeType === treeType) this.trees = trees;
        });
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
            Render3D.drawFilledBoxes(tree.map((block) => new Vec3d(block.x, block.y, block.z)), color, true);
        });
    }

    onDisable() {
        this.trees = [];
    }
}

new TreeESP();
