// This is what external modules should import from

import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';
import { stopRotation } from './PathRotations';
import { renderPath } from './PathRenderer';
import {
    setPathNodes,
    setKeyNodes,
    resetMovementState,
    setSplineForRendering,
} from './PathState';
import { startPathing } from './PathEngine';
import { adjustSplineToEyeLevel } from './PathMovement';

const localhost = `${Links.PATHFINDER_API_URL}`;
let renderOnlyRegister = null;

export function stopPathing() {
    global.pathEngineStop?.();
    renderOnlyRegister?.unregister();
    renderOnlyRegister = null;
    resetMovementState();

    try {
        const mc = Client.getMinecraft();
        mc.options.forwardKey.setPressed(false);
        mc.options.sprintKey.setPressed(false);
        mc.options.jumpKey.setPressed(false);
    } catch (e) {}

    stopRotation();
}

export function findAndFollowPath(start, end, renderOnly = false) {
    stopPathing();
    const url = `${localhost}/api/pathfinding?start=${start.join(
        ','
    )}&end=${end.join(',')}&map=mines`;
    Chat.message(
        `§aPathfinding from §e${start.join(', ')}§a to §e${end.join(', ')}`
    );

    request({ url, json: true, timeout: 15000 })
        .then((body) => {
            if (!body?.spline?.length) {
                return global.showNotification(
                    'Pathfinding Failed',
                    'No spline path received from server.',
                    'ERROR',
                    5000
                );
            }

            setPathNodes(body.path || []);
            setKeyNodes(body.keynodes || []);

            const beginPathing = () => {
                if (renderOnly) {
                    const adjustedSpline = adjustSplineToEyeLevel(body.spline);
                    setSplineForRendering(adjustedSpline);
                    renderOnlyRegister = register(
                        'postRenderWorld',
                        renderPath
                    );
                    global.showNotification(
                        'Path Rendered',
                        'Movement not initiated.',
                        'INFO',
                        3000
                    );
                } else {
                    startPathing(body.spline, stopPathing);
                }
            };

            if (body.warp_point && body.warp_point.command) {
                const warpName = body.warp_point.command;
                let tpCommand = null;

                if (Server.getName() === 'SinglePlayer') {
                    switch (warpName) {
                        case '/warp mines':
                            tpCommand = 'tp @s -49 200 -122 -90 0';
                            break;
                        case '/warp forge':
                            tpCommand = 'tp @s 0 149 -68 90 0';
                            break;
                        default:
                            global.showNotification(
                                'Pathfinding Error',
                                `Unknown warp point received: ${warpName}`,
                                'ERROR',
                                4000
                            );
                            return;
                    }
                } else {
                    tpCommand = warpName.slice(1);
                }

                Chat.message(
                    `§aWarp point found! Running command: §e${tpCommand} (might be hardcoded version of warp: ${warpName})`
                );
                ChatLib.command(tpCommand);

                let ticksWaited = 0;
                const postWarpRegister = register('tick', () => {
                    ticksWaited++;
                    if (ticksWaited >= 5) {
                        postWarpRegister.unregister();
                        beginPathing();
                    }
                });
            } else {
                beginPathing();
            }
        })
        .catch((err) => {
            global.showNotification(
                'Pathfinding Error',
                'See console for details.',
                'ERROR',
                5000
            );
            console.log(`Pathfinding request failed: ${err}`);
        });
}
