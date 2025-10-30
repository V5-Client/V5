import request from 'requestV2';
import { Links, Vec3d } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';
import { generateHybridSpline, renderSplineBoxes, drawFloatingSpline } from './PathDebug';
import { resetStuckRecovery } from './PathWalker/PathStuckRecovery';
import { PathMovement } from './PathWalker/PathMovement';
import { pathRotations, PathComplete, ResetRotations } from './PathWalker/PathRotations';
import RenderUtils from '../Rendering/RendererUtils';
import { getRenderKeyNodes, getRenderFloatingSpline, PathfindingMessages } from './PathConfig';
import { Rotations } from '../Utility/Rotations';

const localhost = `${Links.PATHFINDER_API_URL}`;
let renderOnlyRegister = null;
let currentPathRequest = null;
let tickRegister = null;

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
    Rotations.stopRotation();

    if (tickRegister) {
        tickRegister.unregister();
        tickRegister = null;
    }
    if (renderOnlyRegister) {
        renderOnlyRegister.unregister();
        renderOnlyRegister = null;
    }
    currentPathRequest = null;
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

function findGroundY(x, initialY, z) {
    let y = initialY;
    const maxDistance = 50;

    for (let i = 0; i < maxDistance; i++) {
        if (y <= 0 || !World.getBlockAt(x, y, z)?.type?.getRegistryName().includes('air')) {
            return y;
        }
        y--;
    }
    return y;
}

export function findAndFollowPath(start, end, renderOnly = false, onComplete = null) {
    stopPathing();

    const startGroundY = findGroundY(Math.floor(start[0]), Math.floor(start[1]), Math.floor(start[2]));

    const endGroundY = findGroundY(Math.floor(end[0]), Math.floor(end[1]), Math.floor(end[2]));

    const startAdjusted = [Math.floor(start[0]), startGroundY, Math.floor(start[2])];
    const endAdjusted = [Math.floor(end[0]), endGroundY, Math.floor(end[2])];

    const url = `${localhost}/api/pathfinding?start=${startAdjusted.join(',')}&end=${endAdjusted.join(',')}&map=mines`;
    PathfindingMessages(`Path from ${startAdjusted.join(', ')} to ${endAdjusted.join(', ')}`);

    const requestId = Date.now();
    currentPathRequest = requestId;

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (currentPathRequest !== requestId) return;

            if (!body || !body.keynodes || body.keynodes.length < 1) {
                return global.showNotification('Pathfinding Failed', 'No path nodes received to generate a curve.', 'ERROR', 5000);
            }

            if (body.path && body.path.length) setPathNodes(body.path);
            if (body.keynodes && body.keynodes.length) setKeyNodes(body.keynodes);

            const generatedSpline = generateHybridSpline(body.path_between_key_nodes, 1);
            setPathNodes(generatedSpline);

            if (renderOnlyRegister) {
                renderOnlyRegister.unregister();
                renderOnlyRegister = null;
            }
            if (getRenderKeyNodes() || getRenderFloatingSpline()) {
                renderOnlyRegister = register('postRenderWorld', () => {
                    if (getRenderKeyNodes()) drawKeyNodes(body.keynodes);
                    if (getRenderFloatingSpline()) drawFloatingSpline(generatedSpline);
                });
            }

            const beginPathing = () => {
                if (currentPathRequest !== requestId) return;
                if (renderOnly) {
                    global.showNotification('Path Rendered', 'Movement not initiated.', 'INFO', 3000);
                } else {
                    resetStuckRecovery();
                    tickRegister = register('tick', () => {
                        pathRotations(generatedSpline);
                        PathMovement();
                        if (PathComplete()) {
                            tickRegister.unregister();
                            tickRegister = null;
                            PathMovement(false);
                            ResetRotations();
                            stopPathing();

                            PathfindingMessages('Path Complete!');
                            global.showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
                            if (onComplete && typeof onComplete === 'function') onComplete();
                        }
                    });
                }
            };

            if (body.warp_point && body.warp_point.command) {
                handleWarp(body.warp_point.command, beginPathing);
            } else {
                beginPathing();
            }
        })
        .catch((err) => {
            if (currentPathRequest !== requestId) return;
            global.showNotification('Pathfinding Error', 'See console for details.', 'ERROR', 5000);
            console.log(`Pathfinding request failed: ${err}`);
        });
}
