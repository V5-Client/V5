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

        this.currentStart = null;
        this.currentEnd = null;

        this.isRecalculating = false;
        this.failCount = 0;

        v5Command('path', (...args) => {
            const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];

            if (args.length < 3) return Chat.messagePathfinder('Usage: /path x y z [x2 y2 z2...]');

            const coords = args.map(Number);
            if (coords.some(isNaN)) {
                return showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
            }

            let end;
            if (coords.length === 3) {
                end = coords;
            } else {
                end = [];
                for (let i = 0; i < coords.length; i += 3) {
                    end.push([coords[i], coords[i + 1], coords[i + 2]]);
                }
            }

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(start, end);
        });

        v5Command('stopPath', () => {
            this.resetPath();
        });
    }

    findPath(start, end, onComplete, renderOnly = false) {
        this.currentStart = start;
        this.currentEnd = end;
        this.calledOnComplete = onComplete;

        const PathStart = this.findStartY(start);

        if (this.calledFromFile) {
            let endStr = Array.isArray(end[0]) ? `Multiple Goals (${end.length})` : `${end[0]}, ${end[1]}, ${end[2]}`;
            Chat.messagePathfinder(`Path from &a${PathStart.x}, ${PathStart.y}, ${PathStart.z}&f to &c${endStr}`);
        }

        const fullPath = Swift.SwiftPath(PathStart.x, PathStart.y, PathStart.z, end);

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

            if (!result.keynodes || result.keynodes.length < 1) {
                if (this.checkIfReachedDestination()) {
                    this.finishSuccess(onComplete);
                } else {
                    this.recalculate();
                }
                return;
            }

            if (!this.saidInfo && this.calledFromFile) {
                Chat.messagePathfinder(`Path found: ${result.path.length} nodes in ${result.time_ms}ms`);
                this.saidInfo = true;
                this.failCount = 0;
            }

            const splinePath = this.createSplinePath(result);

            if (PathConfig.RENDER_KEY_NODES || PathConfig.RENDER_FLOATING_SPLINE || PathConfig.RENDER_LOOK_POINTS) {
                this.onRender(result, splinePath);
            }

            if (renderOnly) {
                showNotification('Render Only', 'Path rendered. Use /stop to clear.', 'INFO', 3000);
                this.destroyTick();
                return;
            }

            if (splinePath && splinePath.length > 1) {
                const rotationsReady = Rotations.boxPositions && Rotations.boxPositions.length > 0;

                if (rotationsReady && Rotations.complete) {
                    if (this.checkIfReachedDestination()) {
                        this.finishSuccess(onComplete);
                    } else {
                        Chat.messagePathfinder('§ePath ended but destination not reached. Recalculating.');
                    }
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

    checkIfReachedDestination() {
        if (!this.currentEnd) return true;

        const pX = Player.getX();
        const pY = Player.getY();
        const pZ = Player.getZ();

        let goals = [];
        if (Array.isArray(this.currentEnd[0])) goals = this.currentEnd;
        else goals = [this.currentEnd];

        for (let goal of goals) {
            const dx = pX - goal[0];
            const dy = pY - goal[1];
            const dz = pZ - goal[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (Math.sqrt(dx * dx + dz * dz) < 2.5 && Math.abs(dy) < 3.0) {
                return true;
            }
        }
        return false;
    }

    finishSuccess(onComplete) {
        this.destroyTick();
        this.calledFromFile = false;
        this.resetPath();
        if (onComplete && typeof onComplete === 'function') onComplete(true);
        showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
    }

    onRender(cleanPath, splinePath) {
        if (this.render) return;

        this.render = register('postRenderWorld', () => {
            if (PathConfig.RENDER_KEY_NODES) {
                if (!cleanPath.keynodes || cleanPath.keynodes.length < 2) return;
                cleanPath.keynodes.forEach((keynode) => {
                    RenderUtils.drawStyledBox(new Vec3d(keynode.x, keynode.y, keynode.z), [0, 100, 200, 120], [0, 100, 200, 255], 4, true);
                });
            }

            if (PathConfig.RENDER_FLOATING_SPLINE) {
                Spline.drawFloatingSpline(splinePath);
            }

            if (PathConfig.RENDER_LOOK_POINTS) {
                Spline.drawLookPoints();
            }
        });
    }

    createSplinePath(path) {
        if (!path) return;
        let generatedSpline = [];

        if (this.checkForExistence(path.path_between_key_nodes)) {
            generatedSpline = Spline.generateSpline(path.path_between_key_nodes, 1);
            return generatedSpline;
        }

        generatedSpline = Spline.generateSpline(path.keynodes, 1);
        return generatedSpline;
    }

    checkForExistence(item) {
        return item && Array.isArray(item) && item.length;
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
        Spline.clearCache();
        Jump.reset();
        Movement.stopMovement();
        Recovery.stop();

        this.saidInfo = false;
        this.tick = null;
        this.render = null;
    }

    isPathing() {
        return !!this.tick;
    }

    findStartY(coords) {
        let y = coords[1] + 1;

        for (let i = 0; i < 5; i++) {
            if (this.isBlockWalkable({ x: coords[0], y: y, z: coords[2] })) return { x: coords[0], y: y, z: coords[2] };
            y--;
        }
        return { x: coords[0], y: coords[1], z: coords[2] };
    }

    isBlockWalkable(blockVec) {
        const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
        const blockState = World.getWorld().getBlockState(blockPosNMS);
        return blockState.getCollisionShape(World.getWorld(), blockPosNMS).isEmpty();
    }
}

const Pathfinder = new Finder();
export default Pathfinder;
