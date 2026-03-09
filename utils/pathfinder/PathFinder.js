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
import { Aote } from './PathWalker/PathAote';
import { Movement } from './PathWalker/PathMovement';
import { NonChangeRecovery, Recovery } from './PathWalker/PathRecovery';
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
        this.MAX_RECALCULATE_ATTEMPTS = 9;
        this.recalculateScheduleId = 0;
        this.searchStartedAt = 0;
        this.SEARCH_TIMEOUT_MS = 25000;
        this.pathVariantSeed = 0;
        this.lastPathSignature = '';
        this.samePathSignatureCount = 0;
        this.lastRecalculateReason = '';

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
        this.cachedPathResult = null;
        this.cachedWalkSplinePath = null;
        this.cachedWalkSplineResult = null;

        v5Command('path', (...args) => {
            const end = this.parseGoalCoordinates(args, 'Usage: /v5 path goto <x> <y> <z> [x2 y2 z2...]');
            if (!end) return;

            this.resetPath();
            this.calledFromFile = true;
            this.findPath(end);
        });

        v5Command('flypath', (...args) => {
            const end = this.parseGoalCoordinates(args, 'Usage: /v5 path fly <x> <y> <z> [x2 y2 z2...]', true);
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

    parseGoalCoordinates(args, usageText, isFly = false) {
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
            const point = isFly ? this.resolveFlyPoint(coords[i], coords[i + 1], coords[i + 2]) : [coords[i], coords[i + 1], coords[i + 2]];
            if (!point) {
                showNotification('Invalid Fly Goal', `No valid fly position near ${coords[i]}, ${coords[i + 1]}, ${coords[i + 2]}.`, 'ERROR', 5000);
                return null;
            }
            goals.push(point);
        }

        return goals;
    }

    findPath(end, onComplete, renderOnly = false, isFly = false, startPoints = null, preserveRecalculateAttempts = false) {
        this.recalculateScheduleId++;
        this.currentEnd = end;
        this.currentStarts = startPoints;
        this.currentCallback = onComplete;
        this.isFly = isFly;
        this.clearPathCaches();

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
        this.hasReachedWarpPoint = false;
        if (!preserveRecalculateAttempts) {
            this.recalculateAttempts = 0;
            this.pathVariantSeed = 0;
            this.lastPathSignature = '';
            this.samePathSignatureCount = 0;
        }

        const start = starts[0];

        if (this.calledFromFile) {
            const endStr = end.length > 1 ? `Multiple Goals (${end.length})` : `${end[0][0]}, ${end[0][1]}, ${end[0][2]}`;
            Chat.messagePathfinder(`Path from &a${start[0]}, ${start[1]}, ${start[2]}&f to &c${endStr}`);
        }

        if (!Swift.SwiftPath(starts, end, isFly, this.pathVariantSeed)) {
            showNotification('Pathfinding Failed', Swift.getLastError() || 'Failed to start', 'ERROR', 5000);
            return;
        }
        this.searchStartedAt = Date.now();

        if (this.calledFromFile && PathConfig.PATHFINDING_DEBUG) {
            Chat.messagePathfinder('§eSearching for path...');
        }

        this.startTick(renderOnly);
    }

    startTick(renderOnly) {
        if (this.tick) return;

        PathExecutor.execute();

        this.tick = register('tick', () => {
            if (Swift.isSearching()) {
                if (this.searchStartedAt > 0 && Date.now() - this.searchStartedAt > this.SEARCH_TIMEOUT_MS) {
                    if (PathConfig.PATHFINDING_DEBUG) {
                        Chat.messagePathfinder('§6Path search timed out, recalculating');
                    }
                    Swift.cancel();
                    Swift.clear();
                    this.recalculate('search_timeout');
                }
                return;
            }

            let result = this.cachedPathResult;
            if (!result) {
                result = Swift.getResult();
                if (result) {
                    this.cachedPathResult = result;
                }
            }

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
                const nodeCount = Array.isArray(result.path) ? result.path.length : result.keynodes.length;
                Chat.messagePathfinder(`Path found: ${nodeCount} nodes in ${result.time_ms}ms`);
                this.saidInfo = true;
            }
            this.updatePathSignatureState(result);

            if (!this.handleStartPointWarp(result)) return;

            if (!this.isFly) {
                const splinePath = this.getCachedWalkSplinePath(result);

                if (PathConfig.RENDER_KEY_NODES || PathConfig.RENDER_FLOATING_SPLINE || PathConfig.RENDER_LOOK_POINTS) {
                    this.startRender(result, splinePath);
                }

                if (renderOnly) {
                    showNotification('Render Only', 'Path rendered.', 'INFO', 3000);
                    this.destroyTick();
                    return;
                }

                if (this.checkIfReachedDestination()) {
                    this.finishSuccess();
                    return;
                }

                if (!splinePath?.length) return;

                if (Rotations.boxPositions?.length && Rotations.complete) {
                    this.checkIfReachedDestination() ? this.finishSuccess() : this.recalculate('rotation_complete_not_at_goal');
                    return;
                }

                Executor.execute(() => {
                    Rotations.pathRotations(splinePath);
                    this.applyPathRuntimeHints(result);
                    Aote.onPathTick(Rotations);
                    Jump.detectJump(result.path_between_key_nodes, result.path_flags, result.path_flag_bits);
                    Movement.beginMovement();

                    if (this.recalculateAttempts > 0 && Recovery.hasMadeProgress()) {
                        if (PathConfig.PATHFINDING_DEBUG) {
                            Chat.messagePathfinder('§aUnstuck!');
                        }
                        this.recalculateAttempts = 0;
                        Recovery.stop();
                    }

                    const recoveryAction = Recovery.trackProgress();
                    if (recoveryAction) {
                        this.handleRecovery(recoveryAction);
                        if (recoveryAction === 'BACKUP_RECALC') {
                            return;
                        }
                    }

                    if (!Recovery.isStallRecoveryActive() && NonChangeRecovery.trackProgress(Rotations.currentPathPosition)) {
                        this.recalculate('nonchange_progress');
                        return;
                    }
                });
            } else if (this.isFly) {
                if (!this.flyStarted) {
                    const flyNodes = result.path?.length
                        ? result.path
                        : result.path_between_key_nodes?.length
                          ? result.path_between_key_nodes
                          : result.keynodes;
                    const { lookPoints, movementPath } = Spline.createFlyPaths(flyNodes);
                    this.flyMovementPath = movementPath;
                    this.flyLookPoints = lookPoints;
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
                        if (FlyMovement.complete || this.checkIfReachedDestination()) {
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
                        this.flyMovementPath?.forEach((p) => Render.drawBox(new Vec3d(p.x, p.y, p.z), Render.Color(0, 255, 0, 150), true));
                        this.flyLookPoints?.forEach((p) => Render.drawBox(p, Render.Color(255, 0, 0, 150), true));
                        const yDiffPoint = FlyMovement.debugVerticalTarget;
                        if (yDiffPoint) {
                            Render.drawBox(new Vec3d(yDiffPoint.x, yDiffPoint.y, yDiffPoint.z), Render.Color(0, 255, 255, 180), true);
                        }
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
                this.addTransientAvoidAtPlayer(2, 42, 2);
                Movement.backup(15, () => this.recalculate('backup_recalc'));
                break;
        }
    }

    recalculate(reason = 'generic') {
        this.lastRecalculateReason = reason;
        if (!this.isFly) {
            const intensity = this.samePathSignatureCount >= 2 ? 2 : 1;
            this.pathVariantSeed += intensity;
            this.addTransientAvoidAtPlayer(2 + Math.min(1, intensity), 34 + intensity * 8, 2);
        }

        this.recalculateAttempts++;
        this.pathVariantSeed = Math.max(this.pathVariantSeed, this.recalculateAttempts);
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
        const scheduleId = ++this.recalculateScheduleId;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(3, () => {
            if (scheduleId !== this.recalculateScheduleId) return;
            this.currentEnd = end;
            this.currentStarts = starts;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;
            this.findPath(end, callback, false, this.isFly, starts, true);
        });
    }

    updatePathSignatureState(result) {
        const signature = typeof result?.path_signature === 'string' ? result.path_signature : '';
        if (!signature) {
            this.lastPathSignature = '';
            this.samePathSignatureCount = 0;
            return;
        }

        if (signature === this.lastPathSignature) {
            this.samePathSignatureCount++;
        } else {
            this.lastPathSignature = signature;
            this.samePathSignatureCount = 0;
        }

        if (this.samePathSignatureCount >= 2 && this.recalculateAttempts > 0) {
            this.pathVariantSeed += 1;
            this.addTransientAvoidAtPlayer(3, 48, 2);
        }
    }

    addTransientAvoidAtPlayer(radius = 2, penalty = 36, ttlSearches = 2) {
        if (this.isFly) return;
        const player = Player.getPlayer();
        if (!player) return;

        const x = Math.floor(Player.getX());
        const y = Math.floor(Player.getY());
        const z = Math.floor(Player.getZ());

        Swift.addTransientAvoidPoint(x, y, z, 1, Math.max(8, penalty * 0.45), Math.max(1, ttlSearches));

        const yaw = Number(Player.getYaw()) || 0;
        const yawRad = ((yaw + 90) * Math.PI) / 180;
        let fx = Math.round(Math.cos(yawRad));
        let fz = Math.round(Math.sin(yawRad));
        if (fx === 0 && fz === 0) fx = 1;

        const cluster = [
            [x + fx, y, z + fz, radius, penalty],
            [x + fx * 2, y, z + fz * 2, radius, penalty * 1.15],
            [x + fz, y, z - fx, Math.max(1, radius - 1), penalty * 0.7],
            [x - fz, y, z + fx, Math.max(1, radius - 1), penalty * 0.7],
        ];

        cluster.forEach((p) => {
            Swift.addTransientAvoidPoint(p[0], p[1], p[2], Math.max(1, Math.floor(p[3])), Number(p[4]) || penalty, ttlSearches);
        });
    }

    applyPathRuntimeHints(result) {
        if (!result || this.isFly || Recovery.isStallRecoveryActive()) return;
        if (!Array.isArray(result.path_flags) || !result.path_flags.length) return;

        const pathIndex = Math.max(0, Math.min(result.path_flags.length - 1, Math.floor(Rotations.currentPathPosition || 0)));
        const flags = result.path_flags[pathIndex] || 0;

        const bits = Array.isArray(result.path_flag_bits) && result.path_flag_bits.length >= 8 ? result.path_flag_bits : null;
        const LOW_HEAD = bits ? bits[2] : 1 << 2;
        const NEAR_EDGE = bits ? bits[3] : 1 << 3;
        const TIGHT = bits ? bits[7] : 1 << 7;

        if (flags & LOW_HEAD) {
            Jump.suppressJump(4);
            Rotations.setTemporaryLookahead(Rotations.RECOVERY_MIN_LOOKAHEAD, 8);
            return;
        }

        if (flags & TIGHT || flags & NEAR_EDGE) {
            Rotations.setTemporaryLookahead(Math.max(Rotations.RECOVERY_MIN_LOOKAHEAD, 0.35), 6);
        }
    }

    retryRecalculate() {
        this.pathVariantSeed = Math.max(this.pathVariantSeed, this.recalculateAttempts);
        const end = this.currentEnd;
        const starts = this.currentStarts;
        const callback = this.currentCallback;
        const wasFromFile = this.calledFromFile;
        const attempts = this.recalculateAttempts;
        const scheduleId = ++this.recalculateScheduleId;

        this.resetPath(false);

        this.saidInfo = false;

        ScheduleTask(5, () => {
            if (scheduleId !== this.recalculateScheduleId) return;

            this.currentEnd = end;
            this.currentStarts = starts;
            this.currentCallback = callback;
            this.calledFromFile = wasFromFile;
            this.recalculateAttempts = attempts;

            this.findPath(end, callback, false, this.isFly, starts, true);
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
            if (this.isBlockWalkable(x, y, z)) return { x, y: y - 1, z };
            y--;
        }
        return { x, y: Math.round(Player.getY()) - 1, z };
    }

    getPlayerFlyStart() {
        const point = this.resolveFlyPoint(Player.getX(), Player.getY(), Player.getZ(), 4);
        if (point) return { x: point[0], y: point[1], z: point[2] };

        return {
            x: Math.floor(Player.getX()),
            y: Math.floor(Player.getY()),
            z: Math.floor(Player.getZ()),
        };
    }

    isBlockWalkable(x, y, z) {
        const pos = new BP(x, y, z);
        const world = World.getWorld();
        return world.getBlockState(pos).getCollisionShape(world, pos).isEmpty();
    }

    isFlyPositionClear(x, y, z) {
        const world = World.getWorld();
        if (!world) return false;

        const feetPos = new BP(x, y, z);
        const headPos = new BP(x, y + 1, z);

        return (
            world.getBlockState(feetPos).getCollisionShape(world, feetPos).isEmpty() && world.getBlockState(headPos).getCollisionShape(world, headPos).isEmpty()
        );
    }

    resolveFlyPoint(x, y, z, verticalSearch = 3) {
        const baseX = Math.floor(x);
        const baseY = Math.floor(y);
        const baseZ = Math.floor(z);

        if (this.isFlyPositionClear(baseX, baseY, baseZ)) {
            return [baseX, baseY, baseZ];
        }

        for (let offset = 1; offset <= verticalSearch; offset++) {
            const upY = baseY + offset;
            if (this.isFlyPositionClear(baseX, upY, baseZ)) {
                return [baseX, upY, baseZ];
            }

            const downY = baseY - offset;
            if (this.isFlyPositionClear(baseX, downY, baseZ)) {
                return [baseX, downY, baseZ];
            }
        }

        return null;
    }

    createStartPoints(startPoints) {
        if (startPoints) {
            const validStarts = startPoints
                .filter((point) => Array.isArray(point) && point.length >= 3)
                .map((point) => [Math.floor(Number(point[0])), Math.floor(Number(point[1])), Math.floor(Number(point[2]))])
                .filter((point) => point.every((v) => !Number.isNaN(v)));

            return {
                points: validStarts,
                metadata: validStarts.map((point) => ({
                    type: 'custom',
                    point: [point[0], point[1], point[2]],
                })),
            };
        }

        const points = [];
        const metadata = [];

        const start = this.isFly ? this.getPlayerFlyStart() : this.getPlayerStart();
        const playerPoint = [start.x, start.y, start.z];

        if (!this.isFly) {
            const variantPoint = this.getVariantWalkStart(playerPoint, this.pathVariantSeed);
            if (variantPoint) {
                points.push(variantPoint);
                metadata.push({
                    type: 'player_variant',
                    point: [variantPoint[0], variantPoint[1], variantPoint[2]],
                    seed: this.pathVariantSeed,
                });
            }
        }

        points.push(playerPoint);
        metadata.push({
            type: 'player',
            point: [playerPoint[0], playerPoint[1], playerPoint[2]],
        });

        if (this.isFly) {
            return { points, metadata };
        }

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

    getVariantWalkStart(playerPoint, seed = 0) {
        if (!Array.isArray(playerPoint) || playerPoint.length < 3 || !Number.isFinite(seed) || seed <= 0) {
            return null;
        }

        const [baseX, baseY, baseZ] = playerPoint;
        const offsets = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
            [2, 0],
            [0, 2],
            [-2, 0],
            [0, -2],
        ];

        const startIndex = seed % offsets.length;
        for (let i = 0; i < offsets.length; i++) {
            const idx = (startIndex + i) % offsets.length;
            const [dx, dz] = offsets[idx];
            const x = baseX + dx;
            const z = baseZ + dz;

            if (this.isWalkColumnValid(x, baseY, z)) {
                return [x, baseY, z];
            }
        }

        return null;
    }

    isWalkColumnValid(x, groundY, z) {
        if (this.isBlockWalkable(x, groundY, z)) return false;
        if (!this.isBlockWalkable(x, groundY + 1, z)) return false;
        if (!this.isBlockWalkable(x, groundY + 2, z)) return false;
        return true;
    }

    handleStartPointWarp(result) {
        if (!this.selectedStartCandidate) {
            this.selectedStartCandidate = this.resolvePathStartCandidate(result);
        }
        if (!this.selectedStartCandidate) {
            return true;
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

    resolvePathStartCandidate(result) {
        const selectedStartIndex = typeof result?.selected_start_index === 'number' ? result.selected_start_index : -1;
        if (selectedStartIndex >= 0 && selectedStartIndex < this.startCandidates.length) {
            return this.startCandidates[selectedStartIndex];
        }

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

    getCachedWalkSplinePath(result) {
        if (!result) return null;
        if (this.cachedWalkSplineResult === result && this.cachedWalkSplinePath) {
            return this.cachedWalkSplinePath;
        }

        const spline = this.createSplinePath(result);
        this.cachedWalkSplineResult = result;
        this.cachedWalkSplinePath = spline;
        return spline;
    }

    clearPathCaches() {
        this.cachedPathResult = null;
        this.cachedWalkSplinePath = null;
        this.cachedWalkSplineResult = null;
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
        Aote.stop(!!clearFlags);
        Movement.stopMovement();
        FlyMovement.stopMovement();
        if (clearFlags) {
            Recovery.stop();
            NonChangeRecovery.stop();
        } else {
            Recovery.resetTracking();
            NonChangeRecovery.resetTracking();
        }
        Swift.cancel();
        Swift.clear();
        if (clearFlags) {
            Swift.clearTransientAvoidPoints();
        }

        this.flyStarted = false;
        this.flyStartDelayTicks = 0;
        this.flyLookPoints = null;
        this.flyMovementPath = null;
        this.flySplinePath = null;
        this.clearPathCaches();
        this.startCandidates = [];
        this.selectedStartCandidate = null;
        this.searchStartedAt = 0;
        this.warpCommandIssued = false;
        this.warpRetryCount = 0;
        this.warpLastAttemptAt = 0;

        if (clearFlags) {
            this.recalculateScheduleId++;
            this.saidInfo = false;
            this.calledFromFile = false;
            this.currentEnd = null;
            this.currentStarts = null;
            this.currentCallback = null;
            this.recalculateAttempts = 0;
            this.recalculateRetryQueued = false;
            this.pathVariantSeed = 0;
            this.lastPathSignature = '';
            this.samePathSignatureCount = 0;
            this.lastRecalculateReason = '';
            this.isFly = false;
            this.hasReachedWarpPoint = false;
        }
    }

    isPathing() {
        return !!this.tick;
    }

    getResult() {
        if (this.cachedPathResult) return this.cachedPathResult;

        const result = Swift.getResult();
        if (result) this.cachedPathResult = result;
        return result;
    }
}

const Pathfinder = new Finder();
export default Pathfinder;
