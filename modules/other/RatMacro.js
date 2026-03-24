//@Private
import { OverlayManager } from '../../gui/OverlayUtils';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { getHubRats, getRatId, getRawHubRats } from '../visuals/RatESP';

// this is complete codex slop.
// prob never gonna be published
// it works good as a hub pathfinder benchmark. (aka the paths always fucking fail)

const STATES = {
    WAITING: 'Waiting',
    PATHING: 'Pathing',
    ENGAGING: 'Engaging',
};

const SHOOT_RANGE = 6;
const CLICK_DELAY_MS = 150;
const KILL_TIMEOUT_MS = 4000;
const REPATH_DELAY_MS = 750;
const PATH_TIMEOUT_MS = 20000;
const GOAL_OFFSETS = [-1, 0, 1];
const AIM_POINT_Y_OFFSET = 0.5;
const AIM_TOLERANCE = 20;
const BACKUP_DISTANCE = 2.5;
const LOBBY_SWAP_WAIT_MS = 4000;
const VIP_SWAP_RETRY_MS = 750;
const VIP_SWAP_TIMEOUT_MS = 10000;
const VIP_SWAP_TRANSFER_TIMEOUT_MS = 10000;
const VIP_SWAP_SLOT = 50;
const VIP_SWAP_INTERACT_RANGE = 3;

const SWAP_MODES = {
    ISLAND: 'IslandSwap',
    VIP: 'VIPSwap',
};

const SWAP_STAGES = {
    NONE: 'NONE',
    WAIT_HUB_SCAN: 'WAIT_HUB_SCAN',
    WAIT_ISLAND_RETURN: 'WAIT_ISLAND_RETURN',
    WAIT_VIP_MENU: 'WAIT_VIP_MENU',
    WAIT_VIP_TRANSFER: 'WAIT_VIP_TRANSFER',
};

class RatMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Rat Macro',
            subcategory: 'Other',
            description: 'VIBECODED SLOP. Pathfinds to Hub rats and shoots them with your held gun.',
            tooltip: 'VIBECODED SLOP. Pathfinds to Hub rats and shoots them with your held gun.',
            theme: '#d7b24a',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.state = STATES.WAITING;
        this.weaponSlot = 0;
        this.blacklistedRatIds = new Set();
        this.blacklistedRatKeys = new Set();
        this.pendingCandidates = [];
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.pathRequestToken = 0;
        this.pathStartedAt = 0;
        this.engageStartedAt = 0;
        this.lastClickAt = 0;
        this.swapMode = SWAP_MODES.ISLAND;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken = 0;

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        State: () => this.state,
                        Swap: () => this.swapMode,
                        Target: () => this.getTargetDisplayName(),
                        Rats: () => this.getLiveRats().length,
                        Blacklisted: () => this.blacklistedRatIds.size,
                        Cleared: () => this.formatNumber(OverlayManager.getTrackedValue(this.oid, 'cleared', 0)),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    cleared: 0,
                },
            }
        );

        this.addSlider(
            'Weapon Slot',
            1,
            9,
            1,
            (value) => {
                this.weaponSlot = Math.max(0, Math.min(8, Math.round(value) - 1));
            },
            'Hotbar slot to swap to before shooting rats.'
        );

        this.addMultiToggle(
            'Swap Mode',
            [SWAP_MODES.ISLAND, SWAP_MODES.VIP],
            true,
            (options) => {
                this.swapMode = options.find((option) => option.enabled)?.name || SWAP_MODES.ISLAND;
            },
            'Choose whether empty lobbies are changed with /is or the VIP hub selector.',
            SWAP_MODES.ISLAND
        );

        this.on('tick', () => this.onTick());
        this.on('worldUnload', () => this.onWorldUnload());
    }

    onTick() {
        if (!this.enabled) return;
        if (!Player.getPlayer() || !World.isLoaded()) return;
        if (!Client.isInChat() && Client.isInGui() && !this.isHandlingSwapGui()) {
            Guis.closeInv();
            return;
        }

        if (this.handleLobbySwap()) return;

        if (Utils.area() !== 'Hub') {
            this.state = STATES.WAITING;
            Keybind.stopMovement();
            return;
        }

        this.updateDeadRatBlacklist();
        const liveRats = this.getLiveRats();

        if (this.handlePathTimeout()) return;

        if (this.currentTargetId) {
            this.handleCurrentTarget();
            return;
        }

        if (Pathfinder.isPathing()) {
            this.state = STATES.PATHING;
            return;
        }

        const candidates = this.getAvailableCandidates(liveRats);

        if (!candidates.length) {
            this.beginLobbySwap();
            return;
        }

        this.startMultiGoalPath(candidates);
    }

    handleCurrentTarget() {
        const target = this.findRatById(this.currentTargetId);
        if (!target) {
            OverlayManager.incrementTrackedValue(this.oid, 'cleared');
            this.blacklistCurrentTarget();
            return;
        }

        const position = this.getRatPosition(target);
        if (!position) {
            this.blacklistCurrentTarget();
            return;
        }

        const distance = this.getDistanceToPlayer(position);

        if (Date.now() - this.engageStartedAt >= KILL_TIMEOUT_MS) {
            this.blacklistCurrentTarget();
            return;
        }

        if (distance <= SHOOT_RANGE) {
            if (Pathfinder.isPathing()) return;
            Keybind.stopMovement();
            this.state = STATES.ENGAGING;

            Guis.setItemSlot(this.weaponSlot);

            if (distance < BACKUP_DISTANCE) {
                Keybind.setKey('s', true);
            }

            const aimPoint = this.getTargetAimPoint(target);
            if (aimPoint) Rotations.rotateToVector(aimPoint, true);

            if (aimPoint && this.isAimedAtPoint(aimPoint) && Date.now() - this.lastClickAt >= CLICK_DELAY_MS) {
                Keybind.rightClick();
                this.lastClickAt = Date.now();
            }
        } else {
            if (!Pathfinder.isPathing()) {
                this.startSingleTargetPath(target);
                return;
            }

            if (!Pathfinder.isPathing()) {
                Rotations.rotateToEntity(target, 1.05);
                Keybind.setKeysForStraightLineCoords(position.x, position.y, position.z, true, true);
                Keybind.setKey('sprint', true);
            }
        }
    }

    startMultiGoalPath(candidates) {
        if (!candidates.length) return;

        this.pendingCandidates = candidates;
        this.state = STATES.PATHING;

        const goals = [];
        candidates.forEach((candidate) => {
            if (!candidate || !candidate.goals) return;
            candidate.goals.forEach((goal) => {
                goals.push(goal);
            });
        });
        const token = ++this.pathRequestToken;
        this.pathStartedAt = Date.now();

        Pathfinder.resetPath();
        Pathfinder.findPath(goals, (success) => {
            if (!this.enabled || token !== this.pathRequestToken) return;
            this.pathStartedAt = 0;

            const pending = this.pendingCandidates;
            this.pendingCandidates = [];

            if (!success) {
                pending.forEach((candidate) => this.blacklistCandidate(candidate));
                this.state = STATES.WAITING;
                return;
            }

            const selected = this.resolveClosestGoal(pending.filter((candidate) => this.isCandidateAvailable(candidate)));
            if (!selected) {
                this.state = STATES.WAITING;
                return;
            }

            this.currentTargetId = selected.id;
            this.currentTargetKey = selected.key;
            this.engageStartedAt = Date.now();
            this.state = STATES.ENGAGING;
        });
    }

    startSingleTargetPath(target) {
        const candidate = this.createCandidate(target);
        if (!candidate) {
            this.blacklistCurrentTarget();
            return;
        }

        this.state = STATES.PATHING;

        const token = ++this.pathRequestToken;
        this.pathStartedAt = Date.now();
        Pathfinder.resetPath();
        Pathfinder.findPath(candidate.goals, (success) => {
            if (!this.enabled || token !== this.pathRequestToken) return;
            this.pathStartedAt = 0;
            if (!success) {
                this.blacklistCurrentTarget();
                return;
            }

            if (this.currentTargetId === candidate.id) {
                this.state = STATES.ENGAGING;
            }
        });
    }

    resolveClosestGoal(candidates) {
        if (!candidates?.length) return null;

        const lastNode = this.getLastPathNode();
        if (!lastNode) return candidates[0];

        let bestCandidate = candidates[0];
        let bestDistance = Number.MAX_VALUE;

        candidates.forEach((candidate) => {
            candidate.goals.forEach((goal) => {
                const dx = lastNode.x - goal[0];
                const dy = lastNode.y - (goal[1] + 1);
                const dz = lastNode.z - goal[2];
                const distanceSq = dx * dx + dy * dy + dz * dz;

                if (distanceSq < bestDistance) {
                    bestDistance = distanceSq;
                    bestCandidate = candidate;
                }
            });
        });

        return bestCandidate;
    }

    getLastPathNode() {
        const result = Pathfinder.getResult?.();
        const path = result?.path;
        if (path?.length) return path[path.length - 1];

        const keynodes = result?.keynodes;
        if (keynodes?.length) return keynodes[keynodes.length - 1];

        return null;
    }

    createCandidate(entity) {
        const id = getRatId(entity);
        const position = this.getRatPosition(entity);
        if (!id || !position) return null;

        const baseX = Math.floor(position.x);
        const baseY = Math.floor(position.y);
        const baseZ = Math.floor(position.z);
        const goals = [];
        const seen = new Set();

        GOAL_OFFSETS.forEach((dx) => {
            GOAL_OFFSETS.forEach((dy) => {
                GOAL_OFFSETS.forEach((dz) => {
                    const goal = [baseX + dx, baseY + dy, baseZ + dz];
                    const key = goal.join(',');
                    if (seen.has(key)) return;
                    seen.add(key);
                    goals.push(goal);
                });
            });
        });

        return {
            id,
            key: this.getRatPositionKey(position),
            goals,
        };
    }

    getAvailableCandidates(rats = this.getLiveRats()) {
        return rats.map((entity) => this.createCandidate(entity)).filter((candidate) => this.isCandidateAvailable(candidate));
    }

    updateDeadRatBlacklist() {
        getRawHubRats().forEach((entity) => {
            if (!entity || !entity.isDead()) return;
            this.blacklistRat(entity);
        });
    }

    getLiveRats() {
        return getHubRats().filter((entity) => {
            if (!entity) return false;
            if (this.isBlacklistedRat(entity)) return false;
            return !entity.isDead();
        });
    }

    findRatById(id) {
        if (!id) return null;
        if (this.blacklistedRatIds.has(id)) return null;
        if (this.currentTargetKey && this.blacklistedRatKeys.has(this.currentTargetKey)) return null;

        const entity = getRawHubRats().find((rat) => rat && getRatId(rat) === id);
        if (!entity) return null;

        if (entity.isDead()) {
            this.blacklistRat(entity);
            return null;
        }

        if (this.isBlacklistedRat(entity)) return null;

        return entity;
    }

    isCandidateAvailable(candidate) {
        if (!candidate) return false;
        if (candidate.id && this.blacklistedRatIds.has(candidate.id)) return false;
        if (candidate.key && this.blacklistedRatKeys.has(candidate.key)) return false;
        return this.hasLiveRatCandidate(candidate);
    }

    hasLiveRatCandidate(candidate) {
        return this.getLiveRats().some((entity) => {
            const id = getRatId(entity);
            if (candidate.id && id === candidate.id) return true;

            const key = this.getRatKey(entity);
            return Boolean(candidate.key && key && candidate.key === key);
        });
    }

    isBlacklistedRat(entity) {
        const id = getRatId(entity);
        if (id && this.blacklistedRatIds.has(id)) return true;

        const key = this.getRatKey(entity);
        return Boolean(key && this.blacklistedRatKeys.has(key));
    }

    blacklistRat(entity) {
        if (!entity) return;

        const id = getRatId(entity);
        if (id) this.blacklistedRatIds.add(id);

        const key = this.getRatKey(entity);
        if (key) this.blacklistedRatKeys.add(key);
    }

    blacklistCandidate(candidate) {
        if (!candidate) return;
        if (candidate.id) this.blacklistedRatIds.add(candidate.id);
        if (candidate.key) this.blacklistedRatKeys.add(candidate.key);
    }

    getRatKey(entity) {
        return this.getRatPositionKey(this.getRatPosition(entity));
    }

    getRatPositionKey(position) {
        if (!position) return null;
        return `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
    }

    getRatPosition(entity) {
        if (!entity) return null;
        return {
            x: entity.getX(),
            y: entity.getY(),
            z: entity.getZ(),
        };
    }

    getTargetAimPoint(entity) {
        const aimPoint = Rotations.getEntityAimPoint(entity);
        if (!aimPoint)
            return {
                x: entity.x,
                y: entity.y,
                z: entity.z,
            };

        return {
            x: aimPoint.x,
            y: aimPoint.y + AIM_POINT_Y_OFFSET,
            z: aimPoint.z,
        };
    }

    isAimedAtPoint(point) {
        const angleData = MathUtils.angleToPlayer(point);
        return angleData.yawAbs <= AIM_TOLERANCE && angleData.pitchAbs <= AIM_TOLERANCE;
    }

    isRatVisible(entity) {
        const playerMP = Player.asPlayerMP();
        if (!playerMP) return true;

        try {
            return playerMP.canSeeEntity(entity);
        } catch (e) {
            return true;
        }
    }

    getDistanceToPlayer(position) {
        const dx = position.x - Player.getX();
        const dy = position.y - Player.getY();
        const dz = position.z - Player.getZ();
        return Math.hypot(dx, dy, dz);
    }

    blacklistCurrentTarget() {
        if (this.currentTargetId) this.blacklistedRatIds.add(this.currentTargetId);
        if (this.currentTargetKey) this.blacklistedRatKeys.add(this.currentTargetKey);

        this.clearCurrentTarget();
    }

    clearCurrentTarget() {
        this.cancelPathing();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.engageStartedAt = 0;
        Keybind.stopMovement();
        Rotations.stopRotation();
        this.state = STATES.WAITING;
    }

    beginLobbySwap() {
        this.cancelPathing();
        this.pendingCandidates = [];
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.engageStartedAt = 0;
        Keybind.stopMovement();
        Rotations.stopRotation();

        if (this.swapStage !== SWAP_STAGES.NONE) return;

        this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
        this.swapUntil = this.swapMode === SWAP_MODES.VIP ? 0 : Date.now() + LOBBY_SWAP_WAIT_MS;
        this.lastSwapActionAt = 0;
        this.state = 'Warping Hub';
        ChatLib.command('warp hub');
    }

    handleLobbySwap() {
        if (this.swapStage === SWAP_STAGES.NONE) return false;

        if (this.swapStage === SWAP_STAGES.WAIT_HUB_SCAN) {
            if (Utils.area() === 'Hub') {
                const candidates = this.getAvailableCandidates();
                if (candidates.length) {
                    this.swapStage = SWAP_STAGES.NONE;
                    this.swapUntil = 0;
                    this.lastSwapActionAt = 0;
                    this.state = STATES.WAITING;
                    return false;
                }

                if (this.swapMode === SWAP_MODES.VIP) {
                    this.swapStage = SWAP_STAGES.WAIT_VIP_MENU;
                    this.swapUntil = Date.now() + VIP_SWAP_TIMEOUT_MS;
                    this.lastSwapActionAt = 0;
                    this.state = 'Changing Lobby';
                    this.tryHandleVipSwapMenu();
                    return true;
                }
            }

            if (this.swapMode === SWAP_MODES.VIP) return true;

            if (Date.now() < this.swapUntil) return true;

            this.swapStage = SWAP_STAGES.WAIT_ISLAND_RETURN;
            this.swapUntil = Date.now() + LOBBY_SWAP_WAIT_MS;
            this.lastSwapActionAt = Date.now();
            this.state = 'Changing Lobby';
            ChatLib.command('is');
            return true;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_ISLAND_RETURN) {
            if (Date.now() < this.swapUntil) return true;

            this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
            this.swapUntil = Date.now() + LOBBY_SWAP_WAIT_MS;
            this.lastSwapActionAt = Date.now();
            this.state = 'Warping Hub';
            ChatLib.command('warp hub');
            return true;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_VIP_MENU) {
            if (Client.isInGui()) {
                Guis.clickSlot(VIP_SWAP_SLOT, false, 'RIGHT');
                this.swapStage = SWAP_STAGES.WAIT_VIP_TRANSFER;
                this.swapUntil = Date.now() + VIP_SWAP_TRANSFER_TIMEOUT_MS;
                this.lastSwapActionAt = Date.now();
                this.vipRotationToken++;
                this.state = 'Switching VIP Hub';
                return true;
            }

            if (Date.now() - this.lastSwapActionAt >= VIP_SWAP_RETRY_MS) {
                this.tryHandleVipSwapMenu();
            }

            if (Date.now() < this.swapUntil) return true;

            this.swapStage = SWAP_STAGES.NONE;
            this.swapUntil = 0;
            this.lastSwapActionAt = 0;
            this.vipRotationToken++;
            this.state = STATES.WAITING;
            return false;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_VIP_TRANSFER) {
            if (Utils.area() !== 'Hub') {
                if (Date.now() < this.swapUntil) return true;

                this.swapStage = SWAP_STAGES.NONE;
                this.swapUntil = 0;
                this.lastSwapActionAt = 0;
                this.vipRotationToken++;
                this.state = STATES.WAITING;
                return false;
            }

            this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
            this.swapUntil = 0;
            this.lastSwapActionAt = 0;
            this.state = STATES.WAITING;
            return true;
        }

        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken++;
        return false;
    }

    isHandlingSwapGui() {
        return this.swapStage === SWAP_STAGES.WAIT_VIP_MENU;
    }

    tryHandleVipSwapMenu() {
        this.lastSwapActionAt = Date.now();

        const npcPosition = { x: -5.5, y: 69, z: -22.5 };
        if (this.getDistanceToPlayer(npcPosition) > VIP_SWAP_INTERACT_RANGE) {
            this.state = 'Walking to VIP NPC';
            this.startVipSwapPath(npcPosition);
            return true;
        }

        const token = ++this.vipRotationToken;
        this.state = 'Facing VIP NPC';
        const aimPoint = { x: npcPosition.x, y: npcPosition.y + 1.5, z: npcPosition.z };
        Rotations.rotateToVector(aimPoint);
        Rotations.onEndRotation(() => {
            if (this.vipRotationToken !== token) return;
            if (Client.isInGui()) return;
            Keybind.rightClick();
        }, 'rat_macro_vip_swap');

        return true;
    }

    startVipSwapPath(position) {
        const goals = this.getVipSwapGoals(position);
        if (!goals.length) return;

        this.pathStartedAt = Date.now();
        const token = ++this.pathRequestToken;
        Pathfinder.resetPath();
        Pathfinder.findPath(goals, (success) => {
            if (!this.enabled || this.swapStage !== SWAP_STAGES.WAIT_VIP_MENU || token !== this.pathRequestToken) return;
            this.pathStartedAt = 0;
            this.lastSwapActionAt = Date.now();
            if (!success) return;
            this.tryHandleVipSwapMenu();
        });
    }

    getVipSwapGoals(position) {
        if (!position) return [];

        const baseX = Math.floor(position.x);
        const baseY = Math.floor(position.y) - 1;
        const baseZ = Math.floor(position.z);
        const goals = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                goals.push([baseX + dx, baseY, baseZ + dz]);
            }
        }

        return goals;
    }

    handlePathTimeout() {
        if (!Pathfinder.isPathing() || this.pathStartedAt <= 0) return false;
        if (Date.now() - this.pathStartedAt < PATH_TIMEOUT_MS) return false;

        this.pathRequestToken++;
        this.pathStartedAt = 0;
        Pathfinder.resetPath();

        if (this.currentTargetId) {
            this.blacklistCurrentTarget();
            return true;
        }

        this.pendingCandidates = [];
        this.state = STATES.WAITING;
        return true;
    }

    cancelPathing() {
        this.pathStartedAt = 0;
        if (!Pathfinder.isPathing()) return;
        this.pathRequestToken++;
        this.pendingCandidates = [];
        Pathfinder.resetPath();
    }

    getTargetDisplayName() {
        if (!this.currentTargetId) return 'None';
        return `Rat ${this.currentTargetId.slice(0, 6)}`;
    }

    formatNumber(value) {
        if (!Number.isFinite(value)) return '0';
        return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    onWorldUnload() {
        this.blacklistedRatIds.clear();
        this.blacklistedRatKeys.clear();
        this.pendingCandidates = [];
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.pathRequestToken++;
        this.pathStartedAt = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken++;
        Pathfinder.resetPath();
        Keybind.stopMovement();
        Rotations.stopRotation();
        if (this.swapStage === SWAP_STAGES.NONE) {
            this.state = STATES.WAITING;
        }
    }

    onEnable() {
        this.blacklistedRatIds.clear();
        this.blacklistedRatKeys.clear();
        this.pendingCandidates = [];
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.pathStartedAt = 0;
        this.engageStartedAt = 0;
        this.lastClickAt = 0;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken = 0;
        this.state = STATES.WAITING;
        Mouse.ungrab();
        this.message('&aEnabled');
    }

    onDisable() {
        this.cancelPathing();
        this.pendingCandidates = [];
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.pathStartedAt = 0;
        this.engageStartedAt = 0;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken++;
        Keybind.stopMovement();
        Keybind.unpressKeys();
        Rotations.stopRotation();
        this.state = STATES.WAITING;
        Mouse.regrab();
        this.message('&cDisabled');
    }
}

new RatMacro();
