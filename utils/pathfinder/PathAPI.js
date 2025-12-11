import request from 'requestV2';

import { generateHybridSpline, drawFloatingSpline } from './PathDebug';
import { PathComplete, pathRotations, ResetRotations } from './PathWalker/PathRotations';
import { PathMovement } from './PathWalker/PathMovement';
import { PathfindingMessages } from './PathConfig';
import { Links, Vec3d } from '../Constants';
import { Utils } from '../Utils';
import { getRenderKeyNodes, getRenderFloatingSpline } from './PathConfig';
import RenderUtils from '../render/RendererUtils';
import { detectJump } from './PathWalker/PathJumps';
import { Chat } from '../Chat';

const localhost = `${Links.PATHFINDER_API_URL}`;

let renderPath = null;
let currentPathRequest = null;
let path = null;

export let pathNodes = [];
export let keyNodes = [];
export let betweenNodes = [];
export let spline = [];

const Maps = {
    'Dwarven Mines': 'mines',
    Galatea: 'galatea',
    Hub: 'hub',
};

let currentIsland = null;

export function setPathNodes(nodes) {
    pathNodes = nodes;
}

export function setKeyNodes(nodes) {
    keyNodes = nodes;
}

export function setBetweenNodes(nodes) {
    betweenNodes = nodes;
}

export function setSpline(nodes) {
    spline = nodes;
}

export function stopPathing() {
    ResetRotations();

    if (path) {
        try {
            path.unregister();
        } catch (e) {
            console.log('Path already unregistered');
        }
        path = null;
    }

    if (renderPath) {
        try {
            renderPath.unregister();
        } catch (e) {
            console.log('RenderPath already unregistered');
        }
        renderPath = null;
    }

    currentPathRequest = null;
}

function findStartY(x, initialY, z) {
    let y = initialY + 1;
    const maxDistance = 100;

    for (let i = 0; i < maxDistance; i++) {
        if (y <= 0) return y;
        const blockVec = { x: x, y: y, z: z };

        if (!isBlockWalkable(World.getWorld(), blockVec)) return y;

        y--;
    }

    return y;
}

export function isBlockWalkable(world, blockVec) {
    const blockPosNMS = new net.minecraft.util.math.BlockPos(blockVec.x, blockVec.y, blockVec.z);
    const blockState = world.getBlockState(blockPosNMS);
    const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
    return collisionShape.isEmpty();
}

function drawKeyNodes(keynodes) {
    if (!keynodes || keynodes.length < 2) return;
    keynodes.forEach((keynode) => {
        RenderUtils.drawStyledBox(new Vec3d(keynode.x, keynode.y, keynode.z), [0, 100, 200, 120], [0, 100, 200, 255], 4, true);
    });
    for (let i = 0; i < keynodes.length - 1; i++) {
        const current = keynodes[i];
        const next = keynodes[i + 1];
        RenderUtils.drawLine(
            new Vec3d(current.x + 0.5, current.y + 1, current.z + 0.5),
            new Vec3d(next.x + 0.5, next.y + 1, next.z + 0.5),
            [0, 150, 255, 255],
            3,
            true
        );
    }
}

function loadMap(map, area, callback) {
    const url = `${localhost}/api/loadmap?map=${map}`;
    request({ url, timeout: 5000 })
        .then(() => {
            currentIsland = area;
            console.log(`Successfully loaded map '${map}'.`);
            global.showNotification(`Loaded ${map}!`, 'Connection successfully loaded the island you are on', 'SUCCESS', 4000);

            if (typeof callback === 'function') {
                callback();
            }
        })
        .catch((err) => {
            console.log(`Error loading map ${map}: ${err}`);
            global.showNotification('Map Load Failed', `Failed to load map ${map}`, 'ERROR', 8000);
        });
}

function getSinglePlayerWarpCommand(warpName) {
    const warps = {
        '/warp mines': 'tp @s -49 200 -122 -90 0',
        '/warp forge': 'tp @s 0 149 -68 90 0',
    };
    return warps[warpName] || null;
}

function handleWarp(warpCommand, onComplete) {
    const tpCommand = Server.getName() === 'SinglePlayer' ? getSinglePlayerWarpCommand(warpCommand) : warpCommand.slice(1);

    if (!tpCommand) {
        global.showNotification('Pathfinding Error', `Unknown warp point: ${warpCommand}`, 'ERROR', 4000);
        return;
    }

    Chat.message(`§aWarp point found! Running command: §e${tpCommand}`);
    ChatLib.command(tpCommand);
    setTimeout(onComplete, 250);
}

function executePathfinding(start, end, onComplete, renderOnly = false) {
    const adjustedStart = [start[0], findStartY(start[0], start[1], start[2]), start[2]];
    const adjustedEnd = end; // dont adjust. if your end coordinate is wrong, that's your fault.
    //const adjustedEnd = [end[0], findStartY(end[0], end[1], end[2]), end[2]];

    const mapIdentifier = Maps[currentIsland] || 'mines';

    const url = `${localhost}/api/pathfind`;
    const postData = {
        start: adjustedStart.join(','),
        end: adjustedEnd.join(','),
        use_keynodes: true,
        use_spline: false,
        use_warp_points: false,
        use_etherwarp: false,
        is_perfect_path: false,
    };

    PathfindingMessages(`Path from ${adjustedStart.join(', ')} to ${adjustedEnd.join(', ')}`);

    const requestId = Date.now();
    currentPathRequest = requestId;

    request({
        url,
        method: 'POST',
        json: true,
        body: postData,
        timeout: 15000,
    })
        .then((body) => {
            if (currentPathRequest !== requestId) return;

            if (!body) {
                global.showNotification('Pathfinding Failed', 'Empty response from pathfinder.', 'ERROR', 5000);
                console.error('Pathfinding response was null or undefined');
                return;
            }

            if (!body.keynodes || !Array.isArray(body.keynodes) || body.keynodes.length < 1) {
                global.showNotification('Pathfinding Failed', 'No path nodes received to generate a curve.', 'ERROR', 5000);
                console.error('Invalid keynodes in response:', body);
                return;
            }

            const beginPathing = () => {
                if (currentPathRequest !== requestId) return;

                if (body.path && Array.isArray(body.path) && body.path.length) {
                    setPathNodes(body.path);
                }

                if (body.keynodes && Array.isArray(body.keynodes) && body.keynodes.length) {
                    setKeyNodes(body.keynodes);
                }

                let generatedSpline = [];
                if (body.path_between_key_nodes && Array.isArray(body.path_between_key_nodes) && body.path_between_key_nodes.length) {
                    generatedSpline = generateHybridSpline(body.path_between_key_nodes, 1);
                } else if (body.keynodes && body.keynodes.length) {
                    console.log('No path_between_key_nodes, using keynodes for spline');
                    generatedSpline = generateHybridSpline(body.keynodes, 1);
                }

                setPathNodes(generatedSpline);

                if (getRenderKeyNodes() || getRenderFloatingSpline()) {
                    renderPath = register('postRenderWorld', () => {
                        if (getRenderKeyNodes() && body.keynodes) drawKeyNodes(body.keynodes);
                        if (getRenderFloatingSpline() && generatedSpline.length) drawFloatingSpline(generatedSpline);
                    });
                }

                if (renderOnly) {
                    global.showNotification('Render Only', 'Path rendered. Use /stop to clear.', 'INFO', 3000);
                    return;
                }

                path = register('tick', () => {
                    pathRotations(generatedSpline);

                    const jumpPath = body.path_between_key_nodes && body.path_between_key_nodes.length ? body.path_between_key_nodes : body.keynodes;
                    detectJump(jumpPath);

                    PathMovement();

                    if (!PathComplete()) return;

                    path.unregister();
                    path = null;

                    PathMovement(false);
                    ResetRotations();
                    stopPathing();

                    global.showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
                    if (onComplete && typeof onComplete === 'function') onComplete();
                });
            };

            if (body.warp_point && body.warp_point.command) {
                handleWarp(body.warp_point.command, beginPathing);
            } else {
                beginPathing();
            }
        })
        .catch((err) => {
            if (currentPathRequest !== requestId) return;

            global.showNotification('Pathfinding Error', 'Request failed. See console for details.', 'ERROR', 5000);
            console.error(`Pathfinding request failed: ${err}`);
        });
}

export function findAndFollowPath(start, end, renderOnlyOrCallback) {
    const renderOnly = typeof renderOnlyOrCallback === 'boolean' ? renderOnlyOrCallback : false;
    const onComplete = typeof renderOnlyOrCallback === 'function' ? renderOnlyOrCallback : null;

    const area = Utils.area();

    if (area !== currentIsland) {
        if (Maps[area]) {
            const mapValue = Maps[area];

            loadMap(mapValue, area, () => {
                executePathfinding(start, end, onComplete, renderOnly);
            });
            return;
        } else {
            console.log(`No matching map found for area: ${area}`);
            global.showNotification('Map Error', `Cannot pathfind, no map found for area: ${area}`, 'ERROR', 5000);
            if (Server.getName() === 'SinglePlayer') {
                const mapValue = Maps['Dwarven Mines']; // just here to load mines as default (singleplayer testing reasons)

                loadMap(mapValue, area, () => {
                    executePathfinding(start, end, onComplete, renderOnly);
                });
            }
            return;
        }
    }

    executePathfinding(start, end, onComplete, renderOnly);
}

global.requestPathRecalculation = function () {
    PathfindingMessages('§6[Pathfinding] Recalculating path...');

    const currentPos = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];

    if (keyNodes && keyNodes.length > 0) {
        const destination = keyNodes[keyNodes.length - 1];
        const end = [destination.x, destination.y, destination.z];

        stopPathing();

        setTimeout(() => {
            findAndFollowPath(currentPos, end);
        }, 100);
    } else {
        PathfindingMessages('§c[Pathfinding] Cannot recalculate - no destination stored');
        stopPathing();
    }
};

register('command', (...args) => {
    const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
    const coords = args.slice(0, 3).map(Number);
    if (coords.some(isNaN)) {
        return global.showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
    }
    const end = coords.slice(0, 3);
    findAndFollowPath(start, end);
}).setName('path', true);

register('command', (...args) => {
    if (args.length < 6) {
        return global.showNotification('Invalid Command', 'Usage: /rustpath <x1> <y1> <z1> <x2> <y2> <z2> [renderonly]', 'ERROR', 5000);
    }
    const coords = args.slice(0, 6).map(Number);
    if (coords.some(isNaN)) {
        return global.showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
    }
    const renderOnly = args.length === 7 && args[6]?.toLowerCase() === 'renderonly';
    findAndFollowPath(coords.slice(0, 3), coords.slice(3, 6), renderOnly);
}).setName('rustpath', true);

register('command', () => {
    stopPathing();
}).setName('stop', true);
