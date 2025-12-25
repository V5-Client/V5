import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import RenderUtils from '../../utils/render/RendererUtils';
import { Vec3d } from '../../utils/Constants';

class PestESP extends ModuleBase {
    constructor() {
        super({
            name: 'Pest ESP',
            subcategory: 'Farming',
            description: 'Scans and remembers pest locations even in distant chunks.',
            showEnabledToggle: true,
            autoDisableOnWorldUnload: true,
        });

        this.persistentPests = new Map();
        this.targetNames = ['Silverfish', 'Bat'];

        this.on('tick', () => {
            if (Utils.area() !== 'Garden') return;

            const now = Date.now();

            World.getAllEntities().forEach((entity) => {
                const name = entity.getName();
                if (name && this.targetNames.some((target) => name.includes(target))) {
                    this.persistentPests.set(entity.getUUID().toString(), {
                        name: name,
                        x: entity.getX(),
                        y: entity.getY(),
                        z: entity.getZ(),
                        entity: entity,
                        lastSeen: now,
                    });
                }
            });

            this.persistentPests.forEach((data, uuid) => {
                const timeSinceSeen = now - data.lastSeen;

                if (timeSinceSeen > 15000) this.persistentPests.delete(uuid);
            });
        });

        this.when(
            () => this.enabled && Utils.area() === 'Garden',
            'postrenderWorld',
            () => {
                this.persistentPests.forEach((data) => {
                    RenderUtils.drawEntityHitbox(data.entity.toMC(), [255, 0, 0, 100], 5, false);

                    RenderUtils.drawTracer(new Vec3d(data.x, data.y, data.z), [255, 0, 0, 255], 5, false);
                });
            }
        );
    }
}

new PestESP();
