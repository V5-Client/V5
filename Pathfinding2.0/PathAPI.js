import request from 'requestV2';

import { generateHybridSpline, drawFloatingSpline } from './PathDebug';
import { PathComplete, pathRotations, ResetRotations } from './PathWalker/PathRotations';
import { PathMovement } from './PathWalker/PathMovement';
import { PathfindingMessages } from './PathConfig';
import { checkLookaheadYChange } from './PathWalker/PathJumps';
import { Links, Vec3d } from '../Utility/Constants';
import { Utils } from '../Utility/Utils';
import { getRenderKeyNodes, getRenderFloatingSpline } from './PathConfig';
import RenderUtils from '../Rendering/RendererUtils';

register('command', (...args) => {
    const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];

    const coords = args.slice(0, 3).map(Number);
    if (coords.some(isNaN)) {
        return global.showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
    }

    const end = coords.slice(0, 3);
    findAndFollowPath(start, end);
}).setName('path', true);

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
        path.unregister();
        path = null;
    }

    if (renderPath) {
        renderPath.unregister();
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
            1,
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

function executePathfinding(start, end, onComplete) {
    const adjustedStart = [start[0], findStartY(start[0], start[1], start[2]), start[2]];
    const adjustedEnd = end;

    const mapIdentifier = Maps[currentIsland] || 'mines';
    const url = `${localhost}/api/pathfinding?start=${adjustedStart.join(',')}&end=${adjustedEnd.join(',')}&map=${mapIdentifier}`;
    PathfindingMessages(`Path from ${adjustedStart.join(', ')} to ${adjustedEnd.join(', ')}`);

    const requestId = Date.now();
    currentPathRequest = requestId;

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (!body || !body.keynodes || body.keynodes.length < 1) {
                global.showNotification('Pathfinding Failed', 'No path nodes received to generate a curve after retries.', 'ERROR', 5000);
                return;
            }

            if (body.path && body.path.length) setPathNodes(body.path);
            if (body.keynodes && body.keynodes.length) setKeyNodes(body.keynodes);

            const generatedSpline = generateHybridSpline(body.path_between_key_nodes, 1);
            setPathNodes(generatedSpline);

            if (getRenderKeyNodes() || getRenderFloatingSpline()) {
                renderPath = register('postRenderWorld', () => {
                    if (getRenderKeyNodes()) drawKeyNodes(body.keynodes);
                    if (getRenderFloatingSpline()) drawFloatingSpline(generatedSpline);
                });
            }

            if (currentPathRequest !== requestId) return;

            path = register('tick', () => {
                pathRotations(generatedSpline);
                PathMovement();

                if (!PathComplete()) return;

                called = false;

                path.unregister();
                path = null;

                checkLookaheadYChange(body.path_between_key_nodes);
                PathMovement(false);
                ResetRotations();
                stopPathing();

                global.showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
                if (onComplete && typeof onComplete === 'function') onComplete();
            });
        })
        .catch((err) => {
            if (currentPathRequest !== requestId) return;

            global.showNotification('Pathfinding Error', 'Request failed after retries. See console for details.', 'ERROR', 5000);
            console.error(`Pathfinding request failed: ${err}`);
        });
}

export function findAndFollowPath(start, end, onComplete) {
    const area = Utils.area();

    if (area !== currentIsland) {
        if (Maps[area]) {
            const mapValue = Maps[area];

            loadMap(mapValue, area, () => {
                called = true;
                executePathfinding(start, end, onComplete);
            });
            return;
        } else {
            console.log(`No matching map found for area: ${area}`);
            global.showNotification('Map Error', `Cannot pathfind, no map found for area: ${area}`, 'ERROR', 5000);
            return;
        }
    }

    executePathfinding(start, end, onComplete);
}
