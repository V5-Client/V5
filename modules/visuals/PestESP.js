import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';

const PEST_NAMES = ['Silverfish', 'Bat'];
const PEST_KILL_RADIUS_SQ = 12 ** 2;

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
            name: 'Pest ESP',
            subcategory: 'Visuals',
            developerMode: true,
            description: 'Scans and remembers pest locations even in distant chunks.',
        });

        this.persistentPests = new Map();
        this.on('tick', () => {
            if (Utils.area() !== 'Garden') return;

            const now = Date.now();

            getLoadedPests().forEach((entity) => {
                this.persistentPests.set(entity.getUUID().toString(), {
                    x: entity.getX(),
                    y: entity.getY(),
                    z: entity.getZ(),
                    entity: entity,
                    lastSeen: now,
                });
            });

            this.persistentPests.forEach((data, uuid) => {
                if (data.entity.isDead() || now - data.lastSeen > 15_000) this.persistentPests.delete(uuid);
            });
        });

        this.when(
            () => this.enabled && Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                this.persistentPests.forEach((data) => {
                    if (!data.entity || data.entity.isDead()) return;
                    RenderUtils.drawHitbox(data.entity.toMC(), new RenderColor(255, 0, 0, 100), 5, false);

                    RenderUtils.drawTracer(new Vec3d(data.x, data.y, data.z), new RenderColor(255, 0, 0, 255), 2, false);
                });
            }
        );
    }
}

if (isDeveloperModeEnabled()) new PestESP();
