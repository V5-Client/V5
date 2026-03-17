import FarmHandler from '../FarmHandler';
import { CROP_TOOLS } from '../constants';

import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Rotations } from '../../../../utils/player/Rotations';
import { Utils } from '../../../../utils/Utils';

export default class MelonKingDeMP extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
        this.offWall = false;
    }

    reset() {
        this.offWall = false;
    }

    onTick() {
        const macro = this.parent;
        const states = macro.STATES;

        switch (macro.state) {
            case states.SCANFORCROP:
                this.handleScanForCrop();
                break;

            case states.DECIDEROTATION:
                let targetYaw;

                let target = {
                    x: macro.targetX,
                    y: macro.targetY,
                    z: macro.targetZ,
                };

                targetYaw = this.getAngle(target);

                targetYaw = ((((targetYaw + 180) % 360) + 360) % 360) - 180;

                let allowedYaws = macro.farmAxis === 'X' ? [0, -180] : macro.farmAxis === 'Z' ? [90, -90] : [0, 90, -90, -180];
                let snappedYaw = targetYaw;
                let minDifference = 361;

                for (const allowed of allowedYaws) {
                    let diff = Math.abs(targetYaw - allowed);
                    let shortestDiff = Math.min(diff, 360 - diff);
                    if (shortestDiff < minDifference) {
                        minDifference = shortestDiff;
                        snappedYaw = allowed;
                    }
                }

                macro.yaw = snappedYaw;
                Rotations.rotateToAngles(macro.yaw, macro.pitch);
                Rotations.onEndRotation(() => (macro.state = macro.STATES.DECIDEITEM));
                break;
            case states.DECIDEITEM:
                let requiredToolName = null;
                let block = this.getBlockInFront(2, 1);
                let registry = block?.name || '';

                let sides = Utils.sidesOfCollision();

                if (!sides.front) return Keybind.setKey('w', true);

                if (sides.front) {
                    let lookingAt = Player.lookingAt();
                    if (!registry.includes('stem')) {
                        registry = this.getRegistry(lookingAt) || registry;
                    }

                    requiredToolName = CROP_TOOLS[registry];

                    if (!requiredToolName) {
                        macro.message(`&cMake sure you are looking at a melon or pumpkin!`);
                        macro.toggle(false);
                        return;
                    }
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
                this.decideDirection(false);
                if (macro.movementKey === null) return;

                macro.state = states.IDLECHECKS;
                break;
            case states.IDLECHECKS:
                if (macro.points?.end && this.isAtPoint(macro.points.end.x, macro.points.end.y, macro.points.end.z, 1)) {
                    macro.message('&aReached end of farm! rewarping.');
                    Keybind.unpressKeys();
                    Keybind.setKey('leftclick', false);
                    macro.state = states.REWARP;
                    return;
                }

                Keybind.setKey('w', true);
                Keybind.setKey('leftclick', true);
                Keybind.setKey(macro.movementKey, true);

                let sideCollisions = Utils.sidesOfCollision();

                if (!sideCollisions.front) {
                    this.offWall = true;
                    Keybind.stopMovement();
                    Keybind.setKey('w', true);
                }

                if (this.offWall && sideCollisions.front) {
                    this.offWall = false;
                    Keybind.stopMovement();
                    macro.state = states.DECIDEMOVEMENT;
                }
                break;
            case states.REWARP:
                this.handleRewarp();
                break;
        }
    }
}
