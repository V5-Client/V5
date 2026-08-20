import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';

class HuntingHelper extends ModuleBase {
    constructor() {
        super({
            name: 'modules.hunting_helpers.name',
            subcategory: 'Foraging',
            description: 'modules.hunting_helpers.description',
            tooltip: 'modules.hunting_helpers.tooltip',
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

        this.addToggle('labels.auto_lasso_reel', (v) => {
            this.autoLassoReel = v;
            if (!v) this.reeled = false;
        });
    }

    onDisable() {
        this.reeled = false;
    }
}

new HuntingHelper();
