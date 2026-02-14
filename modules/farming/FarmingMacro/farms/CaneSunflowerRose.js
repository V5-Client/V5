import FarmHandler from '../FarmHandler';

import { Chat } from '../../../../utils/Chat';
import { Guis } from '../../../../utils/player/Inventory';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Rotations } from '../../../../utils/player/Rotations';

export default class CaneSunflowerRose extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
        this.lanesSwitched = 0;
        this.switchSide = null;
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
                let target = {
                    x: p.targetX,
                    y: p.targetY,
                    z: p.targetZ,
                };

                let allowedYaws = [45, -45, 135, -135];

                // 1. Calculate Target Yaw from coordinates and normalize
                let targetYaw = this.getAngle(target);
                targetYaw = ((((targetYaw + 180) % 360) + 360) % 360) - 180;

                // 2. Get Player's current Yaw and normalize
                let playerYaw = Player.getYaw();
                playerYaw = ((((playerYaw + 180) % 360) + 360) % 360) - 180;

                let finalSnapYaw = null;

                // 3. Logic: If player is already looking within 10° of a diagonal, focus that one
                for (let allowed of allowedYaws) {
                    let diff = Math.abs(playerYaw - allowed);
                    let shortestDiff = Math.min(diff, 360 - diff);
                    if (shortestDiff <= 10) {
                        finalSnapYaw = allowed;
                        break;
                    }
                }

                // 4. Fallback: If player isn't near a diagonal, find the one closest to the targetYaw
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

                // 5. Apply the final snapped yaw
                p.yaw = finalSnapYaw;

                Rotations.rotateToAngles(p.yaw, p.pitch);
                Rotations.onEndRotation(() => (p.state = p.STATES.DECIDEITEM));
                break;
            case STATES.DECIDEITEM:
                let requiredToolName = null;
                let block = this.getBlockInFront(0, 0);
                let registry = block?.name;

                if (p.registry && p.registry.indexOf(registry) !== -1) {
                    Chat.message('got with func');

                    // i mean this isnt really needed ?
                    //registry = this.getRegistry(lookingAt);
                } else {
                    let lookingAt = Player.lookingAt();

                    Chat.message('got from looking');

                    // i mean this isnt really needed ?
                    registry = this.getRegistry(lookingAt);
                }

                const cropTools = {
                    'minecraft:sugar_cane': 'Sugar Cane Hoe',
                    'minecraft:sunflower': 'Sunflower Hoe',
                    'minecraft:rose_bush': 'Rose Bush Hoe',
                };

                requiredToolName = cropTools[registry];

                if (!requiredToolName) {
                    p.message(`&cMake sure you are looking at a melon or pumpkin!`);
                    p.toggle(false);
                    return;
                }
                //}

                //p.checkSidesFirst = true;

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
                Keybind.setKey('leftclick', true);

                Chat.message(`&aMovement key: ${p.movementKey}`);
                Chat.message(`&aYaw: ${p.yaw}`);

                // Movement Logic based on snapped Yaw
                // 45 or -135 -> Press 'D' (Right)
                // 135 or -45 -> Press 'A' (Left)
                if (this.lanesSwitched === 0) {
                    if (p.yaw === 45 || p.yaw === -135) {
                        this.switchSide = 'left';
                        p.movementKey = 'd';
                        Keybind.setKey('d', true);
                        Keybind.setKey('a', false);
                    } else if (p.yaw === 135 || p.yaw === -45) {
                        this.switchSide = 'right';
                        p.movementKey = 'a';
                        Keybind.setKey('a', true);
                        Keybind.setKey('d', false);
                    }
                }
                // how do i lane switch ?? 😭

                if (p.movementKey !== null) p.state = STATES.IDLECHECKS;
                break;

            case STATES.IDLECHECKS:
                break;
        }
    }
}
