import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Raytrace } from '../../utils/Raytrace';
import { Utils } from '../../utils/Utils';

const PEST_NAMES = ['Silverfish', 'Bat'];
const PEST_KILL_RADIUS_SQ = 12 ** 2;
const PEST_VIEW_DOT = Math.cos((70 * Math.PI) / 180);

export function getLoadedPests() {
    return World.getAllEntities().filter(
        (entity) => !!entity && !entity.isDead() && PEST_NAMES.some((name) => entity.getName()?.includes(name))
    );
}

function pestOffset(entity, eyes) {
    const dx = entity.getX() - eyes.x();
    const dy = entity.getY() - eyes.y();
    const dz = entity.getZ() - eyes.z();
    return { dx, dy, dz, distanceSq: dx * dx + dy * dy + dz * dz };
}

export function isPestVisible(entity) {
    if (!entity || entity.isDead()) return false;

    try {
        if (Player.asPlayerMP()?.canSeeEntity?.(entity)) return true;
    } catch (e) {}

    const eyes = Player.getPlayer()?.getEyePosition();
    const center = Raytrace.getEntityHitboxCenter(entity);
    if (!eyes || !center) return false;
    return Raytrace.isLineClear(eyes.x(), eyes.y(), eyes.z(), center.x, center.y, center.z);
}

function findNearbyPest(requireVisible) {
    const eyes = Player.getPlayer()?.getEyePosition();
    if (!eyes) return null;
    const look = requireVisible ? Player.asPlayerMP()?.getLookVector?.() : null;

    let closest = null;
    let closestDistanceSq = PEST_KILL_RADIUS_SQ;
    getLoadedPests().forEach((entity) => {
        const { dx, dy, dz, distanceSq } = pestOffset(entity, eyes);
        if (distanceSq > closestDistanceSq) return;
        if (requireVisible) {
            if (!isPestVisible(entity)) return;
            const dist = Math.sqrt(distanceSq);
            if (look && dist > 0 && (dx * look.x() + dy * look.y() + dz * look.z()) / dist < PEST_VIEW_DOT) return;
        }
        closest = entity;
        closestDistanceSq = distanceSq;
    });
    return closest;
}

export function getNearbyPest() {
    return findNearbyPest(false);
}

export function getVisibleNearbyPest() {
    return findNearbyPest(true);
}

class PestESP extends ModuleBase {
    constructor() {
        super({
            name: 'Pest ESP',
            subcategory: 'Visuals',
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
                    entity,
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

new PestESP();
