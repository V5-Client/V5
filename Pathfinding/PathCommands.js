import { stopPathing, findAndFollowPath } from './PathAPI';

function handleCommand(args, isRustPath) {
    const requiredCoords = isRustPath ? 6 : 3;
    const renderOnly =
        isRustPath &&
        args.length === 7 &&
        args[6]?.toLowerCase() === 'renderonly';

    if (args.length < requiredCoords) {
        const usage = isRustPath
            ? '/rustpath <x1> <y1> <z1> <x2> <y2> <z2> [renderonly]'
            : '/path <x> <y> <z>';
        return global.showNotification(
            'Invalid Command',
            `Usage: ${usage}`,
            'ERROR',
            5000
        );
    }

    const coords = args.slice(0, requiredCoords).map(Number);
    if (coords.some(isNaN)) {
        return global.showNotification(
            'Invalid Coordinates',
            'All coordinates must be valid numbers.',
            'ERROR',
            5000
        );
    }

    const start = isRustPath
        ? coords.slice(0, 3)
        : [
              Math.floor(Player.getX()),
              Math.floor(Player.getY()) - 1,
              Math.floor(Player.getZ()),
          ];
    const end = isRustPath ? coords.slice(3, 6) : coords.slice(0, 3);
    findAndFollowPath(start, end, renderOnly);
}

register('command', (...args) => handleCommand(args, true)).setName(
    'rustpath',
    true
);
register('command', (...args) => handleCommand(args, false)).setName(
    'path',
    true
);
register('command', stopPathing).setName('stop', true);
