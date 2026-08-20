import { ModuleBase } from '../../utils/ModuleBase';
import { clickItem } from '../../utils/player/Inventory';

class AutoFusionRepeat extends ModuleBase {
    constructor() {
        super({
            name: 'modules.auto_fusion_repeat.name',
            subcategory: 'Other',
            description: 'modules.auto_fusion_repeat.description',
            tooltip: 'modules.auto_fusion_repeat.tooltip',
        });
        this.bindToggleKey();

        this.on('tick', () => {
            if (clickItem('Repeat Previous Fusion', false, 'LEFT', true, true)) return;
            clickItem('Fusion', false, 'LEFT', true, true);
        });
    }
}

new AutoFusionRepeat();
