import { Chat } from '../Chat';
import { Swift } from './SwiftIntegration';
import { Vec3d, BP } from '../Constants';
import RenderUtils from '../render/RendererUtils';
import { Spline } from './PathSpline';
import { v5Command } from '../V5Commands';
import { showNotification } from '../../gui/NotificationManager';
import { Rotations } from './Pathwalker/PathRotations';
import { Jump } from './Pathwalker/PathJumps';
import { Movement } from './Pathwalker/PathMovement';
import { Executor } from '../ThreadExecutor';
import PathConfig from './PathConfig';
import { Recovery } from './Pathwalker/PathRecovery';

class Finder {
    constructor() {
        this.tick = null;
        this.render = null;
        this.saidInfo = false;
        this.calledFromFile = false;

        v5Command('path', (...args) => {
            const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
            const coords = args.slice(0, 3).map(Number);
            if (coords.some(isNaN)) {
                return showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
            }
            const end = coords.slice(0, 3);

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(start, end);
        });

        v5Command('stopPath', () => {
            this.resetPath();
        });
    }

    findPath(start, end, onComplete, renderOnly = false) {
        const PathStart = this.findStartY(start);

        if (this.calledFromFile) Chat.messagePathfinder(`Path from &a${PathStart.x}, ${PathStart.y}, ${PathStart.z}&f to &c${end[0]}, ${end[1]}, ${end[2]}`);

        const fullPath = Swift.SwiftPath(PathStart.x, PathStart.y, PathStart.z, end[0], end[1], end[2]);

        if (!fullPath) {
            const error = Swift.getLastError() || 'Failed to start pathfinding';
            showNotification('Pathfinding Failed', error, 'ERROR', 5000);
            //  console.error('Pathfinding failed to start:', error);
            //  currentDestination = null;
            //  if (onComplete && typeof onComplete === 'function') onComplete(false);
            return;
        }

        if (this.calledFromFile) Chat.messagePathfinder('§eSearching for path...');

        this.onTick(onComplete, renderOnly);
    }

    onTick(onComplete, renderOnly) {
        if (this.tick) return;

        this.tick = register('tick', () => {
            if (Swift.isSearching()) return;

            const result = Swift.getResult();

            if (!result) {
                showNotification('Pathfinding Failed', 'Failed to get path result', 'ERROR', 5000);
                if (onComplete && typeof onComplete === 'function') onComplete(false);
                this.destroyTick();
                return;
            }

            if (!result.keynodes || !Array.isArray(result.keynodes) || result.keynodes.length < 1) {
                showNotification('Pathfinding Failed', 'No path nodes received.', 'ERROR', 5000);
                console.error('Invalid keynodes in response:', result);
                if (onComplete && typeof onComplete === 'function') onComplete(false);
                this.destroyTick();
                return;
            }

            if (!this.saidInfo && this.calledFromFile) {
                Chat.messagePathfinder(`Path length: ${result.path.length} nodes`);
                Chat.messagePathfinder(`Path found in ${result.time_ms}ms`);
                Chat.messagePathfinder(`Nodes explored: ${result.nodes_explored}`);
                Chat.messagePathfinder(`Nanoseconds per node: ${((result.time_ms * 10000) / result.path.length).toFixed(2)}ns`);

                this.saidInfo = true;
            }

            const splinePath = this.createSplinePath(result);

            if (PathConfig.RENDER_KEY_NODES || PathConfig.RENDER_FLOATING_SPLINE) {
                this.onRender(result, splinePath);
            }

            if (renderOnly) {
                showNotification('Render Only', 'Path rendered. Use /stop to clear.', 'INFO', 3000);
                return;
            }

            if (splinePath) {
                if (Rotations.complete || Rotations.boxPositions?.length < 2) {
                    this.tick.unregister();
                    this.tick = null;

                    this.calledFromFile = false;
                    this.resetPath();

                    if (onComplete && typeof onComplete === 'function') onComplete(true);
                    showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
                    return;
                }

                Executor.execute(() => {
                    Rotations.pathRotations(splinePath);
                    Jump.detectJump(splinePath);
                    Movement.beginMovement();
                    // Recovery.trackProgress();
                });
            }
        });
    }

    onRender(cleanPath, splinePath) {
        if (this.render) return;

        this.render = register('postRenderWorld', () => {
            if (PathConfig.RENDER_KEY_NODES) {
                if (!cleanPath.keynodes || cleanPath.keynodes.length < 2) return;
                cleanPath.keynodes.forEach((keynode) => {
                    RenderUtils.drawStyledBox(new Vec3d(keynode.x, keynode.y, keynode.z), [0, 100, 200, 120], [0, 100, 200, 255], 4, true);
                });

                for (let i = 0; i < cleanPath.keynodes.length - 1; i++) {
                    const current = cleanPath.keynodes[i];
                    const next = cleanPath.keynodes[i + 1];

                    RenderUtils.drawLine(
                        new Vec3d(current.x + 0.5, current.y + 1, current.z + 0.5),
                        new Vec3d(next.x + 0.5, next.y + 1, next.z + 0.5),
                        [0, 150, 255, 255],
                        3,
                        true
                    );
                }
            }

            if (PathConfig.RENDER_FLOATING_SPLINE) {
                Spline.drawFloatingSpline(splinePath);
            }
        });
    }

    createSplinePath(path) {
        if (!path) return;
        let generatedSpline = [];

        if (this.checkForExistence(path.path_between_key_nodes)) {
            generatedSpline = Spline.GenerateSpline(path.path_between_key_nodes, 1);

            return generatedSpline;
        }

        Chat.log('No path_between_key_nodes, using keynodes for spline');
        generatedSpline = Spline.GenerateSpline(path.keynodes, 1);

        return generatedSpline;
    }

    checkForExistence(item) {
        if (item && Array.isArray(item) && item.length) {
            return true;
        }

        return false;
    }

    destroyTick() {
        if (!this.tick) return;
        this.tick.unregister();
        this.tick = null;
    }

    destroyRender() {
        if (!this.render) return;
        this.render.unregister();
        this.render = null;
    }

    resetPath() {
        this.destroyTick();
        this.destroyRender();

        Rotations.resetRotations();
        Jump.reset();
        Movement.stopMovement();
        Recovery.stop();

        this.saidInfo = false;
        this.tick = null;
        this.render = null;
    }

    findStartY(coords) {
        let y = coords[1] + 1;
        const maxDistance = 100;

        for (let i = 0; i < maxDistance; i++) {
            if (y <= 0) return y;
            const blockVec = { x: coords[0], y: y, z: coords[2] };

            if (!this.isBlockWalkable(blockVec)) return blockVec;

            y--;
        }

        return blockVec;
    }

    isBlockWalkable(blockVec) {
        const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
        const blockState = World.getWorld().getBlockState(blockPosNMS);
        const collisionShape = blockState.getCollisionShape(World.getWorld(), blockPosNMS);
        return collisionShape.isEmpty();
    }
}

const Pathfinder = new Finder();
export default Pathfinder;
