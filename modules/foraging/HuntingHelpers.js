import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';

class HuntingHelper extends ModuleBase {
    constructor() {
        super({
            name: 'Hunting Helpers',
            subcategory: 'Foraging',
            description: 'Random features to help with hunting',
            tooltip: 'Manual use',
        });

        this.autoLassoReel = false;
        this.reeled = false;

        this.on('tick', () => {
            if (!this.autoLassoReel) return;
            if (
                !Player.getHeldItem()?.getName()?.includes('Lasso') ||
                !World.getAllEntitiesOfType(ArmorStandEntity).some((entity) => entity.getName() === 'REEL')
            ) {
                this.reeled = false;
                return;
            }
            if (this.reeled) return;
            Client.rightClick();
            this.reeled = true;
        });

        this.addToggle('Auto Lasso Reel', (v) => {
            this.autoLassoReel = v;
            if (!v) this.reeled = false;
        });
    }

    onDisable() {
        this.reeled = false;
    }
}

new HuntingHelper();
