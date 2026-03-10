import FarmHandler from '../FarmHandler';
import { CROP_TOOLS } from '../constants';

import { MathUtils } from '../../../../utils/Math';
import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Rotations } from '../../../../utils/player/Rotations';

export default class VerticalCrop extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
        this.inAir = false;
    }

    reset() {
        this.inAir = false;
    }

    onTick() {
        const macro = this.parent;
        const states = macro.STATES;

        switch (macro.state) {
            case states.SCANFORCROP:
                this.handleScanForCrop();
                break;

            case states.DECIDEROTATION:
                const isCrop = (registryName) => (Array.isArray(macro.registry) ? macro.registry.includes(registryName) : registryName === macro.registry);

                let targetYaw;

                const blockAhead = this.getBlockInFront(1, 1);
                const aheadRegistry = blockAhead?.name;

                if (isCrop(aheadRegistry)) {
                    macro.message('&7Targetting crop by getting the block ahead!', true);
                    targetYaw = this.getAngle(blockAhead);
                } else {
                    const lookingAt = Player.lookingAt();
                    const lookReg = lookingAt ? this.getRegistry(lookingAt) : null;

                    if (lookingAt && isCrop(lookReg)) {
                        macro.message('&7Targetting crop by looking at!', true);
                        targetYaw = this.getAngle(lookingAt);
                    } else {
                        macro.message('&7Targetting crop by fallback!', true);

                        let target = {
                            x: macro.targetX,
                            y: macro.targetY,
                            z: macro.targetZ,
                        };

                        targetYaw = this.getAngle(target);
                    }
                }

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
                let block = this.getBlockInFront(1, 1);
                let registry = block?.name;

                if (!registry) {
                    let looking = Player.lookingAt();
                    if (!looking) {
                        macro.message('&cErrored finding block for item decision');
                        macro.toggle(false);
                        return;
                    }
                    registry = this.getRegistry(looking);
                }

                let requiredToolName = CROP_TOOLS[registry];
                if (!requiredToolName) {
                    macro.message(`&cNo tool mapped for block: ${registry}`);
                    macro.toggle(false);
                    break;
                }

                let targetSlot = Guis.findItemInHotbar(requiredToolName);
                macro.state = states.DECIDEMOVEMENT;

                /*if (targetSlot !== -1) {
                    Guis.setItemSlot(targetSlot);
                    if (Player.getHeldItemIndex() === targetSlot) macro.state = states.DECIDEMOVEMENT;
                } else {
                    macro.message(`&cMissing "${requiredToolName}"!`);
                    macro.toggle(false);
                }*/
                break;

            case states.DECIDEMOVEMENT:
                Keybind.setKey('leftclick', true);
                let blockData = this.getBlockInFront(1, 0);
                if (!blockData) {
                    macro.state = states.DECIDEROTATION;
                    break;
                }
                let distCheck = MathUtils.getDistanceToPlayer(blockData.x, blockData.y, blockData.z);

                if (distCheck.distanceFlat > 1) {
                    Keybind.setKey('w', true);
                    return;
                } else {
                    Keybind.setKey('w', false);
                }

                this.decideDirection(true);
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
                if (!Array.isArray(macro.ignoreKeys)) macro.ignoreKeys = [];
                macro.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                let isOnGround = Player.asPlayerMP().isOnGround();
                if (!isOnGround) {
                    Keybind.stopMovement();
                    this.inAir = true;
                }

                if (this.inAir && isOnGround) {
                    this.inAir = false;
                    macro.state = states.DECIDEMOVEMENT;
                }
                break;
            case states.REWARP:
                this.handleRewarp();
                break;
        }
    }
}
