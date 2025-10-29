import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';
import { stopRotation } from './PathRotations';
import { renderPath } from './PathRenderer';
import { setPathNodes, setKeyNodes, resetMovementState, setSplineForRendering } from './PathState';
import { startPathing } from './PathEngine';
import { adjustSplineToEyeLevel } from './PathMovement';

const localhost = `${Links.PATHFINDER_API_URL}`;
let renderOnlyRegister = null;
let currentPathRequest = null;

export function stopPathing() {
    if (global.pathEngineStop) global.pathEngineStop();
    if (renderOnlyRegister) renderOnlyRegister.unregister();
    renderOnlyRegister = null;
    currentPathRequest = null;
    resetMovementState();

    try {
        const mc = Client.getMinecraft();
        mc.options.forwardKey.setPressed(false);
        mc.options.sprintKey.setPressed(false);
        mc.options.jumpKey.setPressed(false);
    } catch (e) {}

    stopRotation();
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

export function findAndFollowPath(start, end, renderOnly = false) {
    stopPathing();

    const url = `${localhost}/api/pathfinding?start=${start.join(',')}&end=${end.join(',')}&map=mines`;
    Chat.message(`§aPathfinding from §e${start.join(', ')}§a to §e${end.join(', ')}`);

    const requestId = Date.now();
    currentPathRequest = requestId;

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (currentPathRequest !== requestId) {
                console.log('Outdated path response ignored.');
                return;
            }

            if (!body || !body.spline || !body.spline.length) {
                return global.showNotification('Pathfinding Failed', 'No spline path received from server.', 'ERROR', 5000);
            }

            setPathNodes(body.path || []);
            setKeyNodes(body.keynodes || []);

            const beginPathing = () => {
                if (currentPathRequest !== requestId) return;

                if (renderOnly) {
                    const adjustedSpline = adjustSplineToEyeLevel(body.spline);
                    setSplineForRendering(adjustedSpline);
                    renderOnlyRegister = register('postRenderWorld', renderPath);
                    global.showNotification('Path Rendered', 'Movement not initiated.', 'INFO', 3000);
                } else {
                    startPathing(body.spline, end, stopPathing);
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
