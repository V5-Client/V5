import { Keybind } from '../../utils/player/Keybinding';
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
            if (this.autoLassoReel) {
                if (!Player.getHeldItem()?.getName()?.includes('Lasso')) return;
                let stand = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity);
                const reelStand = stand.some((element) => element.getName() === 'REEL');
                if (!reelStand) return (this.reeled = false);
                if (!this.reeled) {
                    Keybind.rightClick();
                    this.reeled = true;
                    return;
                }
            }
        });

        this.addToggle('Auto Lasso Reel', (v) => (this.autoLassoReel = v));
    }
}

new HuntingHelper();
