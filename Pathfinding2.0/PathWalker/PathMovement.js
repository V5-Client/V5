import { Keybind } from '../../Utility/Keybinding';
import { Jump, stopJump } from './PathJumps';

/**
 * add velocity detection logic - simple
 * add aotv movement in liquids and etherwarp aswell
 */

export function PathMovement(on = true) {
    if (on) {
        Keybind.setKey('w', true);
        Jump();
    } else {
        Keybind.stopMovement();
        stopJump();
    }
}
