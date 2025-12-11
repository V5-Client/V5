import { Keybind } from '../../player/Keybinding';
import { isInRecoveryMode, getRecoveryMovement } from './PathStuckRecovery';

/**
 * add velocity detection logic - simple
 * add aotv movement in liquids and etherwarp aswell
 */
export function PathMovement(on = true) {
    if (isInRecoveryMode()) {
        const recoveryMovement = getRecoveryMovement();
        Keybind.setKey('w', recoveryMovement.forward);
        Keybind.setKey('s', recoveryMovement.backward);
        return;
    }

    if (on) {
        Keybind.setKey('w', true);
        Keybind.setKey('s', false);
    } else {
        Keybind.stopMovement();
    }
}
