import { BP, Direction, MCHand, Vec3d } from './Constants';
import { ServerboundPlayerActionPacket, ServerboundPlayerActionPacket$Action, ServerboundSwingPacket } from './Packets';
import { ScheduleTask } from './ScheduleTask';

const MAX_REACH_DISTANCE = 6;
const MIN_NUKE_INTERVAL = 50;
const SWING_DELAY = 10;

export const nukeQueue = [];
let lastNukeTime = Date.now();
let tickCounter = 0;
let delay = 0;

export const createBlockPosition = (coords) => new BP(Math.floor(coords[0]), Math.floor(coords[1]), Math.floor(coords[2]));

const getFaceCenterPosition = (blockPos, face) =>
    new Vec3d(blockPos.getX() + 0.5 + face.getStepX() * 0.5, blockPos.getY() + 0.5 + face.getStepY() * 0.5, blockPos.getZ() + 0.5 + face.getStepZ() * 0.5);

export function closestDirection(blockPos) {
    const eye = Player.getPlayer()?.getEyePosition();
    if (!eye) return Direction.UP;
    let closest = Direction.UP;
    let closestDistance = Infinity;
    for (const face of [Direction.UP, Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]) {
        const distance = eye.distanceTo(getFaceCenterPosition(blockPos, face));
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = face;
        }
    }
    return closest;
}

export function isBlockInRange(blockPos) {
    const eye = Player.getPlayer()?.getEyePosition();
    if (!eye) return false;
    const x = Math.max(blockPos[0], Math.min(eye.x(), blockPos[0] + 1));
    const y = Math.max(blockPos[1], Math.min(eye.y(), blockPos[1] + 1));
    const z = Math.max(blockPos[2], Math.min(eye.z(), blockPos[2] + 1));
    return Math.hypot(eye.x() - x, eye.y() - y, eye.z() - z) <= MAX_REACH_DISTANCE;
}

export function sendBreakPackets(blockPos, facing) {
    Client.sendSequencedPacket(
        (sequence) => new ServerboundPlayerActionPacket(ServerboundPlayerActionPacket$Action.START_DESTROY_BLOCK, blockPos, facing, sequence)
    );
    Client.sendPacket(new ServerboundSwingPacket(MCHand.MAIN_HAND));
}

export const queueNuke = (blockPos, ticks) => nukeQueue.push([blockPos, ticks]);

const updateDelay = (ticks) => {
    if (Date.now() - lastNukeTime <= MIN_NUKE_INTERVAL + ticks * 50 && ticks !== 1 && delay < MIN_NUKE_INTERVAL) return;
    if (delay > MIN_NUKE_INTERVAL) {
        ScheduleTask(1, () => {
            if (typeof MiningBot !== 'undefined' && MiningBot) MiningBot.ticksMined--;
        });
    }
    delay = 0;
};

export function nuke(blockPos, ticks = 1) {
    if (!isBlockInRange(blockPos)) return;
    updateDelay(ticks);
    lastNukeTime = Date.now();
    tickCounter = ticks;
    setTimeout(() => {
        const position = createBlockPosition(blockPos);
        Client.sendSequencedPacket(
            (sequence) =>
                new ServerboundPlayerActionPacket(ServerboundPlayerActionPacket$Action.START_DESTROY_BLOCK, position, closestDirection(position), sequence)
        );
    }, delay);
    delay += SWING_DELAY;
}

register('tick', () => {
    if (nukeQueue.length) {
        const action = nukeQueue.pop();
        nukeQueue.length = 0;
        if (!Array.isArray(action) || action.length < 2 || !isBlockInRange(action[0])) return;
        const position = createBlockPosition(action[0]);
        sendBreakPackets(position, closestDirection(position));
        tickCounter = action[1];
    } else if (tickCounter > 0) {
        tickCounter--;
        Client.sendPacket(new ServerboundSwingPacket(MCHand.MAIN_HAND));
    }
});
