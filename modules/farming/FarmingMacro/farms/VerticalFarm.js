import FarmHandler from '../FarmHandler';

import { MathUtils } from '../../../../utils/Math';
import { Rotations } from '../../../../utils/player/Rotations';
import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';

export default class VerticalCrop extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
    }

    onTick() {
        const p = this.parent;
        const STATES = p.STATES;

        switch (p.state) {
            case STATES.SCANFORCROP:
                let targetBlocks;
                const cube = this.scan3x3x3();

                if (Array.isArray(p.registry)) {
                    targetBlocks = cube.filter((block) => p.registry.includes(block.name));
                } else {
                    targetBlocks = cube.filter((block) => block.name === p.registry);
                }

                if (targetBlocks.length > 0 && !p.warping) {
                    const sumX = targetBlocks.reduce((sum, block) => sum + block.x, 0);
                    const sumY = targetBlocks.reduce((sum, block) => sum + block.y, 0);
                    const sumZ = targetBlocks.reduce((sum, block) => sum + block.z, 0);

                    const count = targetBlocks.length;
                    const avgX = sumX / count;
                    const avgY = sumY / count;
                    const avgZ = sumZ / count;

                    p.targetX = avgX + 0.5;
                    p.targetY = avgY;
                    p.targetZ = avgZ + 0.5;

                    const xCoords = targetBlocks.map((b) => b.x);
                    const zCoords = targetBlocks.map((b) => b.z);

                    const minX = Math.min(...xCoords);
                    const maxX = Math.max(...xCoords);
                    const minZ = Math.min(...zCoords);
                    const maxZ = Math.max(...zCoords);

                    const spanX = maxX - minX;
                    const spanZ = maxZ - minZ;

                    if (spanX > spanZ) p.farmAxis = 'X';
                    else if (spanZ > spanX) p.farmAxis = 'Z';
                    else p.farmAxis = 'X'; // idk what the fuck to do here

                    if (Player.isFlying()) {
                        Keybind.setKey('shift', true);
                    } else {
                        Keybind.setKey('shift', false);
                        p.state = p.STATES.DECIDEROTATION;
                    }
                } else if (!p.warping) {
                    if (this.isAtPoint(p.points.start.x, p.points.start.y, p.points.start.z) && this.areChunksLoaded(p.points.start.x, p.points.start.z)) {
                        p.message('&cAt start point but no crops found!');
                        p.toggle(false);
                    } else {
                        p.message('&cNot near your selected crop! Warping...');
                        ChatLib.command('warp garden');
                        p.warping = true;
                    }
                } else if (p.warping && this.isAtPoint(p.points.start.x, p.points.start.y, p.points.start.z)) {
                    p.warping = false;
                }
                break;

            case STATES.DECIDEROTATION:
                const isCrop = (reg) => (Array.isArray(p.registry) ? p.registry.includes(reg) : reg === p.registry);

                let targetYaw;

                const blockAhead = this.getBlockInFront(1, 1);
                const aheadRegistry = blockAhead?.name;

                if (isCrop(aheadRegistry)) {
                    p.message('&7Targetting crop by getting the block ahead!', true);
                    targetYaw = this.getAngle(blockAhead);
                } else {
                    const lookingAt = Player.lookingAt();
                    const lookReg = lookingAt ? this.getRegistry(lookingAt) : null;

                    if (lookingAt && isCrop(lookReg)) {
                        p.message('&7Targetting crop by looking at!', true);
                        targetYaw = this.getAngle(lookingAt);
                    } else {
                        p.message('&7Targetting crop by fallback!', true);

                        let target = {
                            x: p.targetX,
                            y: p.targetY,
                            z: p.targetZ,
                        };

                        targetYaw = this.getAngle(target);
                    }
                }

                targetYaw = ((((targetYaw + 180) % 360) + 360) % 360) - 180;

                let allowedYaws = p.farmAxis === 'X' ? [0, -180] : p.farmAxis === 'Z' ? [90, -90] : [0, 90, -90, -180];
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

                p.yaw = snappedYaw;
                Rotations.rotateToAngles(p.yaw, p.pitch, 0.1);
                Rotations.onEndRotation(() => (p.state = p.STATES.DECIDEITEM));
                break;
            case STATES.DECIDEITEM:
                let block = this.getBlockInFront(1, 1);
                let registry = block?.name;

                if (!registry) {
                    let looking = Player.lookingAt();
                    if (!looking) {
                        p.message('&cErrored finding block for item decision');
                        p.toggle(false);
                        return;
                    }
                    registry = this.getRegistry(looking);
                }

                const cropTools = {
                    'minecraft:nether_wart': 'Nether Wart Hoe',
                    'minecraft:potatoes': 'Potato Hoe',
                    'minecraft:wheat': 'Wheat Hoe',
                    'minecraft:carrots': 'Carrot Hoe',
                };

                let requiredToolName = cropTools[registry];
                if (!requiredToolName) {
                    p.message(`&cNo tool mapped for block: ${registry}`);
                    p.toggle(false);
                    break;
                }

                let targetSlot = Guis.findItemInHotbar(requiredToolName);
                if (targetSlot !== -1) {
                    Guis.setItemSlot(targetSlot);
                    if (Player.getHeldItemIndex() === targetSlot) p.state = STATES.DECIDEMOVEMENT;
                } else {
                    p.message(`&cMissing "${requiredToolName}"!`);
                    p.toggle(false);
                }
                break;

            case STATES.DECIDEMOVEMENT:
                Keybind.setKey('leftclick', true);
                let blockData = this.getBlockInFront(1, 0);
                let distCheck = MathUtils.getDistanceToPlayer(blockData.x, blockData.y, blockData.z);

                if (distCheck.distanceFlat > 1) {
                    Keybind.setKey('w', true);
                    return;
                } else {
                    Keybind.setKey('w', false);
                }

                this.decideVerticalDirection();
                if (p.movementKey !== null) p.state = STATES.IDLECHECKS;
                break;

            case STATES.IDLECHECKS:
                if (this.isAtPoint(p.points.end.x, p.points.end.y, p.points.end.z, 1)) {
                    p.message('&aReached end of farm! rewarping.');
                    Keybind.unpressKeys();
                    Keybind.setKey('leftclick', false);
                    p.state = STATES.REWARP;
                    return;
                }

                Keybind.setKey('leftclick', true);
                Keybind.setKey(p.movementKey, true);
                p.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                let isOnGround = Player.asPlayerMP().isOnGround();
                if (!isOnGround) {
                    Keybind.stopMovement();
                    this.inAir = true;
                }

                if (this.inAir && isOnGround) {
                    this.inAir = false;
                    p.state = STATES.DECIDEMOVEMENT;
                }
                break;
            case STATES.REWARP:
                this.handleRewarp();
                break;
        }
    }

    /**
     * Logic specifically extracted from your decideDirection(true)
     */
    decideVerticalDirection() {
        const p = this.parent;
        const { maxDistLeft, maxDistRight } = this.getSidesDistance();

        if (maxDistRight > maxDistLeft) {
            p.message(`&7Wall RIGHT moving LEFT!`, true);
            p.movementKey = 'a';
            p.ignoreKeys = ['d', 's'];
        } else if (maxDistLeft > maxDistRight) {
            p.message(`&7Wall LEFT moving RIGHT!`, true);
            p.movementKey = 'd';
            p.ignoreKeys = ['a', 's'];
        } else {
            let corners = this.checkForCrop(true, 1);
            if (corners.left.age > corners.right.age) {
                p.message(`&7Older crop LEFT, moving LEFT!`, true);
                p.movementKey = 'a';
                p.ignoreKeys = ['d', 's'];
            } else if (corners.right.age > corners.left.age) {
                p.message(`&7Older crop RIGHT, moving RIGHT!`, true);
                p.movementKey = 'd';
                p.ignoreKeys = ['a', 's'];
            } else {
                if (!p.saidCommand) p.message(`Macro can't decide, press A or D!`);
                p.saidCommand = true;
                if (Client.getMinecraft().options.leftKey.isPressed()) {
                    p.movementKey = 'a';
                    p.ignoreKeys = ['d', 's'];
                    p.saidCommand = false;
                } else if (Client.getMinecraft().options.rightKey.isPressed()) {
                    p.movementKey = 'd';
                    p.ignoreKeys = ['a', 's'];
                    p.saidCommand = false;
                }
            }
        }
    }
}
