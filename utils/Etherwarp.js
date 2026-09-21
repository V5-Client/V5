import { BP } from './Constants';
import { area } from './Utils';

const MODERN_ETHERWARP_AREAS = new Set([
    'Hub',
    'Dwarven Mines',
    'Gold Mine',
    'The Park',
    'Park',
    "Spider's Den",
    'Spider Den',
    'The End',
    'End',
    'The Farming Islands',
    'The Barn',
    'Galatea',
]);
const ETHERWARP_PLAYER_EYE_HEIGHT = 1.62;
const ETHERWARP_LEGACY_SNEAK_OFFSET = 0.08;
const ETHERWARP_MODERN_SNEAK_OFFSET = 0.35;

let pathHandler = null;

export const setEtherwarpPathHandler = (handler) => (pathHandler = handler);
export const getEtherwarpPathHandler = () => pathHandler;

const isModernEtherwarpArea = (areaName = area()) => MODERN_ETHERWARP_AREAS.has(areaName || '');

const getEtherwarpSneakOffset = (areaName = area()) => (isModernEtherwarpArea(areaName) ? ETHERWARP_MODERN_SNEAK_OFFSET : ETHERWARP_LEGACY_SNEAK_OFFSET);

export const getEtherwarpEyeCoords = (forceSneak = false, player = Player.getPlayer(), areaName = area()) => {
    if (!player) return null;

    const eyeY = forceSneak ? player.getY() + ETHERWARP_PLAYER_EYE_HEIGHT - getEtherwarpSneakOffset(areaName) : player.getEyePosition().y();
    return [player.getX(), eyeY, player.getZ()];
};

export const getEtherwarpBlockShape = (target) => {
    const x = Math.floor(Number(target?.x ?? target?.[0]));
    const y = Math.floor(Number(target?.y ?? target?.[1]));
    const z = Math.floor(Number(target?.z ?? target?.[2]));
    const world = World.getWorld();
    if (!world || ![x, y, z].every(Number.isFinite)) return null;

    const pos = new BP(x, y, z);
    const shape = world.getBlockState(pos)?.getShape(world, pos);
    return shape && !shape.isEmpty() ? shape : null;
};

export const isAtEtherwarpLanding = (target) => {
    if (!target || !Player.getPlayer()) return false;
    const x = Math.floor(Number(target.x));
    const y = Math.floor(Number(target.y));
    const z = Math.floor(Number(target.z));
    if (![x, y, z].every(Number.isFinite)) return false;

    const center = PathManager.getEtherwarpLandingCenter(x, y, z);
    if (!center) return false;
    return Math.hypot(Player.getX() - center[0], Player.getZ() - center[2]) <= 0.6 && Math.abs(Player.getY() - center[1]) <= 0.35;
};
