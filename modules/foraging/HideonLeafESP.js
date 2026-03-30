import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import Render from '../../utils/render/Render';

const ShulkerEntity = net.minecraft.entity.mob.ShulkerEntity;

class HideonLeafESP extends ModuleBase {
    constructor() {
        super({
            name: 'HideonLeaf ESP',
            subcategory: 'Foraging',
            description: 'Highlights HideonLeaf entities and draws tracers to them.',
            tooltip: 'Highlights HideonLeaf entities and draws tracers to them.',
        });

        this.targets = [];
        this.fillColor = Render.Color(0, 255, 0, 70);
        this.tracerColor = Render.Color(0, 255, 0, 255);

        this.on('step', () => this.scanTargets()).setFps(5);

        this.when(
            () => this.enabled && World.isLoaded() && Utils.area() === 'Galatea' && this.targets.length > 0,
            'postRenderWorld',
            () => this.renderTargets()
        );

        this.on('worldUnload', () => {
            this.targets = [];
        });
    }

    scanTargets() {
        if (!this.enabled || !World.isLoaded() || Utils.area() !== 'Galatea') {
            this.targets = [];
            return;
        }

        this.targets = World.getAllEntitiesOfType(ShulkerEntity).filter((entity) => entity && !entity.isDead());
    }

    renderTargets() {
        this.targets = this.targets.filter((entity) => entity && !entity.isDead());

        this.targets.forEach((entity) => {
            Render.drawHitbox(entity.toMC(), this.fillColor, 2, false);
            Render.drawTracer(new Vec3d(entity.getX(), entity.getY() + 1, entity.getZ()), this.tracerColor, 2, false);
        });
    }

    onDisable() {
        this.targets = [];
    }
}

new HideonLeafESP();
