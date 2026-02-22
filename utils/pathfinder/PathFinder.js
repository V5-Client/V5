import { showNotification } from '../../gui/NotificationManager';
import { Chat } from '../Chat';
import { BP, Vec3d } from '../Constants';
import Render from '../render/Render';
import { ScheduleTask } from '../ScheduleTask';
import { Executor } from '../ThreadExecutor';
import { MathUtils } from '../Math';
import { Utils } from '../Utils';
import { v5Command } from '../V5Commands';
import PathConfig from './PathConfig';
import { PathExecutor } from './PathExecutor';
import { FlyMovement } from './PathFlyer/PathMovement';
import { FlyRotations } from './PathFlyer/PathRotations';
import { Spline } from './PathSpline';
import { Jump } from './PathWalker/PathJumps';
import { Movement } from './PathWalker/PathMovement';
import { Recovery } from './PathWalker/PathRecovery';
import { Rotations } from './PathWalker/PathRotations';
import { Swift } from './SwiftIntegration';

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

        this.currentStarts = null;
        this.startCandidates = [];
        this.selectedStartCandidate = null;
        this.warpCommandIssued = false;
        this.warpRetryCount = 0;
        this.warpLastAttemptAt = 0;
        this.hasReachedWarpPoint = false;
        this.WARP_RETRY_TIMEOUT_MS = 7000;
        this.MAX_WARP_RETRIES = 3;

        this.flyStarted = false;
        this.flyStartDelayTicks = 0;
        this.flyLookPoints = null;
        this.flyMovementPath = null;
        this.flySplinePath = null;

        v5Command('path', (...args) => {
            const end = this.parseGoalCoordinates(args, 'Usage: /v5 path goto x y z [x2 y2 z2...]');
            if (!end) return;

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(end);
        });

        v5Command('flypath', (...args) => {
            const end = this.parseGoalCoordinates(args, 'Usage: /v5 path fly <x> <y> <z> [x2 y2 z2...]');
            if (!end) return;

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(end, null, false, true);
        });

        v5Command('stopPath', () => {
            this.resetPath();
            PathExecutor.destroy();
        });
    }

    parseGoalCoordinates(args, usageText) {
        if (args.length < 3 || args.length % 3 !== 0) {
            Chat.messagePathfinder(usageText);
            return null;
        }

        const coords = args.map(Number);
        if (coords.some(Number.isNaN)) {
            showNotification('Invalid Coordinates', 'All coordinates must be valid numbers.', 'ERROR', 5000);
            return null;
        }

        const goals = [];
        for (let i = 0; i < coords.length; i += 3) {
            goals.push([coords[i], coords[i + 1], coords[i + 2]]);
        }

        return goals;
    }

    findPath(end, onComplete, renderOnly = false, isFly = false, startPoints = null) {
        this.currentEnd = end;
        this.currentStarts = startPoints;
        this.currentCallback = onComplete;
        this.isFly = isFly;

        const { points: starts, metadata: startMetadata } = this.createStartPoints(startPoints);
        if (!starts?.length) {
            showNotification('Pathfinding Failed', 'No valid start points were provided.', 'ERROR', 5000);
            return;
        }

        this.startCandidates = startMetadata;
        this.selectedStartCandidate = null;
        this.warpCommandIssued = false;
        this.warpRetryCount = 0;
        this.warpLastAttemptAt = 0;
        this.recalculateAttempts = 0;
        this.hasReachedWarpPoint = false;

        const start = starts[0];

        if (this.calledFromFile) {
            const endStr = end.length > 1 ? `Multiple Goals (${end.length})` : `${end[0][0]}, ${end[0][1]}, ${end[0][2]}`;
            Chat.messagePathfinder(`Path from &a${start[0]}, ${start[1]}, ${start[2]}&f to &c${endStr}`);
        }

        if (!Swift.SwiftPath(starts, end, isFly)) {
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

                    const reason = Swift.getLastError();
                    Chat.messagePathfinder('§cNo path found' + (reason ? ': ' + reason : ''));

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

            if (!this.handleStartPointWarp(result)) return;

            if (!this.isFly) {
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
            } else if (this.isFly) {
                if (!this.flyStarted) {
                    const { lookPoints, movementPath } = Spline.createFlyPaths(result.path);
                    this.flyLookPoints = lookPoints;
                    this.flyMovementPath = movementPath;
                    this.flySplinePath = this.createSplinePath(result);

                    FlyRotations.beginFlyRotations(this.flyLookPoints);
                    FlyMovement.beginMovement(this.flyMovementPath);

                    this.flyStarted = true;
                    this.flyStartDelayTicks = 2;
                }

                if (this.flyStartDelayTicks > 0) {
                    this.flyStartDelayTicks--;
                }

                if (this.flyStarted && this.flyStartDelayTicks === 0) {
                    if (FlyRotations.complete && FlyMovement.isActive) {
                        FlyMovement.requestDeceleration();
                    }

                    if (this.checkIfReachedDestination()) {
                        this.finishSuccess();
                        return;
                    }

                    if (FlyMovement.isActive === false) {
                        if (FlyMovement.complete && FlyRotations.complete) {
                            this.finishSuccess();
                            return;
                        }

                        this.callCallback(false);
                        this.resetPath();
                        PathExecutor.destroy();
                        return;
                    }
                }

                if (this.render) return;

                const shouldRenderFly = PathConfig.RENDER_KEY_NODES || PathConfig.RENDER_FLOATING_SPLINE || PathConfig.RENDER_LOOK_POINTS;
                if (!shouldRenderFly) return;

                this.render = register('postRenderWorld', () => {
                    if (PathConfig.RENDER_KEY_NODES && result.keynodes?.length >= 2) {
                        result.keynodes.forEach((node) => {
                            Render.drawStyledBox(new Vec3d(node.x, node.y, node.z), Render.Color(0, 100, 200, 120), Render.Color(0, 100, 200, 255), 4, true);
                        });
                    }

                    if (PathConfig.RENDER_FLOATING_SPLINE) {
                        Spline.drawFloatingSpline(this.flySplinePath);
                    }

                    if (PathConfig.RENDER_LOOK_POINTS) {
                        this.flyLookPoints?.forEach((p) => Render.drawBox(p, Render.Color(255, 0, 0, 150), true));
                    }
                });
            }
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
        const starts = this.currentStarts;
        const callback = this.currentCallback;
        const wasFromFile = this.calledFromFile;
        const attempts = this.recalculateAttempts;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(3, () => {
            if (this.currentEnd === null) return;
            this.currentEnd = end;
            this.currentStarts = starts;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;
            this.findPath(end, callback, false, this.isFly, starts);
        });
    }

    retryRecalculate() {
        const end = this.currentEnd;
        const starts = this.currentStarts;
        const callback = this.currentCallback;
        const wasFromFile = this.calledFromFile;
        const attempts = this.recalculateAttempts;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(5, () => {
            if (this.currentEnd === null) return;

            this.currentEnd = end;
            this.currentStarts = starts;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;

            this.findPath(end, callback, false, this.isFly, starts);
        });
    }

    checkIfReachedDestination() {
        if (!this.currentEnd) return true;

        const player = Player.getPlayer();
        if (!player) return false;

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        const goals = this.currentEnd;

        for (const goal of goals) {
            const destX = goal[0];
            const destY = goal[1];
            const destZ = goal[2];

            const dx = pX - destX;
            const dy = pY - destY;
            const dz = pZ - destZ;

            const hDistSq = dx * dx + dz * dz;
            if (hDistSq > 2.5 * 2.5) continue;

            if (this.isFly) {
                if (Math.abs(dy) > 4.5) continue;
            } else {
                if (dy < -0.1 || dy > 5.5) continue;
            }

            if (this.isFly || player.isOnGround()) {
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

    createStartPoints(startPoints) {
        if (startPoints) {
            return {
                points: startPoints,
                metadata: startPoints.map((point) => ({
                    type: 'custom',
                    point: [point[0], point[1], point[2]],
                })),
            };
        }

        const points = [];
        const metadata = [];

        const start = this.getPlayerStart();
        const playerPoint = [start.x, start.y, start.z];

        points.push(playerPoint);
        metadata.push({
            type: 'player',
            point: [playerPoint[0], playerPoint[1], playerPoint[2]],
        });

        PathConfig.getAreaWarpPoints(Utils.area()).forEach((warpPoint) => {
            const point = [warpPoint.x, warpPoint.y, warpPoint.z];
            points.push(point);
            metadata.push({
                type: 'warp',
                warp: warpPoint.warp,
                area: warpPoint.area,
                point: [point[0], point[1], point[2]],
            });
        });

        return { points, metadata };
    }

    handleStartPointWarp(result) {
        if (!this.selectedStartCandidate) {
            this.selectedStartCandidate = this.resolvePathStartCandidate(result);
        }

        if (this.selectedStartCandidate.type !== 'warp') {
            return true;
        }

        if (this.isPlayerAtWarpPoint(this.selectedStartCandidate.point)) {
            return true;
        } else {
            this.issueWarpCommand();
            return false;
        }
    }

    issueWarpCommand() {
        const warpName = this.selectedStartCandidate?.warp;
        if (!warpName) return;

        if (!this.warpCommandIssued) {
            this.warpCommandIssued = true;
            this.warpLastAttemptAt = Date.now();
            ChatLib.command(`warp ${warpName}`);
            return;
        }

        const now = Date.now();
        if (now - this.warpLastAttemptAt < this.WARP_RETRY_TIMEOUT_MS) {
            return;
        }

        if (this.warpRetryCount >= this.MAX_WARP_RETRIES) {
            this.failWarpPathfinding();
            return;
        }

        this.warpRetryCount++;
        this.warpCommandIssued = true;
        this.warpLastAttemptAt = now;
        ChatLib.command(`warp ${warpName}`);
        return;
    }

    failWarpPathfinding() {
        const warpName = this.selectedStartCandidate?.warp || 'unknown';
        Chat.messagePathfinder(`§cFailed to warp to ${warpName} after ${this.MAX_WARP_RETRIES} retries.`);
        showNotification('Pathfinding Failed', `Warp ${warpName} failed after ${this.MAX_WARP_RETRIES} retries.`, 'ERROR', 5000);
        this.callCallback(false);
        this.resetPath();
        PathExecutor.destroy();
    }

    isPlayerAtWarpPoint(point) {
        if (this.hasReachedWarpPoint) return true;

        const dist = MathUtils.getDistanceToPlayer(point[0], point[1], point[2]);
        if (dist.distance <= 5) {
            this.hasReachedWarpPoint = true;
            return true;
        }

        return false;
    }

    // The pathfinder doesnt explicity state what start point was used.
    // Check all start points with the first node to find the closest to see which one was used.
    resolvePathStartCandidate(result) {
        const firstNode = result?.path?.[0];
        if (!firstNode) return this.startCandidates[0];

        let bestCandidate = this.startCandidates[0];
        let bestDistance = Number.MAX_VALUE;

        this.startCandidates.forEach((candidate) => {
            if (!candidate?.point || candidate.point.length < 3) return;
            const distance = this.getStartNodeDistanceSq(firstNode, candidate.point);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestCandidate = candidate;
            }
        });

        return bestCandidate;
    }

    getStartNodeDistanceSq(node, point) {
        const compareY = this.isFly ? point[1] : point[1] + 1;
        const dx = node.x - point[0];
        const dy = node.y - compareY;
        const dz = node.z - point[2];
        return dx * dx + dy * dy + dz * dz;
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
        FlyRotations.resetRotations();
        Spline.clearCache();
        Jump.reset();
        Movement.stopMovement();
        FlyMovement.stopMovement();
        if (clearFlags) {
            Recovery.stop();
        } else {
            Recovery.resetTracking();
        }
        Swift.cancel();
        Swift.clear();

        this.flyStarted = false;
        this.flyStartDelayTicks = 0;
        this.flyLookPoints = null;
        this.flyMovementPath = null;
        this.flySplinePath = null;
        this.startCandidates = [];
        this.selectedStartCandidate = null;
        this.warpCommandIssued = false;
        this.warpRetryCount = 0;
        this.warpLastAttemptAt = 0;

        if (clearFlags) {
            this.saidInfo = false;
            this.calledFromFile = false;
            this.currentEnd = null;
            this.currentStarts = null;
            this.currentCallback = null;
            this.recalculateAttempts = 0;
            this.recalculateRetryQueued = false;
            this.isFly = false;
            this.hasReachedWarpPoint = false;
        }
    }

    isPathing() {
        return !!this.tick;
    }
}

const Pathfinder = new Finder();
export default Pathfinder;
