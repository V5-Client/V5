//@VIP
// idk if ready for release up to zurviq
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import Render from '../../utils/render/Render';

class PestESP extends ModuleBase {
    constructor() {
        super({
            name: 'Pest ESP',
            subcategory: 'Farming',
            description: 'Scans and remembers pest locations even in distant chunks.',
            showEnabledToggle: true,
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
                const isDead = data.entity.isDead();
                if (isDead) this.persistentPests.delete(uuid);

                const timeSinceSeen = now - data.lastSeen;
                if (timeSinceSeen > 15000) this.persistentPests.delete(uuid);
            });
        });

        this.when(
            () => this.enabled && Utils.area() === 'Garden',
            'postRenderWorld',
            () => {
                this.persistentPests.forEach((data) => {
                    if (!data.entity || data.entity.isDead()) return;
                    Render.drawHitbox(data.entity.toMC(), Render.Color(255, 0, 0, 100), 5, false);

                    Render.drawTracer(new Vec3d(data.x, data.y, data.z), Render.Color(255, 0, 0, 255), 2, false);
                });
            }
        );
    }
}

new PestESP();
