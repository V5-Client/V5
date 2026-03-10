import FarmHandler from '../FarmHandler';
import { CROP_TOOLS } from '../constants';

import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Rotations } from '../../../../utils/player/Rotations';

export default class CaneSunflowerRose extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
    }

    onTick() {
        const macro = this.parent;
        const states = macro.STATES;

        switch (macro.state) {
            case states.SCANFORCROP:
                this.handleScanForCrop();
                break;
            case states.DECIDEROTATION:
                let target = {
                    x: macro.targetX,
                    y: macro.targetY,
                    z: macro.targetZ,
                };

                let allowedYaws = [45, -45, 135, -135];

                let targetYaw = this.getAngle(target);
                targetYaw = ((((targetYaw + 180) % 360) + 360) % 360) - 180;

                let playerYaw = Player.getYaw();
                playerYaw = ((((playerYaw + 180) % 360) + 360) % 360) - 180;

                let finalSnapYaw = null;

                for (let allowed of allowedYaws) {
                    let diff = Math.abs(playerYaw - allowed);
                    let shortestDiff = Math.min(diff, 360 - diff);
                    if (shortestDiff <= 10) {
                        finalSnapYaw = allowed;
                        break;
                    }
                }

                if (finalSnapYaw === null) {
                    let minDifference = 361;
                    for (let allowed of allowedYaws) {
                        let diff = Math.abs(targetYaw - allowed);
                        let shortestDiff = Math.min(diff, 360 - diff);
                        if (shortestDiff < minDifference) {
                            minDifference = shortestDiff;
                            finalSnapYaw = allowed;
                        }
                    }
                }

                macro.yaw = finalSnapYaw;

                Rotations.rotateToAngles(macro.yaw, macro.pitch);
                Rotations.onEndRotation(() => (macro.state = macro.STATES.DECIDEITEM));
                break;
            case states.DECIDEITEM:
                let requiredToolName = null;
                let block = this.getBlockInFront(0, 0);
                let registry = block?.name;

                if (macro.registry && macro.registry.indexOf(registry) !== -1) {
                } else {
                    let lookingAt = Player.lookingAt();
                    registry = this.getRegistry(lookingAt);
                }

                requiredToolName = CROP_TOOLS[registry];

                if (!requiredToolName) {
                    macro.message(`&cMake sure you are looking at cane, sunflower, or rose!`);
                    macro.toggle(false);
                    return;
                }

                let targetSlot = Guis.findItemInHotbar(requiredToolName);

                macro.state = states.DECIDEMOVEMENT;

                /*if (targetSlot !== -1) {
                    Guis.setItemSlot(targetSlot);
                    if (Player.getHeldItemIndex() === targetSlot) macro.state = states.DECIDEMOVEMENT;
                } else {
                    macro.message(`&cMissing "${requiredToolName}"!`);
                    macro.toggle(false);
                } */

                break;
            case states.DECIDEMOVEMENT:
                Keybind.setKey('leftclick', true);
                if (macro.yaw === 45 || macro.yaw === -135) {
                    macro.movementKey = 'd';
                    Keybind.setKey('d', true);
                    Keybind.setKey('a', false);
                } else if (macro.yaw === 135 || macro.yaw === -45) {
                    macro.movementKey = 'a';
                    Keybind.setKey('a', true);
                    Keybind.setKey('d', false);
                }

                if (macro.movementKey !== null) macro.state = states.IDLECHECKS;
                break;

            case states.IDLECHECKS:
                if (this.isAtPoint(macro.points.end.x, macro.points.end.y, macro.points.end.z, 1)) {
                    macro.message('&aReached end of farm! rewarping.');
                    Keybind.unpressKeys();
                    Keybind.setKey('leftclick', false);
                    macro.state = states.REWARP;
                    return;
                }

                Keybind.setKey('leftclick', true);
                Keybind.setKey(macro.movementKey, true);
                if (macro.movementKey === 'a') Keybind.setKey('d', false);
                if (macro.movementKey === 'd') Keybind.setKey('a', false);
                break;
            case states.REWARP:
                this.handleRewarp();
                break;
        }
    }
}
