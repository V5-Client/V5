import { Keybind } from '../../player/Keybinding';
import { Chat } from '../../Chat';

class PathMovement {
    constructor() {}

    beginMovement() {
        const player = Player.getPlayer();
        if (!player) return;

        let isSprinting = player.isSprinting();
        if (!isSprinting) Keybind.setKey('sprint', true);

        Keybind.setKey('w', true);
    }

    stopMovement() {
        Keybind.stopMovement();
        Keybind.setKey('w', false);
        Keybind.setKey('s', false);
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
        Keybind.setKey('space', false);
    }
}

export const Movement = new PathMovement();
