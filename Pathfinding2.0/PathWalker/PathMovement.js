import { Keybind } from '../../Utility/Keybinding';

/**
 * add velocity detection logic - simple
 * add aotv movement in liquids and etherwarp aswell
 */

export function pathMovement(on = true) {
    if (on) {
        Keybind.setKey('w', true);
    } else {
        Keybind.stopMovement();
    }
}
