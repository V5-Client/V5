import { generateHybridSpline, drawFloatingSpline } from './PathDebug';
import { PathComplete, pathRotations, ResetRotations, setRequestPathRecalculation } from './PathWalker/PathRotations';
import { PathMovement } from './PathWalker/PathMovement';
import { Vec3d, BP } from '../Constants';
import { getRenderKeyNodes, getRenderFloatingSpline } from './PathConfig';
import RenderUtils from '../render/RendererUtils';
import { detectJump } from './PathWalker/PathJumps';
import { Chat } from '../Chat';
import { Keybind } from '../player/Keybinding';
import { SwiftBridge } from './SwiftBridge';
import { showNotification } from '../../gui/NotificationManager';
import { v5Command } from '../V5Commands';

let renderPath = null;
let currentPathRequest = null;
let path = null;
let searchingTrigger = null;
let currentPathCallback = null;

export let pathNodes = [];
export let keyNodes = [];
export let betweenNodes = [];
export let spline = [];

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
    Keybind.stopMovement();

    SwiftBridge.cancel();

    if (searchingTrigger) {
        try {
            searchingTrigger.unregister();
        } catch (e) {}
        searchingTrigger = null;
    }

    if (path) {
        try {
            path.unregister();
        } catch (e) {
            Chat.log('Path already unregistered');
        }
        path = null;
    }

    if (renderPath) {
        try {
            renderPath.unregister();
        } catch (e) {
            Chat.log('RenderPath already unregistered');
        }
        renderPath = null;
    }

    currentPathRequest = null;
}

export function clearPathCallback() {
    currentPathCallback = null;
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
    const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
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

function executePathfinding(start, end, onComplete, renderOnly = false, adjustEnd = false) {
    stopPathing();

    const adjustedStart = [start[0], findStartY(start[0], start[1], start[2]), start[2]];
    const adjustedEnd = adjustEnd ? [end[0], findStartY(end[0], end[1], end[2]), end[2]] : end;

    Chat.messagePathfinder(`Path from ${adjustedStart.join(', ')} to ${adjustedEnd.join(', ')}`);

    const requestId = Date.now();
    currentPathRequest = requestId;

    const started = SwiftBridge.startPath(adjustedStart[0], adjustedStart[1], adjustedStart[2], adjustedEnd[0], adjustedEnd[1], adjustedEnd[2]);

    if (!started) {
        const error = SwiftBridge.getLastError() || 'Failed to start pathfinding';
        showNotification('Pathfinding Failed', error, 'ERROR', 5000);
        console.error('Pathfinding failed to start:', error);
        if (onComplete && typeof onComplete === 'function') onComplete(false);
        return;
    }

    Chat.messagePathfinder('§eSearching for path...');

    searchingTrigger = register('tick', () => {
        if (currentPathRequest !== requestId) {
            if (searchingTrigger) {
                searchingTrigger.unregister();
                searchingTrigger = null;
            }
            return;
        }

        if (SwiftBridge.isSearching()) {
            return;
        }

        searchingTrigger.unregister();
        searchingTrigger = null;

        const body = SwiftBridge.getResult();

        if (!body) {
            const error = SwiftBridge.getLastError() || 'Unknown error';
            showNotification('Pathfinding Failed', error, 'ERROR', 5000);
            console.error('Pathfinding failed:', error);
            if (onComplete && typeof onComplete === 'function') onComplete(false);
            return;
        }

        if (!body.keynodes || !Array.isArray(body.keynodes) || body.keynodes.length < 1) {
            showNotification('Pathfinding Failed', 'No path nodes received.', 'ERROR', 5000);
            console.error('Invalid keynodes in response:', body);
            if (onComplete && typeof onComplete === 'function') onComplete(false);
            return;
        }

        Chat.messagePathfinder(`Path length: ${body.path.length} nodes`);
        Chat.messagePathfinder(`Path found in ${body.time_ms}ms`);
        Chat.messagePathfinder(`Nodes explored: ${body.nodes_explored}`);
        Chat.messagePathfinder(`Nanoseconds per node: ${((body.time_ms * 10000) / body.path.length).toFixed(2)}ns`);

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
            Chat.log('No path_between_key_nodes, using keynodes for spline');
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
            showNotification('Render Only', 'Path rendered. Use /stop to clear.', 'INFO', 3000);
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

            showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);

            if (onComplete && typeof onComplete === 'function') {
                onComplete(true);
            }
            currentPathCallback = null;
        });
    });
}

/**
 * Find and walk a path from start to end.
 * @param {number[]} start - [x, y, z] start coords
 * @param {number[]} end - [x, y, z] end coords
 * @param {boolean|Function} renderOnlyOrCallback - If true, render only. If function, callback on complete.
 * @param {boolean} adjustEnd - If true, adjusts end Y to find ground level. ONLY WORKS ON BLOCK IN YOUR RENDER DISTANCE, DO NOT USE FOR LONG DISTANCE PATHS
 */
export function findAndFollowPath(start, end, renderOnlyOrCallback, adjustEnd = false) {
    const renderOnly = typeof renderOnlyOrCallback === 'boolean' ? renderOnlyOrCallback : false;
    const onComplete = typeof renderOnlyOrCallback === 'function' ? renderOnlyOrCallback : null;

    currentPathCallback = onComplete;

    executePathfinding(start, end, onComplete, renderOnly, adjustEnd);
}

function requestPathRecalculation() {
    Chat.messagePathfinder('§6[Pathfinding] Recalculating path...');

    const currentPos = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];

    if (keyNodes && keyNodes.length > 0) {
        const destination = keyNodes[keyNodes.length - 1];
        const end = [destination.x, destination.y, destination.z];
        const savedCallback = currentPathCallback;

        stopPathing();

        setTimeout(() => {
            findAndFollowPath(currentPos, end, savedCallback);
        }, 100);
    } else {
        Chat.messagePathfinder('§c[Pathfinding] Cannot recalculate - no destination stored');
        stopPathing();
    }
}

setRequestPathRecalculation(requestPathRecalculation);

v5Command('path', (...args) => {
    const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
    const coords = args.slice(0, 3).map(Number);
    if (coords.some(isNaN)) {
        return showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
    }
    const end = coords.slice(0, 3);
    findAndFollowPath(start, end);
});

v5Command('rustpath', (...args) => {
    if (args.length < 6) {
        return showNotification('Invalid Command', 'Usage: /rustpath <x1> <y1> <z1> <x2> <y2> <z2> [renderonly]', 'ERROR', 5000);
    }
    const coords = args.slice(0, 6).map(Number);
    if (coords.some(isNaN)) {
        return showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
    }
    const renderOnly = args.length === 7 && args[6]?.toLowerCase() === 'renderonly';
    findAndFollowPath(coords.slice(0, 3), coords.slice(3, 6), renderOnly);
});

v5Command('stopPath', () => {
    stopPathing();
    clearPathCallback();
});
