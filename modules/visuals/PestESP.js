import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { area } from '../../utils/Utils';

const PEST_NAMES = ['Silverfish', 'Bat'];
const PEST_KILL_RADIUS_SQ = 12 ** 2;
const PEST_BOX_COLOR = new RenderColor(255, 0, 0, 100);
const PEST_TRACER_COLOR = new RenderColor(255, 0, 0, 255);

export function getLoadedPests() {
    return World.getAllEntities().filter((entity) => !!entity && !entity.isDead() && PEST_NAMES.some((name) => entity.getName()?.includes(name)));
}

export function getNearbyPest() {
    const eyes = Player.getPlayer()?.getEyePosition();
    if (!eyes) return null;

    let closest = null;
    let closestDistanceSq = PEST_KILL_RADIUS_SQ;
    getLoadedPests().forEach((entity) => {
        const dx = entity.getX() - eyes.x();
        const dy = entity.getY() - eyes.y();
        const dz = entity.getZ() - eyes.z();
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq <= closestDistanceSq) {
            closest = entity;
            closestDistanceSq = distanceSq;
        }
    });
    return closest;
}

class PestESP extends ModuleBase {
    constructor() {
        super({
            name: 'modules.pest_esp.name',
            subcategory: 'Visuals',
            description: 'modules.pest_esp.description',
        });

        this.persistentPests = new Map();
        this.on('tick', () => {
            if (area() !== 'Garden') return;

            const now = Date.now();

            getLoadedPests().forEach((entity) => {
                const key = entity.getUUID().toString();
                const data = this.persistentPests.get(key);
                const x = entity.getX();
                const y = entity.getY();
                const z = entity.getZ();
                if (data) {
                    data.x = x;
                    data.y = y;
                    data.z = z;
                    data.entity = entity;
                    data.lastSeen = now;
                    if (data.position && (data.position.x !== x || data.position.y !== y || data.position.z !== z)) data.position = null;
                } else this.persistentPests.set(key, { x, y, z, entity, lastSeen: now });
            });

            this.persistentPests.forEach((data, uuid) => {
                if (data.entity.isDead() || now - data.lastSeen > 15_000) this.persistentPests.delete(uuid);
            });
        });

        this.when(
            () => this.enabled && area() === 'Garden',
            'postRenderWorld',
            () => {
                this.persistentPests.forEach((data) => {
                    if (!data.entity || data.entity.isDead()) return;
                    Render3D.drawHitbox(data.entity.toMC(), PEST_BOX_COLOR, 5, false);

                    data.position ||= new Vec3d(data.x, data.y, data.z);
                    Render3D.drawTracer(data.position, PEST_TRACER_COLOR, 2, false);
                });
            }
        );
    }
}

new PestESP();
