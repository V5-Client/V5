import FarmHandler from '../FarmHandler';
import { CROP_TOOLS } from '../constants';
import { Keybind } from '../../../../utils/player/Keybinding';
import { Rotations } from '../../../../utils/player/Rotations';
import { Utils } from '../../../../utils/Utils';

export default class CocoaBean extends FarmHandler {
    constructor(parent) {
        super(parent);

        this.parent = parent;
        this.onWall = false;
        this.strafeKey = null;
        this.holdStrafe = false;
    }

    reset() {
        this.onWall = false;
        this.strafeKey = null;
        this.holdStrafe = false;
    }

    onTick() {
        const macro = this.parent;
        const states = macro.STATES;

        switch (macro.state) {
            case states.SCANFORCROP:
                this.handleScanForCrop();
                break;

            case states.DECIDEROTATION:
                const currentYaw = ((Player.getPlayer().getYaw() % 360) + 360) % 360;
                let allowedYaws = macro.farmAxis === 'X' ? [90, 270] : [0, 180];

                let closestYaw = allowedYaws.reduce((prev, curr) => {
                    let diffCurr = Math.abs(curr - currentYaw);
                    let diffPrev = Math.abs(prev - currentYaw);
                    if (diffCurr > 180) diffCurr = 360 - diffCurr;
                    if (diffPrev > 180) diffPrev = 360 - diffPrev;
                    return diffCurr < diffPrev ? curr : prev;
                });

                this.strafeKey = macro.yaw === 180 || macro.yaw === 90 ? 'd' : 'a';

                macro.yaw = closestYaw;
                Rotations.rotateToAngles(macro.yaw, macro.pitch);
                Rotations.onEndRotation(() => (macro.state = states.DECIDEITEM));
                break;
            case states.DECIDEITEM:
                let block = this.getRelativeBlock(0, 2, 1);
                let registry = block?.type?.getRegistryName() || '';

                if (!registry.includes('cocoa')) {
                    let lookingAt = Player.lookingAt();
                    if (lookingAt instanceof Block) {
                        registry = lookingAt.type.getRegistryName();
                    }
                }

                let requiredToolName = CROP_TOOLS[registry] || CROP_TOOLS['minecraft:cocoa'];

                if (!requiredToolName) {
                    macro.message(`&cMake sure you are looking at a cocoa bean!`);
                    macro.toggle(false);
                    return;
                }

                // choose slot

                macro.state = states.DECIDEMOVEMENT;
                break;
            case states.DECIDEMOVEMENT:
                this.holdStrafe = macro.FAST_COCOA;

                let forwardCrops = 0;
                let backwardCrops = 0;

                for (let zRel = 1; zRel <= 2; zRel++) {
                    for (let h = 1; h <= 3; h++) {
                        if (this.isMatureCocoa(this.getRelativeBlock(0, h, zRel))) backwardCrops++;
                    }
                }

                for (let zRel = -1; zRel >= -2; zRel--) {
                    for (let h = 1; h <= 3; h++) {
                        if (this.isMatureCocoa(this.getRelativeBlock(0, h, zRel))) forwardCrops++;
                    }
                }

                if (backwardCrops < forwardCrops && !macro.decidePrompted) {
                    macro.movementKey = 'w';
                } else if (forwardCrops < backwardCrops && !macro.decidePrompted) {
                    macro.movementKey = 's';
                } else {
                    if (!macro.decidePrompted) {
                        macro.message(`&cMacro can't decide, press W or S!`);
                        macro.decidePrompted = true;
                    }

                    if (Client.getMinecraft().options.forwardKey.isPressed()) {
                        macro.movementKey = 'w';
                        macro.decidePrompted = false;
                    } else if (Client.getMinecraft().options.backKey.isPressed()) {
                        macro.movementKey = 's';
                        macro.decidePrompted = false;
                    } else {
                        return;
                    }
                }

                Keybind.setKey(macro.movementKey, true);
                Keybind.setKey(this.strafeKey, true);
                Keybind.setKey('leftclick', true);

                macro.state = states.IDLECHECKS;
                break;

            case states.IDLECHECKS:
                if (this.isAtPoint(macro.points.end.x, macro.points.end.y, macro.points.end.z, 1)) {
                    macro.message('&aReached end of farm! rewarping.');
                    Keybind.unpressKeys();
                    macro.state = states.REWARP;
                    return;
                }

                Keybind.setKey(macro.movementKey, true);
                Keybind.setKey('leftclick', true);

                let sideCollisions = Utils.sidesOfCollision();
                let hasSide = sideCollisions.right || sideCollisions.left;
                let hitWall = macro.movementKey === 'w' ? sideCollisions.front : sideCollisions.back;

                if (this.holdStrafe) {
                    Keybind.setKey(this.strafeKey, true);
                } else {
                    if (hasSide) {
                        Keybind.setKey(this.strafeKey, false);
                    } else {
                        Keybind.setKey(this.strafeKey, true);
                    }
                }

                if (!this.onWall && hasSide && !hitWall) {
                    this.onWall = true;
                }

                if (this.onWall && hitWall && !hasSide) {
                    this.onWall = false;
                    let nextKey = macro.movementKey === 'w' ? 's' : 'w';
                    Keybind.setKey(macro.movementKey, false);
                    Keybind.setKey(nextKey, true);
                    macro.movementKey = nextKey;
                }
                break;

            case states.REWARP:
                this.handleRewarp();
                break;
        }
    }

    isMatureCocoa(block) {
        if (!block || !block.type.getRegistryName().includes('cocoa')) return false;
        try {
            return block.getState().get(net.minecraft.state.property.Properties.AGE_2) === 2;
        } catch (e) {
            return false;
        }
    }

    getRelativePos(xRel, yRel, zRel) {
        const player = Player.getPlayer();
        const liveYaw = ((player.getYaw() % 360) + 360) % 360;
        let allowedYaws = [0, 90, 180, 270];
        let snappedYaw = allowedYaws.reduce((prev, curr) => {
            let diffCurr = Math.abs(curr - liveYaw);
            let diffPrev = Math.abs(prev - liveYaw);
            if (diffCurr > 180) diffCurr = 360 - diffCurr;
            if (diffPrev > 180) diffPrev = 360 - diffPrev;
            return diffCurr < diffPrev ? curr : prev;
        });

        const yawRad = (snappedYaw + 180) * (Math.PI / 180);
        let x = xRel * Math.cos(yawRad) + zRel * Math.sin(yawRad);
        let z = zRel * Math.cos(yawRad) - xRel * Math.sin(yawRad);

        return {
            x: Math.floor(player.getX() + x),
            y: Math.round(player.getY() + yRel),
            z: Math.floor(player.getZ() + z),
        };
    }

    getRelativeBlock(xRel, yRel, zRel) {
        let pos = this.getRelativePos(xRel, yRel, zRel);
        return World.getBlockAt(pos.x, pos.y, pos.z);
    }
}
