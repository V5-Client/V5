import { ModuleBase } from '../../utils/ModuleBase';
import { getArea } from '../../utils/TabListUtils';

class AgaricusCapTriggerbot extends ModuleBase {
    constructor() {
        super({
            name: 'Agaricus Cap Triggerbot',
            subcategory: 'Rift',
            description: 'Clicks Agaricus Caps while holding a Wand of Farming.',
        });
        this.on('tick', () => this.tick());
    }

    onEnable() {
        this.clickReadyAt = 0;
    }

    tick() {
        if (Date.now() < this.clickReadyAt || getArea() !== 'The Rift') return;
        if (!Player.getHeldItem()?.getName?.()?.includes('Wand of Farming')) return;
        if (Player.lookingAt()?.type?.getRegistryName?.() !== 'minecraft:red_mushroom') return;

        Client.leftClick();
        this.clickReadyAt = Date.now() + 1000;
    }
}

new AgaricusCapTriggerbot();
