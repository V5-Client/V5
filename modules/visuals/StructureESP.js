//@VIP
import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { StructureFinder, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { BlockUpdateS2C, ChunkDataS2C } from '../../utils/Packets';
import Render from '../../utils/render/Render';
import { manager } from '../../utils/SkyblockEvents';

class StructureESP extends ModuleBase {
    constructor() {
        super({
            name: 'Structure ESP',
            subcategory: 'Visuals',
            description: 'Super quick Structure ESP',
        });

        this.on('packetReceived', (packet) => {
            const cx = packet?.getChunkX();
            const cz = packet?.getChunkZ();
            if (typeof cx !== 'number' || typeof cz !== 'number') return;
            setTimeout(() => {
                if (!this.enabled) return;
                StructureFinder.submitChunkScan(cx, cz);
            }, 50);
        }).setFilteredClass(ChunkDataS2C);

        this.on('packetReceived', (packet) => {
            const pos = packet?.getPos();
            if (!pos) return;
            StructureFinder.submitBlockUpdate(pos.getX(), pos.getY(), pos.getZ());
        }).setFilteredClass(BlockUpdateS2C);

        this.on('postRenderWorld', () => {
            this.render();
        });

        manager.subscribe('warp', () => {
            if (!this.enabled) return;
            console.log('Warp detected! Resetting module data...');
            StructureFinder.clear();
        });

        register('gameUnload', () => {
            StructureFinder.shutdown();
        });
    }

    render() {
        try {
            const blocks = StructureFinder.getRenderBlocksArray();
            if (!blocks || blocks.length < 3) return;

            for (let i = 0; i + 2 < blocks.length; i += 3) {
                Render.drawBox(new Vec3d(blocks[i], blocks[i + 1], blocks[i + 2]), Render.Color(0, 255, 200, 100), false);
            }
        } catch (e) {}
    }
}

if (isDeveloperModeEnabled()) new StructureESP();
