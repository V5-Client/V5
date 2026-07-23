import { Chat } from '../Chat';
import { MCHand, Vec3d } from '../Constants';
import { ClientboundPingPacket, ServerboundUseItemPacket } from '../Packets';
import { Guis } from '../player/Inventory';
import { finiteNumber } from '../NumberUtils';
import { RotationGCD } from '../player/RotationGCD';
import { ServerInfo } from '../player/ServerInfo';
import { ScheduleTask } from '../ScheduleTask';
import { Utils } from '../Utils';
import { v5Command } from '../V5Commands';
import { EtherwarpPathState } from '../Etherwarp';

const SEARCH_OPTIONS = {
    maxIterations: 100000,
    threadCount: 0,
    yawStep: 3.0,
    pitchStep: 2.0,
    newNodeCost: 100.0,
    heuristicWeight: 1.0,
    rayLength: 61.0,
    rewireEpsilon: 1e-9,
};

const PATH_COLORS = {
    pending: new RenderColor(0, 170, 255, 180),
    start: new RenderColor(80, 255, 140, 180),
    end: new RenderColor(255, 90, 90, 180),
};

const MINIMUM_MANA = 100;

const readPathPoints = (pathArr) => {
    if (!pathArr || typeof pathArr.length !== 'number') return [];

    const points = [];
    for (let i = 0; i + 2 < pathArr.length; i += 3) {
        points.push({
            x: finiteNumber(pathArr[i]),
            y: finiteNumber(pathArr[i + 1]),
            z: finiteNumber(pathArr[i + 2]),
        });
    }
    return points;
};

const readAngles = (angleArr) => {
    if (!angleArr || typeof angleArr.length !== 'number') return [];

    const angles = [];
    for (let i = 0; i + 1 < angleArr.length; i += 2) {
        angles.push({
            yaw: Number(angleArr[i]),
            pitch: Number(angleArr[i + 1]),
        });
    }
    return angles;
};

class EtherwarpPathHandler {
    constructor() {
        this.resetState();
        EtherwarpPathState.handler = this;

        v5Command('etherwarp', (x, y, z) => this.test(x, y, z), ['greedyString']);

        register('step', () => {
            this.pollSearch();
            this.pollExecutionWait();
        }).setFps(100);
        register('renderWorld', () => this.render());
        register('packetReceived', () => this.onCommonPingPacket()).setFilteredClass(ClientboundPingPacket);
        register('worldUnload', () => this.handleWorldUnload());
    }

    resetState() {
        this.searchActive = false;
        this.executionActive = false;
        this.executionToken = 0;
        this.stateVersion = 0;
        this.originalSlot = -1;
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.commonPingPacketCount = 0;
        this.resetExecutionRuntime();
    }

    resetExecutionRuntime() {
        this.hopWaitStartedAt = 0;
        this.hopSoftDeadlineAt = 0;
        this.hopHardDeadlineAt = 0;
        this.hopAwaiting = false;
        this.hopRequiredPingPackets = 0;
        this.hopPingStartCount = 0;
        this.finalNode = null;
    }

    test(xArg, yArg, zArg) {
        const x = Math.floor(Number(xArg));
        const y = Math.floor(Number(yArg));
        const z = Math.floor(Number(zArg));
        if (![x, y, z].every(Number.isFinite)) {
            Chat.messagePathfinder('&cUsage: /v5 etherwarp <x> <y> <z>');
            return;
        }
        const goal = { x, y, z };

        this.findPath(goal, { silent: false });
    }

    resolveClosestGoal(goal, radius = 0) {
        if (!Array.isArray(goal) && radius <= 0) return goal;
        const candidates = Array.isArray(goal) && (Array.isArray(goal[0]) || typeof goal[0] === 'object') ? goal : [goal];
        const sortOrigin = this.getPlayerSupportBlock() || { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        const closest = candidates.reduce((best, candidate) => {
            const values = Array.isArray(candidate) ? candidate : [candidate?.x, candidate?.y, candidate?.z];
            const [x, y, z] = values.map((value) => Math.floor(Number(value)));
            if (![x, y, z].every(Number.isFinite)) return best;

            let landing = { x, y, z };
            if (!PathManager.isValidEtherwarpLanding(x, y, z)) {
                const result = radius > 0 && PathManager.getEtherwarpLandingCandidates(x, y, z, radius, radius, sortOrigin.x, sortOrigin.y, sortOrigin.z);
                if (!result?.goals || result.goals.length < 3) return best;
                landing = { x: result.goals[0], y: result.goals[1], z: result.goals[2] };
            }

            const distance = Math.hypot(Player.getX() - landing.x, Player.getY() - landing.y, Player.getZ() - landing.z);
            return !best || distance < best.distance ? { goal: landing, distance } : best;
        }, null);
        return closest?.goal || null;
    }

    findPath(goal, options = {}) {
        goal = this.resolveClosestGoal(goal, Math.max(0, Math.floor(finiteNumber(options.goalRadius))));
        if (!goal || ![goal.x, goal.y, goal.z].every(Number.isFinite)) {
            Chat.messagePathfinder('&cInvalid etherwarp coordinates.');
            return false;
        }
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            Chat.messagePathfinder('&cNo Aspect of the Void/End found in your hotbar.');
            return false;
        }

        this.cancel(false);

        this.path = [];
        this.angles = [];
        this.currentGoal = goal;
        this.currentRun = {
            silent: options.silent === true,
            autoExecute: options.autoExecute !== false,
            restoreSlot: options.restoreSlot !== false,
            onReady: typeof options.onReady === 'function' ? options.onReady : null,
            onSuccess: typeof options.onSuccess === 'function' ? options.onSuccess : null,
            onFail: typeof options.onFail === 'function' ? options.onFail : null,
            retryCount: 0,
            maxRetries: options.maxRetries || 5,
        };
        this.originalSlot = Player.getHeldItemIndex();
        this.resetExecutionRuntime();

        if (this.startSearch(this.currentGoal, false)) {
            return true;
        }

        if (!this.currentRun) return false;
        const reason = PathManager.getLastError() || 'Unknown error';
        return this.retryPath('Etherpath failed to start: ' + reason);
    }

    cancel(restoreSlot = true) {
        this.searchActive = false;
        PathManager.cancelSearch();
        PathManager.clear();

        this.stopExecution(restoreSlot);
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.finalNode = null;
    }

    isPathing() {
        return this.searchActive || this.executionActive;
    }

    getPlayerSupportBlock() {
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world) return null;

        const x = Math.floor(player.getX());
        const z = Math.floor(player.getZ());
        const baseY = Math.floor(player.getY() - 0.001);
        const candidates = [baseY, baseY - 1, baseY - 2, baseY - 3, baseY + 1];

        for (const y of candidates) {
            if (PathManager.isValidEtherwarpLanding(x, y, z)) {
                return { x, y, z };
            }
        }

        return null;
    }

    getEyeHeight() {
        return Number(PathManager.getCurrentEtherwarpEyeHeight());
    }

    isNodeValid(node) {
        if (!node) return false;
        return [node.x, node.y, node.z].every(Number.isFinite);
    }

    getPingDelayTicks() {
        const pingMs = ServerInfo.getPing() || 0;
        return Math.ceil(pingMs / 50) + 2;
    }

    isExecutionContextValid(token) {
        return this.executionActive && this.executionToken === token && this.currentRun !== null;
    }

    isAtNode(node) {
        if (!this.isNodeValid(node)) return false;
        if (!Player.getPlayer()) return false;

        const px = Number(Player.getX());
        const py = Number(Player.getY());
        const pz = Number(Player.getZ());
        if (![px, py, pz].every(Number.isFinite)) return false;

        const sameX = Math.floor(px) === Math.floor(node.x);
        const sameZ = Math.floor(pz) === Math.floor(node.z);
        if (!sameX || !sameZ) return false;

        const yDelta = py - Number(node.y);
        return yDelta >= -2 && yDelta <= 3;
    }

    validatePathData() {
        if (!Array.isArray(this.path) || !Array.isArray(this.angles)) return false;
        if (this.angles.length < this.path.length) return false;

        for (let i = 0; i < this.path.length; i++) {
            if (!this.isNodeValid(this.path[i])) return false;
            const angle = this.angles[i];
            if (!angle || !Number.isFinite(angle.yaw) || !Number.isFinite(angle.pitch)) return false;
        }

        return true;
    }

    startSearch(goal, isRetry = false) {
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            this.finishFailure('No Aspect of the Void/End found in your hotbar.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return false;
        }

        this.path = [];
        this.angles = [];
        this.finalNode = null;
        this.preparePlayer(slot);

        const started = PathManager.findEtherwarpPath(
            goal.x,
            goal.y,
            goal.z,
            SEARCH_OPTIONS.maxIterations,
            SEARCH_OPTIONS.threadCount,
            SEARCH_OPTIONS.yawStep,
            SEARCH_OPTIONS.pitchStep,
            SEARCH_OPTIONS.newNodeCost,
            SEARCH_OPTIONS.heuristicWeight,
            SEARCH_OPTIONS.rayLength,
            SEARCH_OPTIONS.rewireEpsilon,
            this.getEyeHeight()
        );

        if (!started) {
            this.searchActive = false;
            return false;
        }

        this.searchActive = true;
        const retryRun = this.currentRun;
        const retryText = isRetry && retryRun ? ` &7(retry ${retryRun.retryCount}/${retryRun.maxRetries})` : '';
        this.messagePathfinder('&7Searching etherpath from your eye origin to &c' + goal.x + ', ' + goal.y + ', ' + goal.z + retryText);
        return true;
    }

    clearAttemptForRetry() {
        this.searchActive = false;
        PathManager.cancelSearch();
        PathManager.clear();
        this.path = [];
        this.angles = [];
        this.finalNode = null;
        this.stopExecution(false, true);
    }

    retryPath(reason) {
        const run = this.currentRun;
        const goal = this.currentGoal ? { ...this.currentGoal } : null;
        if (!run || !goal) {
            this.finishFailure(reason, !run || run.restoreSlot !== false);
            return false;
        }

        if (run.retryCount >= run.maxRetries) {
            const retries = run.retryCount;
            const suffix = retries === 1 ? 'retry' : 'retries';
            this.finishFailure(`${reason} after ${retries} ${suffix}.`, run.restoreSlot !== false);
            return false;
        }

        run.retryCount++;
        this.messagePathfinder(`&6Etherpath retry &e(${run.retryCount}/${run.maxRetries})&6: ${reason}`);
        this.clearAttemptForRetry();

        if (this.startSearch(goal, true)) return true;
        if (!this.currentRun) return false;
        const retryReason = PathManager.getLastError() || 'Unknown error';
        return this.retryPath('Etherpath failed to start: ' + retryReason);
    }

    preparePlayer(slot) {
        this.stateVersion++;
        Client.stopMovement();
        Client.setKey('shift', true);
        Guis.setItemSlot(slot);
    }

    pollSearch() {
        if (!this.searchActive) return;
        if (PathManager.isSearching()) return;

        this.searchActive = false;

        if (!PathManager.hasEtherwarpPath()) {
            const reason = PathManager.getLastError() || 'No etherpath found';
            this.path = [];
            this.angles = [];
            this.retryPath(reason);
            return;
        }

        this.path = readPathPoints(PathManager.getEtherwarpPathArray());
        this.angles = readAngles(PathManager.getEtherwarpAnglesArray());
        this.finalNode = this.path.length ? this.path[this.path.length - 1] : null;
        const timeMs = Number(PathManager.getEtherwarpLastTimeMs());
        const nodeCount = this.path.length;

        if (!this.validatePathData()) {
            this.finishFailure('Etherpath returned malformed path data.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return;
        }

        this.messagePathfinder('&aEtherpath ready: &f' + nodeCount + ' nodes' + (Number.isFinite(timeMs) && timeMs >= 0 ? ' in ' + timeMs + 'ms' : ''));
        if (this.currentRun && typeof this.currentRun.onReady === 'function') {
            this.currentRun.onReady(this.path.slice(), this.angles.slice());
        }

        if (!this.currentRun || !this.currentRun.autoExecute) return;

        if (nodeCount <= 0) {
            if (this.currentGoal && this.isAtNode(this.currentGoal)) {
                this.messagePathfinder('&7Already at the destination.');
                this.finishSuccess();
                return;
            }
            this.retryPath('Etherpath returned no hops and destination was not reached.');
            return;
        }

        this.beginExecution();
    }

    beginExecution() {
        if (!this.validatePathData()) {
            this.finishFailure('Etherpath returned malformed hop data.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return false;
        }

        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            this.finishFailure('No Aspect of the Void/End found in your hotbar.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return false;
        }

        this.executionActive = true;
        this.executionToken++;
        this.resetExecutionRuntime();
        this.finalNode = this.path.length ? this.path[this.path.length - 1] : null;

        this.preparePlayer(slot);
        ScheduleTask(2, () => this.executePath(this.executionToken));

        this.messagePathfinder('&7Executing etherpath...');
        return true;
    }

    executePath(token) {
        if (!this.isExecutionContextValid(token)) return;
        if (!World.isLoaded()) {
            this.finishFailure('World unloaded during etherwarp.', false);
            return;
        }
        if (!this.ensureEtherwarpHeld(token)) return;

        this.executeHop(token, 0);
    }

    executeHop(token, index) {
        if (!this.isExecutionContextValid(token)) return;
        if (!World.isLoaded()) {
            this.finishFailure('World unloaded during etherwarp.', false);
            return;
        }

        const mana = Utils.getCurrentMana();
        if (mana !== null && mana < MINIMUM_MANA) {
            this.finishFailure('Not enough mana to continue etherwarping.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return;
        }

        const angles = this.angles[index];
        if (!angles || !Number.isFinite(angles.yaw) || !Number.isFinite(angles.pitch)) {
            this.finishFailure('Etherpath execution encountered invalid hop angles.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return;
        }
        if (!this.ensureEtherwarpHeld(token, () => this.executeHop(token, index))) return;

        RotationGCD.applyToPlayer(angles.yaw, angles.pitch);
        this.sendEtherwarpClick();
        if (index >= this.path.length - 1) {
            this.startAwaitingFinalArrival(token);
            return;
        }

        const nextIndex = index + 1;
        ScheduleTask(1, () => {
            if (this.currentRun === null) return;
            this.executeHop(token, nextIndex);
        });
    }

    startAwaitingFinalArrival(token) {
        const now = Date.now();
        const estimatedTickDelay = this.getPingDelayTicks();
        const estimatedTickDelayMs = estimatedTickDelay * 50;

        this.hopAwaiting = true;
        this.hopWaitStartedAt = now;
        this.hopSoftDeadlineAt = now + estimatedTickDelayMs;
        this.hopHardDeadlineAt = Math.max(now + 200, this.hopSoftDeadlineAt + 800);
        this.hopRequiredPingPackets = estimatedTickDelay;
        this.hopPingStartCount = this.commonPingPacketCount;

        this.evaluateFinalArrival(token);
    }

    onCommonPingPacket() {
        this.commonPingPacketCount++;
        if (!this.hopAwaiting || !this.executionActive) return;
        this.evaluateFinalArrival(this.executionToken);
    }

    pollExecutionWait() {
        if (!this.hopAwaiting || !this.executionActive) return;
        this.evaluateFinalArrival(this.executionToken);
    }

    evaluateFinalArrival(token) {
        if (!this.isExecutionContextValid(token)) return;
        if (!this.hopAwaiting) return;

        const finalNode = this.finalNode || (this.path.length ? this.path[this.path.length - 1] : null);
        if (!this.isNodeValid(finalNode)) {
            this.finishFailure('Etherpath execution encountered malformed final node data.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return;
        }

        if (this.isAtNode(finalNode)) {
            this.hopAwaiting = false;
            this.messagePathfinder('&aEtherpath complete.');
            this.finishSuccess();
            return;
        }

        const observedPackets = this.commonPingPacketCount - this.hopPingStartCount;
        if (observedPackets >= this.hopRequiredPingPackets && Date.now() >= this.hopSoftDeadlineAt) {
            this.retryPath('Etherpath final destination arrival timeout.');
            return;
        }

        if (Date.now() >= this.hopHardDeadlineAt) {
            this.retryPath('Etherpath final destination arrival timeout.');
        }
    }

    sendEtherwarpClick() {
        const yaw = Number.parseFloat(Player.getYaw());
        const pitch = Number.parseFloat(Player.getPitch());
        Client.sendSequencedPacket((sequence) => new ServerboundUseItemPacket(MCHand.MAIN_HAND, sequence, yaw, pitch));
    }

    stopExecution(restoreSlot = true, preserveOriginalSlot = false) {
        const hasPreparedState = this.executionActive || this.originalSlot !== -1;
        const currentOriginalSlot = this.originalSlot;
        const slotToRestore = restoreSlot && currentOriginalSlot >= 0 && currentOriginalSlot <= 8 ? currentOriginalSlot : -1;
        const cleanupVersion = ++this.stateVersion;

        this.executionToken++;
        this.executionActive = false;
        this.hopAwaiting = false;
        this.resetExecutionRuntime();
        this.originalSlot = preserveOriginalSlot ? currentOriginalSlot : -1;

        if (!hasPreparedState) return;

        ScheduleTask(0, () => {
            if (this.stateVersion !== cleanupVersion) return;

            Client.setKey('shift', false);
            Client.stopMovement();

            if (slotToRestore !== -1) Guis.setItemSlot(slotToRestore);
        });
    }

    getEtherwarpSlot() {
        const aotv = Guis.findItemInHotbar('Aspect of the Void');
        if (aotv !== -1) return aotv;
        return Guis.findItemInHotbar('Aspect of the End');
    }

    ensureEtherwarpHeld(token, resumeTask) {
        const continuation = typeof resumeTask === 'function' ? resumeTask : () => this.executePath(token);
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            this.finishFailure('Lost Aspect of the Void/End during etherpath execution.', !this.currentRun || this.currentRun.restoreSlot !== false);
            return false;
        }

        if (Player.getHeldItemIndex() === slot) return true;

        Guis.setItemSlot(slot);
        ScheduleTask(1, continuation);
        return false;
    }

    render() {
        if (!World.isLoaded()) return;
        if (!this.path.length) return;

        for (let i = 0; i < this.path.length; i++) {
            const point = this.path[i];
            const pointVec = new Vec3d(point.x, point.y, point.z);
            const centerVec = new Vec3d(point.x + 0.5, point.y + 1.05, point.z + 0.5);
            const boxColor = i === 0 ? PATH_COLORS.start : i === this.path.length - 1 ? PATH_COLORS.end : PATH_COLORS.pending;

            RenderUtils.drawStyledBox(pointVec, boxColor, boxColor, 3, false);

            if (i >= this.path.length - 1) continue;

            const next = this.path[i + 1];
            RenderUtils.drawLine(centerVec, new Vec3d(next.x + 0.5, next.y + 1.05, next.z + 0.5), PATH_COLORS.pending, 3, false);
        }
    }

    handleWorldUnload() {
        if (this.currentRun) {
            this.finishFailure('World unloaded during etherwarp.', false);
            return;
        }
        this.cancel(true);
    }

    finishSuccess() {
        const currentGoal = this.currentGoal ? { ...this.currentGoal } : null;
        const run = this.currentRun;
        const onSuccess = run && typeof run.onSuccess === 'function' ? run.onSuccess : null;
        const restoreSlot = !run || run.restoreSlot !== false;

        PathManager.clear();
        this.searchActive = false;
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.finalNode = null;
        this.stopExecution(restoreSlot);

        if (typeof onSuccess !== 'function') return;
        ScheduleTask(() => onSuccess(currentGoal));
    }

    finishFailure(reason, restoreSlot = true) {
        const failureReason = reason || 'Unknown etherwarp failure';
        const run = this.currentRun;
        const onFail = run && typeof run.onFail === 'function' ? run.onFail : null;
        const silent = !!(run && run.silent === true);

        PathManager.cancelSearch();
        PathManager.clear();
        this.searchActive = false;
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.finalNode = null;
        this.stopExecution(restoreSlot);
        if (!silent) {
            Chat.messagePathfinder('&c' + failureReason);
        }

        if (typeof onFail !== 'function') return;
        ScheduleTask(() => onFail(failureReason));
    }

    messagePathfinder(message) {
        const run = this.currentRun;
        if (run && run.silent === true) return;
        Chat.messagePathfinder(message);
    }
}

export const EtherwarpPathfinder = new EtherwarpPathHandler();
