import { BP, Direction, Vec3d } from './Constants';
import { setGhostBlock } from './MiningUtils';
import { createSwingPacket, ServerboundPlayerActionPacket, ServerboundPlayerActionPacket$Action } from './Packets';

const MAX_REACH_DISTANCE = 6;
const MIN_NUKE_INTERVAL = 50;
const SWING_DELAY = 10;

export const nukeQueue = [];
let lastNukeTime = Date.now();
let tickCounter = 0;
let delay = 0;
let nukeTick;
let vanillaBreak = null;

const syncNukeTick = () => {
    const active = nukeQueue.length > 0 || tickCounter > 0 || vanillaBreak;
    if (active && !nukeTick.isRegistered()) nukeTick.register();
    else if (!active && nukeTick.isRegistered()) nukeTick.unregister();
};

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

export function isBlockInRange(blockPos, maxDistance = MAX_REACH_DISTANCE) {
    const eye = Player.getPlayer()?.getEyePosition();
    if (!eye) return false;
    const x = Math.max(blockPos[0], Math.min(eye.x(), blockPos[0] + 1));
    const y = Math.max(blockPos[1], Math.min(eye.y(), blockPos[1] + 1));
    const z = Math.max(blockPos[2], Math.min(eye.z(), blockPos[2] + 1));
    return Math.hypot(eye.x() - x, eye.y() - y, eye.z() - z) <= maxDistance;
}

export function sendBreakPackets(blockPos, facing) {
    Client.sendSequencedPacket(
        (sequence) => new ServerboundPlayerActionPacket(ServerboundPlayerActionPacket$Action.START_DESTROY_BLOCK, blockPos, facing, sequence)
    );
    Client.sendPacket(createSwingPacket());
}

export const queueNuke = (blockPos, ticks) => {
    const count = nukeQueue.push([blockPos, ticks]);
    syncNukeTick();
    return count;
};

export const queueVanillaNuke = (blockPos, reach = MAX_REACH_DISTANCE) => {
    const count = nukeQueue.push({ blockPos, reach, vanilla: true });
    syncNukeTick();
    return count;
};

export const isVanillaNukeActive = () => vanillaBreak !== null || nukeQueue.some((action) => action?.vanilla);

const stopVanillaBreak = ({ position }) => {
    Client.sendSequencedPacket(
        (sequence) => new ServerboundPlayerActionPacket(ServerboundPlayerActionPacket$Action.STOP_DESTROY_BLOCK, position, closestDirection(position), sequence)
    );
    setGhostBlock(position);
};

const getVanillaBreakProgress = (position) => {
    const world = World.getWorld();
    const player = Player.getPlayer();
    return world && player ? world.getBlockState(position)?.getDestroyProgress(player, world, position) || 0 : 0;
};

const updateDelay = (ticks) => {
    if (Date.now() - lastNukeTime <= MIN_NUKE_INTERVAL + ticks * 50 && ticks !== 1 && delay < MIN_NUKE_INTERVAL) return;
    delay = 0;
};

export function nuke(blockPos, ticks = 1) {
    if (!isBlockInRange(blockPos)) return;
    updateDelay(ticks);
    lastNukeTime = Date.now();
    tickCounter = ticks;
    syncNukeTick();
    setTimeout(() => {
        const position = createBlockPosition(blockPos);
        Client.sendSequencedPacket(
            (sequence) =>
                new ServerboundPlayerActionPacket(ServerboundPlayerActionPacket$Action.START_DESTROY_BLOCK, position, closestDirection(position), sequence)
        );
    }, delay);
    delay += SWING_DELAY;
}

nukeTick = register('tick', () => {
    if (vanillaBreak) {
        if (!isBlockInRange(vanillaBreak.blockPos, vanillaBreak.reach)) vanillaBreak = null;
        else {
            vanillaBreak.progress += getVanillaBreakProgress(vanillaBreak.position);
            if (vanillaBreak.progress >= 1) {
                stopVanillaBreak(vanillaBreak);
                vanillaBreak = null;
            }
            Client.sendPacket(createSwingPacket());
        }
    } else if (nukeQueue.length) {
        const action = nukeQueue.pop();
        nukeQueue.length = 0;
        const blockPos = action?.vanilla ? action.blockPos : action?.[0];
        const reach = action?.vanilla ? action.reach : MAX_REACH_DISTANCE;
        if (blockPos && isBlockInRange(blockPos, reach)) {
            const position = createBlockPosition(blockPos);
            const facing = closestDirection(position);
            const breakProgress = action.vanilla ? getVanillaBreakProgress(position) : 0;
            if (!action.vanilla || breakProgress > 0) {
                sendBreakPackets(position, facing);
                if (action.vanilla) vanillaBreak = { position, blockPos, reach, progress: 0 };
                else tickCounter = action[1];
            }
        }
    } else if (tickCounter > 0) {
        tickCounter--;
        Client.sendPacket(createSwingPacket());
    }
    syncNukeTick();
}).unregister();
