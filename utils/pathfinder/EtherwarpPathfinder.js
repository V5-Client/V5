import { Chat } from '../Chat';
import { MCHand, PathManager, Vec3d } from '../Constants';
import { PlayerInteractItemC2S } from '../Packets';
import { Guis } from '../player/Inventory';
import { Keybind } from '../player/Keybinding';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';
import Render from '../render/Render';
import { Rotations } from '../player/Rotations';
const SEARCH_OPTIONS = {
    maxIterations: 100000,
    threadCount: 0,
    yawStep: 3.0,
    pitchStep: 1.5,
    newNodeCost: 50.0,
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
        this.path = [];
        this.angles = [];
        this.originalSlot = -1;
        this.executionActive = false;
        this.executionToken = 0;
        this.stateVersion = 0;
    }

    test(xArg, yArg, zArg) {
        const goal = {
            x: Math.floor(xArg),
            y: Math.floor(yArg),
            z: Math.floor(zArg),
        };
        if (![goal.x, goal.y, goal.z].every(Number.isFinite)) {
            Chat.messagePathfinder('&cUsage: /v5 etherwarp <x> <y> <z>');
            return;
        }

        const start = this.getPlayerSupportBlock();
        if (!start) {
            Chat.messagePathfinder('&cUnable to determine your current position.');
            return;
        }

        this.findPath(start, goal);
    }

    findPath(start, goal) {
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            Chat.messagePathfinder('&cNo Aspect of the Void/End found in your hotbar.');
            return false;
        }

        this.cancelSearch();
        this.stopExecution(true);

        this.path = [];
        this.angles = [];
        this.originalSlot = Player.getHeldItemIndex();

        this.preparePlayer(slot);

        const started = PathManager.findEtherwarpPath(
            start.x,
            start.y,
            start.z,
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
            this.cancelSearch();
            this.stopExecution(true);
            Chat.messagePathfinder('&cEtherpath failed to start: &f' + (PathManager.getLastError() || 'Unknown error'));
            return false;
        }

        this.searchActive = true;
        Chat.messagePathfinder(
            '&7Searching etherpath from &a' + start.x + ', ' + start.y + ', ' + start.z + '&7 to &c' + goal.x + ', ' + goal.y + ', ' + goal.z
        );
        return true;
    }

    getPlayerSupportBlock() {
        const player = Player.getPlayer();
        if (!player) return null;

        return {
            x: Math.floor(player.getX()),
            y: Math.floor(player.getY() - 0.001),
            z: Math.floor(player.getZ()),
        };
    }

    getEyeHeight() {
        return Number(PathManager.getCurrentEtherwarpEyeHeight());
    }

    cancelSearch() {
        this.searchActive = false;

        PathManager.cancelSearch();
        PathManager.clear();
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
            Chat.messagePathfinder('&cNo etherpath found' + (PathManager.getLastError() ? ': ' + PathManager.getLastError() : ''));
            this.stopExecution(true);
            this.path = [];
            this.angles = [];
            return;
        }

        this.path = readPathPoints(PathManager.getEtherwarpPathArray());
        this.angles = readAngles(PathManager.getEtherwarpAnglesArray());
        const timeMs = Number(PathManager.getEtherwarpLastTimeMs());
        const nodeCount = this.path.length;

        Chat.messagePathfinder('&aEtherpath ready: &f' + nodeCount + ' nodes' + (Number.isFinite(timeMs) && timeMs >= 0 ? ' in ' + timeMs + 'ms' : ''));

        if (nodeCount <= 1) {
            Chat.messagePathfinder('&7Already at the destination.');
            this.stopExecution(true);
            return;
        }

        if (!this.beginExecution()) {
            this.stopExecution(true);
            Chat.messagePathfinder('&eEtherpath is still visualized, but execution could not start.');
        }
    }

    beginExecution() {
        if (this.angles.length < this.path.length) {
            Chat.messagePathfinder('&cEtherpath did not return native angles for every hop.');
            return false;
        }

        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            Chat.messagePathfinder('&cNo Aspect of the Void/End found in your hotbar.');
            return false;
        }

        this.executionActive = true;
        this.executionToken++;

        this.preparePlayer(slot);
        ScheduleTask(2, () => this.executePath(this.executionToken));

        Chat.messagePathfinder('&7Executing etherpath...');
        return true;
    }

    executePath(token) {
        if (!this.executionActive || this.executionToken !== token) return;
        if (!World.isLoaded()) return this.stopExecution(false);
        if (!this.ensureEtherwarpHeld(token)) return;

        for (let index = 1; index < this.path.length; index++) {
            const angles = this.angles[index];
            if (!angles || !Number.isFinite(angles.yaw) || !Number.isFinite(angles.pitch)) break;

            Rotations.applyRotationWithGCD(angles.yaw, angles.pitch);
            this.sendEtherwarpClick();
        }

        Chat.messagePathfinder('&aEtherpath complete.');
        this.stopExecution(true);
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

        ScheduleTask(1, () => {
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

    ensureEtherwarpHeld(token) {
        const slot = this.getEtherwarpSlot();
        if (slot < 0) {
            Chat.messagePathfinder('&cLost Aspect of the Void/End during etherpath execution.');
            this.stopExecution(true);
            return false;
        }

        if (Player.getHeldItemIndex() === slot) return true;

        Guis.setItemSlot(slot);
        ScheduleTask(1, () => this.executePath(token));
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
        this.cancelSearch();
        this.stopExecution(true);
        this.path = [];
        this.angles = [];
    }
}

export const EtherwarpPathfinder = new EtherwarpPathHandler();
