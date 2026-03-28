import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ParticleS2C } from '../../utils/Packets';
import Render from '../../utils/render/Render';

const ENTITY_EFFECT = net.minecraft.particle.ParticleTypes.ENTITY_EFFECT;
const MUSHROOM_IDS = new Set(['minecraft:red_mushroom', 'minecraft:brown_mushroom']);

class GlowingMushroomESP extends ModuleBase {
    constructor() {
        super({
            name: 'Glowing Mushroom ESP',
            subcategory: 'Farming',
            description: 'Highlights glowing mushrooms in the Glowing Mushroom Cave.',
            tooltip: 'funni mushroom esp',
        });

        this.mushrooms = new Map();

        this.fillColor = Render.Color(0, 255, 0, 70);

        this.on('packetReceived', (packet) => this.onParticlePacket(packet)).setFilteredClass(ParticleS2C);
        this.on('tick', () => this.cleanup());
        this.on('worldLoad', () => this.mushrooms.clear());
        this.on('worldUnload', () => this.mushrooms.clear());

        this.when(
            () => this.enabled && this.mushrooms.size > 0,
            'postRenderWorld',
            () => this.renderMushrooms()
        );
    }

    onDisable() {
        this.mushrooms.clear();
    }

    onParticlePacket(packet) {
        if (packet.getParameters().getType() !== ENTITY_EFFECT) return;

        const x = packet.getX();
        const y = packet.getY();
        const z = packet.getZ();

        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);

        const block = World.getBlockAt(bx, by, bz);
        const registry = block?.type?.getRegistryName?.();
        if (!MUSHROOM_IDS.has(registry)) return;

        const now = Date.now();
        const key = `${bx}:${by}:${bz}`;

        this.mushrooms.set(key, {
            x: bx,
            y: by,
            z: bz,
            expiresAt: now + 15000,
        });
    }

    cleanup() {
        if (!this.enabled || this.mushrooms.size === 0) return;

        const now = Date.now();
        for (const [key, data] of this.mushrooms.entries()) {
            if (data.expiresAt <= now) {
                this.mushrooms.delete(key);
                continue;
            }

            const block = World.getBlockAt(data.x, data.y, data.z);
            const registry = block?.type?.getRegistryName?.();
            if (!MUSHROOM_IDS.has(registry)) this.mushrooms.delete(key);
        }
    }

    renderMushrooms() {
        for (const data of this.mushrooms.values()) {
            const pos = new Vec3d(data.x + 0.5, data.y + 0.001, data.z + 0.5);
            Render.drawSizedBox(pos, 0.4, 0.4, 0.4, this.fillColor, true, 1, false);
        }
    }
}

const GlowingMushroomESPModule = new GlowingMushroomESP();

export function getTrackedGlowingMushrooms() {
    return Array.from(GlowingMushroomESPModule.mushrooms.values()).map((entry) => ({
        x: entry.x,
        y: entry.y,
        z: entry.z,
        expiresAt: entry.expiresAt,
    }));
}

export function isGlowingMushroomBlock(x, y, z) {
    const block = World.getBlockAt(x, y, z);
    const registry = block?.type?.getRegistryName?.();
    return MUSHROOM_IDS.has(registry);
}
