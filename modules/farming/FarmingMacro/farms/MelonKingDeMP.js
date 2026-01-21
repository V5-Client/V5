import FarmHandler from '../FarmHandler';

import { MathUtils } from '../../../../utils/Math';
import { Rotations } from '../../../../utils/player/Rotations';
import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Utils } from '../../../../utils/Utils';
import { Chat } from '../../../../utils/Chat';

export default class MelonKingDeMP extends FarmHandler {
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
                let targetYaw;

                let target = {
                    x: p.targetX,
                    y: p.targetY,
                    z: p.targetZ,
                };

                targetYaw = this.getAngle(target);

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
                Rotations.rotateToAngles(p.yaw, p.pitch);
                Rotations.onEndRotation(() => (p.state = p.STATES.DECIDEITEM));
                break;
            case p.STATES.DECIDEITEM:
                let requiredToolName = null;
                let block = this.getBlockInFront(2, 1);
                let registry = block?.name;

                let sides = Utils.sidesOfCollision();

                if (!sides.front) return Keybind.setKey('w', true);

                if (sides.front) {
                    let lookingAt = Player.lookingAt();
                    if (!registry.includes('stem')) {
                        // Chat.message('got from looking');

                        // i mean this isnt really needed ?
                        registry = this.getRegistry(lookingAt);
                    } //else Chat.message('got with func');

                    const cropTools = {
                        'minecraft:melon': 'Melon Dicer',
                        'minecraft:melon_stem': 'Melon Dicer',

                        'minecraft:carved_pumpkin': 'Pumpkin Dicer',
                        'minecraft:pumpkin_stem': 'Pumpkin Dicer',
                    };

                    requiredToolName = cropTools[registry];

                    if (!requiredToolName) {
                        p.message(`&cMake sure you are looking at a melon or pumpkin!`);
                        p.toggle(false);
                        return;
                    }
                }

                p.checkSidesFirst = true;

                let targetSlot = Guis.findItemInHotbar(requiredToolName);

                Chat.message(`&aFound tool at slot ${targetSlot}`);

                if (targetSlot !== -1) {
                    Guis.setItemSlot(targetSlot);
                    if (Player.getHeldItemIndex() === targetSlot) p.state = p.STATES.DECIDEMOVEMENT;
                } else {
                    p.message(`&cMissing "${requiredToolName}"!`);
                    p.toggle(false);
                }
                break;

            case STATES.DECIDEMOVEMENT:
                this.decideDirection(false);
                if (p.movementKey === null) return;

                p.state = p.STATES.IDLECHECKS;
                break;
            case p.STATES.IDLECHECKS:
                if (this.isAtPoint(p.points.end.x, p.points.end.y, p.points.end.z, 1)) {
                    p.message('&aReached end of farm! rewarping.');
                    Keybind.unpressKeys();
                    Keybind.setKey('leftclick', false);
                    p.state = STATES.REWARP;
                    return;
                }

                Keybind.setKey('w', true);
                Keybind.setKey('leftclick', true);
                Keybind.setKey(p.movementKey, true);
                //this.ignoreKeys.forEach((key) => Keybind.setKey(key, false));

                let sideCollisions = Utils.sidesOfCollision();

                if (!sideCollisions.front) {
                    this.offWall = true;
                    Keybind.stopMovement();
                    Keybind.setKey('w', true);
                }

                if (this.offWall && sideCollisions.front) {
                    this.offWall = false;
                    Keybind.stopMovement();
                    p.state = p.STATES.DECIDEMOVEMENT;
                }
                break;
            case p.STATES.REWARP:
                this.handleRewarp();
                break;
        }
    }
}
