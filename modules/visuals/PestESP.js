import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';

const PEST_NAMES = ['Silverfish', 'Bat'];
const PEST_KILL_RADIUS_SQ = 12 ** 2;
const TRACER_START_DISTANCE = 0.1;
const DEG_TO_RAD = Math.PI / 180;

function getCrosshairTracerStart() {
    const gameRenderer = Client.getMinecraft().gameRenderer;
    const camera = gameRenderer.getMainCamera();
    const renderState = gameRenderer.getGameRenderState();
    const cameraState = renderState.levelRenderState.cameraRenderState;
    const cameraEntityState = cameraState.entityRenderState;
    const tracerOffset = new org.joml.Vector3f(0, 0, -TRACER_START_DISTANCE);

    // View bob is added after the camera rotation, so undo it to keep the origin on the screen-center crosshair.
    if (renderState.optionsRenderState.bobView && cameraEntityState.isPlayer) {
        const walk = cameraEntityState.backwardsInterpolatedWalkDistance;
        const bob = cameraEntityState.bob;
        const walkRadians = walk * Math.PI;
        const viewBob = new org.joml.Matrix4f()
            .translate(Math.sin(walkRadians) * bob * 0.5, -Math.abs(Math.cos(walkRadians) * bob), 0)
            .rotateZ(Math.sin(walkRadians) * bob * 3 * DEG_TO_RAD)
            .rotateX(Math.abs(Math.cos(walkRadians - 0.2) * bob) * 5 * DEG_TO_RAD)
            .invert();

        viewBob.transformPosition(tracerOffset);
    }

    new org.joml.Matrix4f(cameraState.viewRotationMatrix).invert().transformDirection(tracerOffset);
    const cameraPos = camera.position();
    return new Vec3d(cameraPos.x() + tracerOffset.x(), cameraPos.y() + tracerOffset.y(), cameraPos.z() + tracerOffset.z());
}

export function getNearbyPest() {
    const eyes = Player.getPlayer()?.getEyePosition();
    if (!eyes) return null;

    let closest = null;
    let closestDistanceSq = PEST_KILL_RADIUS_SQ;
    World.getAllEntities().forEach((entity) => {
        if (entity.isDead() || !PEST_NAMES.some((name) => entity.getName()?.includes(name))) return;

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
            description: 'Scans and remembers pest locations even in distant chunks.',
        });

        this.persistentPests = new Map();
        this.on('tick', () => {
            if (Utils.area() !== 'Garden') return;

            const now = Date.now();

            World.getAllEntities().forEach((entity) => {
                const name = entity.getName();
                if (name && PEST_NAMES.some((target) => name.includes(target))) {
                    this.persistentPests.set(entity.getUUID().toString(), {
                        x: entity.getX(),
                        y: entity.getY(),
                        z: entity.getZ(),
                        entity: entity,
                        lastSeen: now,
                    });
                }
            });

            this.persistentPests.forEach((data, uuid) => {
                if (data.entity.isDead() || now - data.lastSeen > 15_000) this.persistentPests.delete(uuid);
            });
        });

        this.when(
            () => this.enabled && Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                let tracerStart = null;
                this.persistentPests.forEach((data) => {
                    if (!data.entity || data.entity.isDead()) return;
                    RenderUtils.drawHitbox(data.entity.toMC(), new RenderColor(255, 0, 0, 100), 5, false);

                    if (!tracerStart) tracerStart = getCrosshairTracerStart();
                    RenderUtils.drawLine(tracerStart, new Vec3d(data.x, data.y, data.z), new RenderColor(255, 0, 0, 255), 2, false);
                });
            }
        );
    }
}

if (isDeveloperModeEnabled()) new PestESP();
