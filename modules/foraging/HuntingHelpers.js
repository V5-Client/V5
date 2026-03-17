import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';

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
            if (this.autoLassoReel) {
                if (!Player.getHeldItem()?.getName()?.includes('Lasso')) {
                    this.reeled = false;
                    return;
                }
                let stand = World.getAllEntitiesOfType(ArmorStandEntity);
                const reelStand = stand.some((element) => element.getName() === 'REEL');
                if (!reelStand) return (this.reeled = false);
                if (!this.reeled) {
                    Keybind.rightClick();
                    this.reeled = true;
                    return;
                }
            }
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
