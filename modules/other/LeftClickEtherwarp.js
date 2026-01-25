import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';

class LeftClickEtherwarp extends ModuleBase {
    constructor() {
        super({
            name: 'LeftClickEtherwarp',
            subcategory: 'Other',
            description: '',
            tooltip: '',
        });

        this.clickStart = Infinity
        this.waitDuration = 50

        this.on('tick', () => this.onTick());
        this.on('clicked', (x, y, button, isPressed) => this.onClick(button, isPressed));
    }

    onTick() {
        if (Date.now() - this.clickStart > this.waitDuration) {
            Keybind.rightClick()
            Keybind.setKey("shift", false)
            this.clickStart = Infinity
        }
    }
    onClick(button, isPressed) {
        if (button != 0) return
        if (isPressed) {
            Keybind.setKey("shift", true)
            this.clickStart = Date.now()
        }
    }
}

new LeftClickEtherwarp();
