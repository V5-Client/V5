import { Utils } from './Utils';

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

export const isModernEtherwarpArea = (area = Utils.area()) => MODERN_ETHERWARP_AREAS.has(area || '');

export const getEtherwarpSneakOffset = (area = Utils.area()) => (isModernEtherwarpArea(area) ? ETHERWARP_MODERN_SNEAK_OFFSET : ETHERWARP_LEGACY_SNEAK_OFFSET);

export const getEtherwarpEyeHeight = (player = Player.getPlayer(), area = Utils.area()) => 1 + ETHERWARP_PLAYER_EYE_HEIGHT - getEtherwarpSneakOffset(area);

export const getEtherwarpEyeCoords = (forceSneak = false, player = Player.getPlayer(), area = Utils.area()) => {
    if (!player) return null;

    const eyeY = player.getY() + ETHERWARP_PLAYER_EYE_HEIGHT - getEtherwarpSneakOffset(area);
    return [player.getX(), eyeY, player.getZ()];
};
