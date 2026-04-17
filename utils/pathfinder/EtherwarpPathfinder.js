import { Chat } from '../Chat';
import { MCHand, PathManager, Vec3d } from '../Constants';
import { PlayerInteractItemC2S } from '../Packets';
import { Guis } from '../player/Inventory';
import { Keybind } from '../player/Keybinding';
import { Rotations } from '../player/Rotations';
import Render from '../render/Render';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';

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
    pending: Render.Color(0, 170, 255, 180),
    start: Render.Color(80, 255, 140, 180),
    end: Render.Color(255, 90, 90, 180),
};

const readPathPoints = (pathArr) => {
    if (!pathArr || typeof pathArr.length !== 'number') return [];

    const points = [];
    for (let i = 0; i + 2 < pathArr.length; i += 3) {
        points.push({
            x: Number(pathArr[i]) || 0,
            y: Number(pathArr[i + 1]) || 0,
            z: Number(pathArr[i + 2]) || 0,
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

        v5Command('etherwarp', (x, y, z) => this.test(x, y, z));

        register('step', () => this.pollSearch()).setFps(100);
        register('renderWorld', () => this.render());
        register('worldUnload', () => this.clear());
        register('gameUnload', () => this.clear());
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

    findPath(goal, options = {}) {
        if (![goal.x, goal.y, goal.z].every(Number.isFinite)) {
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
        };
        this.originalSlot = Player.getHeldItemIndex();

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
            const reason = PathManager.getLastError() || 'Unknown error';
            this.path = [];
            this.angles = [];
            this.currentGoal = null;
            this.searchActive = false;
            this.finishFailure('Etherpath failed to start: ' + reason, this.currentRun?.restoreSlot !== false);
            return false;
        }

        this.searchActive = true;
        Chat.messagePathfinder('&7Searching etherpath from your eye origin to &c' + goal.x + ', ' + goal.y + ', ' + goal.z);
        return true;
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

    preparePlayer(slot) {
        this.stateVersion++;
        Keybind.stopMovement();
        Keybind.setKey('shift', true);
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
            this.finishFailure(reason, this.currentRun?.restoreSlot !== false);
            return;
        }

        this.path = readPathPoints(PathManager.getEtherwarpPathArray());
        this.angles = readAngles(PathManager.getEtherwarpAnglesArray());
        const timeMs = Number(PathManager.getEtherwarpLastTimeMs());
        const nodeCount = this.path.length;

        this.messagePathfinder('&aEtherpath ready: &f' + nodeCount + ' nodes' + (Number.isFinite(timeMs) && timeMs >= 0 ? ' in ' + timeMs + 'ms' : ''));
        if (typeof this.currentRun?.onReady === 'function') {
            this.currentRun.onReady(this.path.slice(), this.angles.slice());
        }

        if (!this.currentRun?.autoExecute) return;

        if (nodeCount <= 0) {
            this.messagePathfinder('&7Already at the destination.');
            this.finishSuccess();
            return;
        }

        if (!this.beginExecution()) {
            this.finishFailure('Etherpath execution could not start.', this.currentRun?.restoreSlot !== false);
        }
    }

    beginExecution() {
        if (this.angles.length < this.path.length) {
            this.messagePathfinder('&cEtherpath did not return native angles for every hop.');
            return false;
        }

        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            this.messagePathfinder('&cNo Aspect of the Void/End found in your hotbar.');
            return false;
        }

        this.executionActive = true;
        this.executionToken++;

        this.preparePlayer(slot);
        ScheduleTask(2, () => this.executePath(this.executionToken));

        this.messagePathfinder('&7Executing etherpath...');
        return true;
    }

    executePath(token) {
        if (!this.executionActive || this.executionToken !== token) return;
        if (!World.isLoaded()) {
            this.finishFailure('World unloaded during etherwarp.', false);
            return;
        }
        if (!this.ensureEtherwarpHeld(token)) return;

        this.executeHop(token, 0);
    }

    executeHop(token, index) {
        if (!this.executionActive || this.executionToken !== token) return;
        if (!World.isLoaded()) {
            this.finishFailure('World unloaded during etherwarp.', false);
            return;
        }

        const angles = this.angles[index];
        if (!angles || !Number.isFinite(angles.yaw) || !Number.isFinite(angles.pitch)) {
            this.finishFailure('Etherpath execution encountered invalid hop angles.', this.currentRun?.restoreSlot !== false);
            return;
        }
        if (!this.ensureEtherwarpHeld(token, () => this.executeHop(token, index))) return;

        Rotations.applyRotationWithGCD(angles.yaw, angles.pitch);
        this.sendEtherwarpClick();

        if (index >= this.path.length - 1) {
            this.messagePathfinder('&aEtherpath complete.');
            this.finishSuccess();
            return;
        }

        ScheduleTask(1, () => this.executeHop(token, index + 1));
    }

    sendEtherwarpClick() {
        const yaw = Number.parseFloat(Player.getYaw());
        const pitch = Number.parseFloat(Player.getPitch());
        Client.sendSequencedPacket((sequence) => new PlayerInteractItemC2S(MCHand.MAIN_HAND, sequence, yaw, pitch));
    }

    stopExecution(restoreSlot = true) {
        const hasPreparedState = this.executionActive || this.originalSlot !== -1;
        const slotToRestore = restoreSlot && this.originalSlot >= 0 && this.originalSlot <= 8 ? this.originalSlot : -1;
        const cleanupVersion = ++this.stateVersion;

        this.executionToken++;
        this.executionActive = false;
        this.originalSlot = -1;

        if (!hasPreparedState) return;

        ScheduleTask(0, () => {
            if (this.stateVersion !== cleanupVersion) return;

            Keybind.setKey('shift', false);
            Keybind.stopMovement();

            if (slotToRestore !== -1) Guis.setItemSlot(slotToRestore);
        });
    }

    getEtherwarpSlot() {
        const aotv = Guis.findItemInHotbar('Aspect of the Void');
        if (aotv !== -1) return aotv;
        return Guis.findItemInHotbar('Aspect of the End');
    }

    ensureEtherwarpHeld(token, resumeTask = () => this.executePath(token)) {
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            this.messagePathfinder('&cLost Aspect of the Void/End during etherpath execution.');
            this.finishFailure('Lost Aspect of the Void/End during etherpath execution.', this.currentRun?.restoreSlot !== false);
            return false;
        }

        if (Player.getHeldItemIndex() === slot) return true;

        Guis.setItemSlot(slot);
        ScheduleTask(1, resumeTask);
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

            Render.drawStyledBox(pointVec, boxColor, boxColor, 3, false);

            if (i >= this.path.length - 1) continue;

            const next = this.path[i + 1];
            Render.drawLine(centerVec, new Vec3d(next.x + 0.5, next.y + 1.05, next.z + 0.5), PATH_COLORS.pending, 3, false);
        }
    }

    clear() {
        this.cancel(true);
    }

    finishSuccess() {
        const currentGoal = this.currentGoal ? { ...this.currentGoal } : null;
        const onSuccess = this.currentRun?.onSuccess;
        const restoreSlot = this.currentRun?.restoreSlot !== false;

        PathManager.clear();
        this.searchActive = false;
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.stopExecution(restoreSlot);

        if (typeof onSuccess !== 'function') return;
        onSuccess(currentGoal);
    }

    finishFailure(reason, restoreSlot = true) {
        const failureReason = reason || 'Unknown etherwarp failure';
        const onFail = this.currentRun?.onFail;
        const silent = this.currentRun?.silent === true;

        PathManager.cancelSearch();
        PathManager.clear();
        this.searchActive = false;
        this.path = [];
        this.angles = [];
        this.currentGoal = null;
        this.currentRun = null;
        this.stopExecution(restoreSlot);
        if (!silent) {
            Chat.messagePathfinder('&c' + failureReason);
        }

        if (typeof onFail !== 'function') return;
        onFail(failureReason);
    }

    messagePathfinder(message) {
        if (this.currentRun?.silent) return;
        Chat.messagePathfinder(message);
    }
}

export const EtherwarpPathfinder = new EtherwarpPathHandler();
