import { Keybind } from '../../player/Keybinding';

/**
 * add velocity detection logic - simple
 * add aotv movement in liquids and etherwarp aswell
 */

export function PathMovement(on = true) {
    if (on) {
        Keybind.setKey('w', true);
    } else {
        Keybind.stopMovement();
    }
}
