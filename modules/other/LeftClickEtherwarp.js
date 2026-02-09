import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';

class LeftClickEtherwarp extends ModuleBase {
    constructor() {
        super({
            name: 'Leftclick Etherwarp',
            subcategory: 'Other',
            description: 'Allows etherwarping with leftclick',
            tooltip: 'allows etherwarping with leftclick',
        });

        this.clickStart = Infinity;
        this.waitDuration = 50;

        this.on('tick', () => this.onTick());
        this.on('clicked', (x, y, button, isPressed) => this.onClick(button, isPressed));
    }

    onTick() {
        if (Client.isInGui()) return;
        if (Date.now() - this.clickStart > this.waitDuration) {
            let held = Player.getHeldItem()?.getName()?.indexOf('Aspect of the ');
            if (held > 0 && typeof held != undefined) {
                Keybind.rightClick();
                Keybind.setKey('shift', false);
                this.clickStart = Infinity;
            }
        }
    }

    onClick(button, isPressed) {
        if (Client.isInGui()) return;
        if (button != 0) return;
        if (isPressed) {
            let held = Player.getHeldItem()?.getName()?.indexOf('Aspect of the ');
            if (held > 0 && typeof held != undefined) {
                Keybind.setKey('shift', true);
                this.clickStart = Date.now();
            }
        }
    }
}

new LeftClickEtherwarp();
