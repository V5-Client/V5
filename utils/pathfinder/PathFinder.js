import { Chat } from '../Chat';
import { Swift } from './SwiftIntegration';
import { Vec3d, BP } from '../Constants';
import Render from '../render/Render';
import { Spline } from './PathSpline';
import { v5Command } from '../V5Commands';
import { showNotification } from '../../gui/NotificationManager';
import { Rotations } from './PathWalker/PathRotations';
import { Jump } from './PathWalker/PathJumps';
import { Movement } from './PathWalker/PathMovement';
import { Recovery } from './PathWalker/PathRecovery';
import { Executor } from '../ThreadExecutor';
import PathConfig from './PathConfig';
import { PathExecutor } from './PathExecutor';
import { ScheduleTask } from '../ScheduleTask';

class Finder {
    constructor() {
        this.tick = null;
        this.render = null;
        this.saidInfo = false;
        this.calledFromFile = false;

        this.currentEnd = null;
        this.currentCallback = null;
        this.recalculateAttempts = 0;
        this.recalculateRetryQueued = false;
        this.MAX_RECALCULATE_ATTEMPTS = 5;

        v5Command('path', (...args) => {
            if (args.length < 3) return Chat.messagePathfinder('Usage: /v5 path goto x y z [x2 y2 z2...]');

            const coords = args.map(Number);
            if (coords.some(isNaN)) {
                return showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
            }

            let end = coords.length === 3 ? coords : [];
            if (coords.length > 3) {
                for (let i = 0; i < coords.length; i += 3) {
                    end.push([coords[i], coords[i + 1], coords[i + 2]]);
                }
            }

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(end);
        });

        v5Command('stopPath', () => {
            this.resetPath();
            PathExecutor.destroy();
        });
    }

    findPath(end, onComplete, renderOnly = false) {
        this.currentEnd = end;
        this.currentCallback = onComplete;

        const start = this.getPlayerStart();

        if (this.calledFromFile) {
            const endStr = Array.isArray(end[0]) ? `Multiple Goals (${end.length})` : `${end[0]}, ${end[1]}, ${end[2]}`;
            Chat.messagePathfinder(`Path from &a${start.x}, ${start.y}, ${start.z}&f to &c${endStr}`);
        }

        if (!Swift.SwiftPath(start.x, start.y, start.z, end)) {
            showNotification('Pathfinding Failed', Swift.getLastError() || 'Failed to start', 'ERROR', 5000);
            return;
        }

        if (this.calledFromFile && PathConfig.PATHFINDING_DEBUG) {
            Chat.messagePathfinder('§eSearching for path...');
        }

        this.startTick(renderOnly);
    }

    startTick(renderOnly) {
        if (this.tick) return;

        PathExecutor.execute();

        this.tick = register('tick', () => {
            if (Swift.isSearching()) return;

            const result = Swift.getResult();

            if (!result || !result.keynodes?.length) {
                if (this.checkIfReachedDestination()) {
                    this.finishSuccess();
                } else {
                    if (this.recalculateAttempts > 0 && !this.recalculateRetryQueued) {
                        this.recalculateRetryQueued = true;
                        this.retryRecalculate();
                        return;
                    }

                    Chat.messagePathfinder('§cNo path found');

                    this.callCallback(false);
                    this.resetPath();
                    PathExecutor.destroy();
                }
                return;
            }

            if (!this.saidInfo && this.calledFromFile && PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder(`Path found: ${result.path.length} nodes in ${result.time_ms}ms`);
                this.saidInfo = true;
            }

            const splinePath = this.createSplinePath(result);

            if (PathConfig.RENDER_KEY_NODES || PathConfig.RENDER_FLOATING_SPLINE || PathConfig.RENDER_LOOK_POINTS) {
                this.startRender(result, splinePath);
            }

            if (renderOnly) {
                showNotification('Render Only', 'Path rendered.', 'INFO', 3000);
                this.destroyTick();
                return;
            }

            if (!splinePath?.length) return;

            if (Rotations.boxPositions?.length && Rotations.complete) {
                this.checkIfReachedDestination() ? this.finishSuccess() : this.recalculate();
                return;
            }

            Executor.execute(() => {
                Rotations.pathRotations(splinePath);
                Jump.detectJump(result.path_between_key_nodes);
                Movement.beginMovement();

                if (this.recalculateAttempts > 0 && Recovery.hasMadeProgress()) {
                    if (PathConfig.PATHFINDING_DEBUG) {
                        Chat.messagePathfinder('§aUnstuck!');
                    }
                    this.recalculateAttempts = 0;
                    Recovery.stop();
                }

                this.handleRecovery(Recovery.trackProgress());
            });
        });
    }

    handleRecovery(action) {
        if (!action) return;

        switch (action) {
            case 'JUMP':
                Movement.forceJump(4);
                break;
            case 'CLOSE_LOOK':
                Rotations.setTemporaryLookahead(Rotations.RECOVERY_MIN_LOOKAHEAD, 40);
                //Movement.forceJump(4);
                break;
            case 'BACKUP_RECALC':
                Movement.backup(15, () => this.recalculate());
                break;
        }
    }

    recalculate() {
        this.recalculateAttempts++;
        this.recalculateRetryQueued = false;

        if (this.recalculateAttempts > this.MAX_RECALCULATE_ATTEMPTS) {
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder('§cMax recalculation attempts, failed!');
            }
            this.callCallback(false);
            this.resetPath();
            PathExecutor.destroy();
            return;
        }

        if (PathConfig.PATHFINDING_DEBUG) {
            Chat.messagePathfinder(`§eRecalculating (${this.recalculateAttempts}/${this.MAX_RECALCULATE_ATTEMPTS})`);
        }

        const end = this.currentEnd;
        const callback = this.currentCallback;
        const wasFromFile = this.calledFromFile;
        const attempts = this.recalculateAttempts;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(3, () => {
            if (this.currentEnd === null) return;
            this.currentEnd = end;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;
            this.findPath(end, callback, false);
        });
    }

    retryRecalculate() {
        const end = this.currentEnd;
        const callback = this.currentCallback;
        const wasFromFile = this.calledFromFile;
        const attempts = this.recalculateAttempts;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(5, () => {
            if (this.currentEnd === null) return;

            this.currentEnd = end;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;

            this.findPath(end, callback, false);
        });
    }

    checkIfReachedDestination() {
        if (!this.currentEnd) return true;

        const player = Player.getPlayer();
        if (!player) return false;

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        const goals = Array.isArray(this.currentEnd[0]) ? this.currentEnd : [this.currentEnd];

        for (const goal of goals) {
            const destX = goal[0];
            const destY = goal[1];
            const destZ = goal[2];

            const dx = pX - destX;
            const dy = pY - destY;
            const dz = pZ - destZ;

            const hDistSq = dx * dx + dz * dz;
            if (hDistSq > 2.0 * 2.0) continue;

            if (dy < -0.1 || dy > 2.5) continue;

            if (player.isOnGround()) {
                return true;
            }
        }
        return false;
    }

    finishSuccess() {
        showNotification('Path Complete', 'Destination reached!', 'SUCCESS', 2000);
        this.callCallback(true);
        this.resetPath();
        PathExecutor.destroy();
    }

    callCallback(success) {
        if (typeof this.currentCallback === 'function') {
            try {
                this.currentCallback(success);
            } catch (e) {
                console.error('Path callback error:', e);
            }
        }
    }

    getPlayerStart() {
        const x = Math.floor(Player.getX());
        const z = Math.floor(Player.getZ());
        let y = Math.round(Player.getY());

        for (let i = 0; i < 5; i++) {
            if (this.isBlockWalkable(x, y, z)) return { x, y, z };
            y--;
        }
        return { x, y: Math.round(Player.getY()) - 1, z };
    }

    isBlockWalkable(x, y, z) {
        const pos = new BP(x, y, z);
        const world = World.getWorld();
        return world.getBlockState(pos).getCollisionShape(world, pos).isEmpty();
    }

    createSplinePath(path) {
        if (!path) return null;
        const nodes = path.path_between_key_nodes?.length ? path.path_between_key_nodes : path.keynodes;
        return nodes?.length ? Spline.generateSpline(nodes, 1) : null;
    }

    startRender(result, splinePath) {
        if (this.render) return;

        this.render = register('postRenderWorld', () => {
            if (PathConfig.RENDER_KEY_NODES && result.keynodes?.length >= 2) {
                result.keynodes.forEach((node) => {
                    Render.drawStyledBox(new Vec3d(node.x, node.y, node.z), Render.Color(0, 100, 200, 120), Render.Color(0, 100, 200, 255), 4, true);
                });
            }
            if (PathConfig.RENDER_FLOATING_SPLINE) Spline.drawFloatingSpline(splinePath);
            if (PathConfig.RENDER_LOOK_POINTS) Spline.drawLookPoints();
        });
    }

    destroyTick() {
        if (this.tick) {
            this.tick.unregister();
            this.tick = null;
        }
    }

    destroyRender() {
        if (this.render) {
            this.render.unregister();
            this.render = null;
        }
    }

    resetPath(clearFlags = true) {
        this.destroyTick();
        this.destroyRender();
        Rotations.resetRotations();
        Spline.clearCache();
        Jump.reset();
        Movement.stopMovement();
        if (clearFlags) {
            Recovery.stop();
        } else {
            Recovery.resetTracking();
        }
        Swift.cancel();
        Swift.clear();

        if (clearFlags) {
            this.saidInfo = false;
            this.calledFromFile = false;
            this.currentEnd = null;
            this.currentCallback = null;
            this.recalculateAttempts = 0;
            this.recalculateRetryQueued = false;
        }
    }

    isPathing() {
        return !!this.tick;
    }
}

const Pathfinder = new Finder();
export default Pathfinder;
