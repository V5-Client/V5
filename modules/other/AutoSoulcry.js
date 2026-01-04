import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Chat } from '../../utils/Chat';

class AutoSoulcry extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Soulcry',
            subcategory: 'Other',
            description: 'fast swap (should be safe kek)',
            tooltip: 'for Atomsplit Katana',
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.cooldown = Date.now();
        this.swapBackSlot = -1;

        this.on('tick', () => {
            let katanaSlot = Guis.findItemInHotbar('Katana');
            if (Player.getInventory().getItems()[katanaSlot].getType().getName() == '§rDiamond Sword') {
                if (Date.now() - this.cooldown > 1000) {
                    if (Player.getHeldItemIndex() != katanaSlot) {
                        this.swapBackSlot = Player.getHeldItemIndex();
                        Guis.setItemSlot(katanaSlot);
                        return;
                    }
                    if (Player.getHeldItemIndex() == katanaSlot) {
                        Keybind.rightClick();
                        this.cooldown = Date.now();
                    }
                }
            }
            if (this.swapBackSlot != Player.getHeldItemIndex()) {
                Guis.setItemSlot(this.swapBackSlot);
                this.swapBackSlot = -1;
            }
        });
    }

    onEnable() {
        Chat.message('Auto soulcry enabled');
    }

    onDisable() {
        Chat.message('Auto soulcry disabled');
    }
}

new AutoSoulcry();
