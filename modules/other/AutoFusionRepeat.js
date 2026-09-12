import { ModuleBase } from '../../utils/ModuleBase';
import { clickItem } from '../../utils/player/Inventory';

class AutoFusionRepeat extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Fusion Repeat',
            subcategory: 'Other',
            description: 'Repeats the previous fusion automatically.',
            tooltip: 'Clicks Repeat Previous Fusion, then Fusion, as soon as each is available.',
        });
        this.bindToggleKey();

        this.on('tick', () => {
            if (clickItem('Repeat Previous Fusion', false, 'LEFT', true, true)) return;
            clickItem('Fusion', false, 'LEFT', true, true);
        });
    }
}

new AutoFusionRepeat();
