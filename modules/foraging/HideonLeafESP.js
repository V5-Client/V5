import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { area } from '../../utils/Utils';

const ShulkerEntity = net.minecraft.world.entity.monster.Shulker;

class HideonLeafESP extends ModuleBase {
    constructor() {
        super({
            name: 'modules.hideonleaf_esp.name',
            subcategory: 'Foraging',
            description: 'modules.hideonleaf_esp.description',
            tooltip: 'modules.hideonleaf_esp.tooltip',
        });

        this.targets = [];
        this.fillColor = new RenderColor(0, 255, 0, 70);
        this.tracerColor = new RenderColor(0, 255, 0, 255);

        this.on('step', () => this.scanTargets()).setFps(5);

        this.when(
            () => this.enabled && World.isLoaded() && area() === 'Galatea' && this.targets.length > 0,
            'postRenderWorld',
            () => this.renderTargets()
        );

        this.on('worldUnload', () => {
            this.targets = [];
        });
    }

    scanTargets() {
        if (!this.enabled || !World.isLoaded() || area() !== 'Galatea') {
            this.targets = [];
            return;
        }

        this.targets = World.getAllEntitiesOfType(ShulkerEntity).filter((entity) => entity && !entity.isDead());
    }

    renderTargets() {
        this.targets = this.targets.filter((entity) => entity && !entity.isDead());

        this.targets.forEach((entity) => {
            Render3D.drawHitbox(entity.toMC(), this.fillColor, 2, false);
            Render3D.drawTracer(new Vec3d(entity.getX(), entity.getY() + 1, entity.getZ()), this.tracerColor, 2, false);
        });
    }

    onDisable() {
        this.targets = [];
    }
}

new HideonLeafESP();
