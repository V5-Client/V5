import { BP, Direction, MCHand, Vec3d } from './Constants';
import { MathUtils } from './Math';
import { Mixin } from './MixinManager';
import { HandSwingC2S, PlayerActionC2S, PlayerActionC2SAction } from './Packets';
import { ScheduleTask } from './ScheduleTask';

class NukerUtilsClass {
    static MAX_REACH_DISTANCE = 6;
    static MIN_NUKE_INTERVAL = 50;
    static SWING_DELAY = 10;

    constructor() {
        this.initialize();
        this.registerTickHandler();
    }

    initialize() {
        this.lastNukeTime = Date.now();
        this.nukeQueue = [];
        this.tickCounter = 0;
        this.sequence = 0;
        this.delay = 0;
        this.fakelookMode = 'Queue';
        this.currentBreakingBlockPos = null;
    }

    registerTickHandler() {
        register('tick', () => {
            this.sequence = Mixin.get('playerActionSequence', 0);

            const isNuking = this.nukeQueue.length > 0 || this.tickCounter > 0;
            Mixin.set('nukerActive', isNuking);

            if (this.fakelookMode !== 'Queue') return;

            if (this.nukeQueue.length > 0) {
                this.processNextQueuedAction();
            } else if (this.tickCounter > 0) {
                this.tickCounter--;
                Client.sendPacket(new HandSwingC2S(MCHand.MAIN_HAND));
            }
        });
    }

    processNextQueuedAction() {
        const nextAction = this.nukeQueue.pop();
        const blockCoords = nextAction[0];
        const ticksToWait = nextAction[1];
        this.nukeQueue = [];

        const blockPos = this.createBlockPosition(blockCoords);
        if (!this.isBlockInRange(blockCoords)) return;

        const facing = this.closestDirection(blockPos);

        this.sendBreakPackets(blockPos, facing);
        this.tickCounter = ticksToWait;
    }

    sendBreakPackets(blockPos, facing) {
        Client.sendPacket(new PlayerActionC2S(PlayerActionC2SAction.START_DESTROY_BLOCK, blockPos, facing, this.sequence));
        Client.sendPacket(new HandSwingC2S(MCHand.MAIN_HAND));
    }

    nukeQueueAdd(blockPos, ticks) {
        this.nukeQueue.push([blockPos, ticks]);
    }

    nuke(blockPos, ticks = 1) {
        if (!this.isBlockInRange(blockPos)) return;

        this.updateDelayIfNeeded(ticks);
        this.lastNukeTime = Date.now();
        this.tickCounter = ticks;

        setTimeout(() => {
            this.executeNuke(blockPos);
        }, this.delay);

        this.delay += NukerUtilsClass.SWING_DELAY;
    }

    updateDelayIfNeeded(ticks) {
        const timeSinceLastNuke = Date.now() - this.lastNukeTime;
        const threshold = NukerUtilsClass.MIN_NUKE_INTERVAL + ticks * 50;

        if (timeSinceLastNuke > threshold || ticks === 1 || this.delay >= NukerUtilsClass.MIN_NUKE_INTERVAL) {
            if (this.delay > NukerUtilsClass.MIN_NUKE_INTERVAL) {
                ScheduleTask(1, () => MiningBot.ticksMined--);
            }
            this.delay = 0;
        }
    }

    executeNuke(blockPos) {
        const blockPosition = this.createBlockPosition(blockPos);
        const facing = this.closestDirection(blockPosition);

        Client.sendPacket(new PlayerActionC2S(PlayerActionC2SAction.START_DESTROY_BLOCK, blockPosition, facing, this.sequence));

        this.currentBreakingBlockPos = blockPos;
    }

    isBlockInRange(blockPos) {
        const eyePos = Player.getPlayer()?.getEyePos();
        if (!eyePos) return false;

        const clampedX = Math.max(blockPos[0], Math.min(eyePos.x, blockPos[0] + 1));
        const clampedY = Math.max(blockPos[1], Math.min(eyePos.y, blockPos[1] + 1));
        const clampedZ = Math.max(blockPos[2], Math.min(eyePos.z, blockPos[2] + 1));
        const { distance } = MathUtils.calculateDistance([eyePos.x, eyePos.y, eyePos.z], [clampedX, clampedY, clampedZ]);
        return distance <= NukerUtilsClass.MAX_REACH_DISTANCE;
    }

    createBlockPosition(coords) {
        return new BP(Math.floor(coords[0]), Math.floor(coords[1]), Math.floor(coords[2]));
    }

    closestDirection(blockPos) {
        const playerEyePos = Player.getPlayer().getEyePos();
        const faces = [Direction.UP, Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST];

        let minDistance = Infinity;
        let closestFace = Direction.UP;

        for (const face of faces) {
            const faceCenter = this.getFaceCenterPosition(blockPos, face);
            const distance = playerEyePos.distanceTo(faceCenter);

            if (distance < minDistance) {
                minDistance = distance;
                closestFace = face;
            }
        }

        return closestFace;
    }

    getFaceCenterPosition(blockPos, face) {
        const offset = this.getFaceOffset(face);

        return new Vec3d(blockPos.getX() + 0.5 + offset.x * 0.5, blockPos.getY() + 0.5 + offset.y * 0.5, blockPos.getZ() + 0.5 + offset.z * 0.5);
    }

    getFaceOffset(face) {
        let offsetX = 0;
        let offsetY = 0;
        let offsetZ = 0;

        switch (face) {
            case Direction.DOWN:
                offsetY = -1;
                break;
            case Direction.UP:
                offsetY = 1;
                break;
            case Direction.NORTH:
                offsetZ = -1;
                break;
            case Direction.SOUTH:
                offsetZ = 1;
                break;
            case Direction.WEST:
                offsetX = -1;
                break;
            case Direction.EAST:
                offsetX = 1;
                break;
        }

        return { x: offsetX, y: offsetY, z: offsetZ };
    }
}

export const NukerUtils = new NukerUtilsClass();
