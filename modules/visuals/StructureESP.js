import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClientboundBlockUpdatePacket, ClientboundLevelChunkWithLightPacket } from '../../utils/Packets';

const FAIRY_COLOR = new RenderColor(180, 70, 255, 110);
const STRUCTURE_COLOR = new RenderColor(0, 255, 200, 100);

class StructureESP extends ModuleBase {
    constructor() {
        super({
            name: 'modules.structure_esp.name',
            subcategory: 'Visuals',
            developerMode: true,
            description: 'modules.structure_esp.description',
        });

        this.on('packetReceived', (packet) => {
            const cx = packet?.getX();
            const cz = packet?.getZ();
            if (typeof cx !== 'number' || typeof cz !== 'number') return;
            setTimeout(() => {
                if (!this.enabled) return;
                StructureFinder.submitChunkScan(cx, cz);
            }, 50);
        }).setFilteredClass(ClientboundLevelChunkWithLightPacket);

        this.on('packetReceived', (packet) => {
            const pos = packet?.getPos();
            if (!pos) return;
            StructureFinder.submitBlockUpdate(pos.getX(), pos.getY(), pos.getZ());
        }).setFilteredClass(ClientboundBlockUpdatePacket);

        this.on('postRenderWorld', () => {
            this.render();
        });

        this.on('worldUnload', () => {
            StructureFinder.clear();
        });

        register('gameUnload', () => {
            StructureFinder.clear();
        });
    }

    onDisable() {
        StructureFinder.clear();
    }

    render() {
        try {
            const blocks = StructureFinder.getRenderBlocksArray();
            if (!blocks?.length) return;
            const labels = StructureFinder.getRenderLabelsArray();
            const playerX = Player.getX();
            const playerY = Player.getY() + 1.6;
            const playerZ = Player.getZ();
            const maxDistance = Math.max(16, (Client.getMinecraft().options.getEffectiveRenderDistance() - 1) * 16);

            for (let i = 0; i + 2 < blocks.length; i += 3) {
                const name = String(labels[i / 3]);
                const x = blocks[i] + 0.5;
                const y = blocks[i + 1];
                const z = blocks[i + 2] + 0.5;
                const dx = x - playerX;
                const dy = y - playerY;
                const dz = z - playerZ;
                const distance = Math.hypot(dx, dy, dz);
                const scale = distance > maxDistance ? maxDistance / distance : 1;
                const pos = new Vec3d(playerX + dx * scale, playerY + dy * scale, playerZ + dz * scale);
                const color = name === 'Fairy Grotto' ? FAIRY_COLOR : STRUCTURE_COLOR;

                Render3D.drawSizedBox(pos, 8, 8, 8, color, true, 1, false);
                Render3D.drawText(name, pos.add(0, 8.5, 0), 7.5, true, false, true);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

if (isDeveloperModeEnabled()) new StructureESP();
