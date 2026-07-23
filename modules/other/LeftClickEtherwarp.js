import { ModuleBase } from '../../utils/ModuleBase';

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
            if (this.hasAspectHeld()) {
                Client.rightClick();
                Client.setKey('shift', false);
                this.clickStart = Infinity;
            }
        }
    }

    onClick(button, isPressed) {
        if (Client.isInGui()) return;
        if (button != 0) return;
        if (isPressed) {
            if (this.hasAspectHeld()) {
                Client.setKey('shift', true);
                this.clickStart = Date.now();
            }
        }
    }

    hasAspectHeld() {
        const name = Player.getHeldItem()?.getName();
        return name?.includes('Aspect of the Void') || name?.includes('Aspect of the End');
    }

    onDisable() {
        this.clickStart = Infinity;
        Client.setKey('shift', false);
    }
}

new LeftClickEtherwarp();
