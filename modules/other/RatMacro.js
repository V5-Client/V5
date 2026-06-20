//Vibecoded SLOP, STILL WORKS FINE :3
import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { OverlayManager } from '../../gui/OverlayUtils';
import { Chat } from '../../utils/Chat';
import { MCHand } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { PlayerInteractItemC2S } from '../../utils/Packets';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import PathConfig from '../../utils/pathfinder/PathConfig';
import { getHubRats, getRatId, getRawHubRats } from '../visuals/RatESP';

const STATES = {
    WAITING: 'Waiting',
    PATHING: 'Pathing',
    ENGAGING: 'Engaging',
};

const PATH_MODES = {
    NONE: 'NONE',
    RAT: 'RAT',
    VIP: 'VIP',
};

const RAT_ENGAGE_DISTANCE = 5;
const RAT_GOAL_RADIUS = 3;
const RAT_GOAL_MAX_DISTANCE = 4;
const MAX_RAT_PATH_ATTEMPTS = 2;
const ATTACK_DELAY_TICKS = 0;
const POST_KILL_DELAY_TICKS = 0;
const ASSUMED_DEAD_TIMEOUT_MS = 1500;
const RAT_MEMORY_MS = 12000;
const RAT_CACHE_VERIFY_DISTANCE = 56;
const RAT_KILL_BLACKLIST_RADIUS = 7;
const RAT_KILL_BLACKLIST_RADIUS_SQ = RAT_KILL_BLACKLIST_RADIUS * RAT_KILL_BLACKLIST_RADIUS;
const LOBBY_SWAP_WAIT_MS = 4000;
const VIP_SWAP_RETRY_MS = 750;
const VIP_SWAP_TIMEOUT_MS = 10000;
const VIP_SWAP_TRANSFER_TIMEOUT_MS = 10000;
const VIP_TRANSFER_WORLD_CHANGE_WAIT_MS = 1000;
const VIP_POST_TRANSFER_SCAN_WAIT_MS = 350;
const VIP_SWAP_SLOT = 50;
const VIP_SWAP_INTERACT_RANGE = 3;
const VIP_NPC_POSITION = { x: -5.5, y: 68, z: -22.5 };
const VIP_SWAP_PATH_GOAL = { x: -6, y: 68, z: -23 };

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
            description: 'VIBECODED SLOP. Etherwarps to Hub rats and uses your held gun.',
            tooltip: 'VIBECODED SLOP. Etherwarps to Hub rats and uses your held gun.',
            theme: '#d7b24a',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.state = STATES.WAITING;
        this.weaponSlot = 0;
        this.blacklistedRatIds = new Set();
        this.blacklistedRatKeys = new Set();
        this.assumedDeadRatKeys = new Map();
        this.killedRatZones = [];
        this.ratPositionCache = new Map();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.currentTargetGoal = null;
        this.currentTargetPathAttempts = 0;
        this.currentPathMode = PATH_MODES.NONE;
        this.currentPathRequestToken = 0;
        this.pendingAttackAtGoal = false;
        this.pendingAttackToken = 0;
        this.nextTargetDelayActive = false;
        this.nextTargetDelayToken = 0;
        this.swapMode = SWAP_MODES.ISLAND;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.lastWorldUnloadAt = 0;
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

    debug(message) {
        Chat.messageDebug(`&6Rat Macro:&f ${message}`);
    }

    setState(nextState, reason = null) {
        if (this.state === nextState) return;

        const previousState = this.state;
        this.state = nextState;

        const reasonText = reason ? ` &7(${reason})` : '';
        this.debug(`state &e${previousState}&f -> &e${nextState}&f${reasonText}`);
    }

    formatPosition(position) {
        if (!position) return 'unknown';
        return `${Number(position.x).toFixed(1)}, ${Number(position.y).toFixed(1)}, ${Number(position.z).toFixed(1)}`;
    }

    formatRatRef(id = this.currentTargetId, key = this.currentTargetKey) {
        if (id) return `${id.slice(0, 6)} (${key || 'no-key'})`;
        return key || 'unknown-rat';
    }

    onTick() {
        if (!this.enabled) return;
        if (!Player.getPlayer() || !World.isLoaded()) return;
        if (!Client.isInChat() && Client.isInGui() && !this.isHandlingSwapGui()) {
            Guis.closeInv();
            return;
        }

        const now = Date.now();

        if (this.handleLobbySwap()) return;

        if (Utils.area() !== 'Hub') {
            this.cancelPathing();
            Keybind.stopMovement();
            this.setState(STATES.WAITING, `left hub for ${Utils.area() || 'unknown area'}`);
            return;
        }

        this.updateDeadRatBlacklist();
        this.pruneAssumedDeadRatKeys();
        const liveRats = this.getLiveRats();
        this.rememberLiveRatPositions(now, liveRats);
        this.pruneRatPositionCache(now, liveRats);

        if (this.currentTargetId) {
            this.handleCurrentTarget();
            return;
        }

        if (this.currentPathMode === PATH_MODES.RAT || this.pendingAttackAtGoal) {
            this.cancelPathing();
        }

        if (this.nextTargetDelayActive) {
            this.setState(STATES.WAITING, 'waiting before next rat');
            return;
        }

        const candidates = this.getAvailableCandidates();
        if (!candidates.length) {
            this.beginLobbySwap();
            return;
        }

        this.beginRatTarget(candidates[0]);
    }

    handleCurrentTarget() {
        const target = this.findRatById(this.currentTargetId);
        const cachedTarget = this.getCachedRatRecord(this.currentTargetId);
        const cachedPosition = cachedTarget && cachedTarget.position ? cachedTarget.position : null;
        const position = this.getRatPosition(target) || cachedPosition || null;
        if (!target && !position) {
            this.dropCurrentTarget('no live entity and no cached position');
            return;
        }

        if (target && this.canEngageTargetRat(target, position)) {
            this.attackCurrentTarget();
            return;
        }

        if (this.pendingAttackAtGoal) {
            this.setState(STATES.ENGAGING, `attack pending for ${this.formatRatRef()}`);
            return;
        }

        if (this.currentPathMode === PATH_MODES.RAT && EtherwarpPathfinder.isPathing()) {
            this.setState(STATES.PATHING, `actively pathing to ${this.formatRatRef()}`);
            return;
        }

        this.startCurrentTargetPath(target, position);
    }

    beginRatTarget(candidate) {
        if (!candidate || !candidate.id || !candidate.goal) return;

        this.currentTargetId = candidate.id;
        this.currentTargetKey = candidate.key;
        this.currentTargetGoal = candidate.goal;
        this.currentTargetPathAttempts = 0;
        this.debug(
            `targeting rat &e${this.formatRatRef(candidate.id, candidate.key)}&f at &b${this.formatPosition(candidate.position)}&f with goal &b${this.formatPosition(candidate.goal)}`
        );
        this.startCurrentTargetPath(this.findRatById(candidate.id), candidate.position);
    }

    startCurrentTargetPath(target, position) {
        if (!this.currentTargetId || !this.currentTargetKey) return;
        if (this.currentTargetPathAttempts >= MAX_RAT_PATH_ATTEMPTS) {
            this.debug(`blacklisting rat &e${this.formatRatRef()}&f after ${this.currentTargetPathAttempts} failed path attempts`);
            this.blacklistCurrentTarget();
            return;
        }
        if (typeof position === 'undefined') {
            const cachedTarget = this.getCachedRatRecord(this.currentTargetId);
            const cachedPosition = cachedTarget && cachedTarget.position ? cachedTarget.position : null;
            position = this.getRatPosition(target) || cachedPosition || null;
        }
        if (!position) {
            this.debug(`lost rat &e${this.formatRatRef()}&f before path start`);
            this.dropCurrentTarget('missing position before path start');
            return;
        }

        const goal = this.resolveNearestLandingGoal(position, {
            radius: RAT_GOAL_RADIUS,
            maxDistance: RAT_GOAL_MAX_DISTANCE,
            sortOrigin: this.getPathSortOrigin(),
        });
        if (!goal) {
            this.debug(`no landing goal found for rat &e${this.formatRatRef()}&f at &b${this.formatPosition(position)}`);
            this.blacklistCurrentTarget();
            return;
        }

        if (target && this.canEngageTargetRat(target, position)) {
            this.currentTargetGoal = goal;
            this.debug(`already in range/eyesight for rat &e${this.formatRatRef()}&f, attacking immediately`);
            this.attackCurrentTarget();
            return;
        }

        this.currentTargetPathAttempts++;
        this.debug(
            `starting rat path attempt ${this.currentTargetPathAttempts}/${MAX_RAT_PATH_ATTEMPTS} for &e${this.formatRatRef()}&f from &b${this.formatPosition(this.getPathSortOrigin())}&f to &b${this.formatPosition(goal)}`
        );

        this.cancelRatPathState();

        const token = ++this.currentPathRequestToken;
        this.currentTargetGoal = goal;
        this.currentPathMode = PATH_MODES.RAT;
        this.setState(STATES.PATHING, `pathing to rat ${this.formatRatRef()}`);

        const started = EtherwarpPathfinder.findPath(goal, {
            silent: !this.isEtherwarpPathfinderDebugEnabled(),
            restoreSlot: true,
            onSuccess: (resolvedGoal) => {
                if (!this.enabled || token !== this.currentPathRequestToken || this.currentPathMode !== PATH_MODES.RAT) return;
                this.currentTargetGoal = resolvedGoal || goal;
                this.currentPathMode = PATH_MODES.NONE;
                this.debug(`rat path succeeded for &e${this.formatRatRef()}&f; resolved goal &b${this.formatPosition(this.currentTargetGoal)}`);
                if (this.canEngageCurrentTargetRat()) this.attackCurrentTarget();
            },
            onFail: () => {
                if (!this.enabled || token !== this.currentPathRequestToken || this.currentPathMode !== PATH_MODES.RAT) return;
                this.currentPathMode = PATH_MODES.NONE;
                this.debug(`rat path failed for &e${this.formatRatRef()}&f on attempt ${this.currentTargetPathAttempts}/${MAX_RAT_PATH_ATTEMPTS}`);
            },
        });

        if (!started) {
            this.currentPathMode = PATH_MODES.NONE;
            this.debug(`pathfinder refused rat path start for &e${this.formatRatRef()}`);
        }
    }

    attackCurrentTarget() {
        if (!this.currentTargetId || this.pendingAttackAtGoal) return;

        this.cancelRatPathState();
        this.pendingAttackAtGoal = true;
        this.setState(STATES.ENGAGING, `preparing shot for ${this.formatRatRef()}`);
        Keybind.stopMovement();
        Rotations.stop();
        Guis.setItemSlot(this.weaponSlot);
        this.debug(`queued attack on rat &e${this.formatRatRef()}&f using slot &e${this.weaponSlot + 1}`);

        const attackToken = ++this.pendingAttackToken;
        ScheduleTask(ATTACK_DELAY_TICKS, () => {
            if (!this.enabled || attackToken !== this.pendingAttackToken || !this.pendingAttackAtGoal) return;

            const attackTarget = this.findRatById(this.currentTargetId);
            if (!attackTarget) {
                this.pendingAttackAtGoal = false;
                this.debug(`attack target vanished for &e${this.formatRatRef()}&f before firing`);
                this.dropCurrentTarget('target vanished before attack packet');
                return;
            }

            const aimPoint = Rotations.getAimPoint(attackTarget);
            if (!aimPoint) {
                this.pendingAttackAtGoal = false;
                this.debug(`failed to resolve aim point for rat &e${this.formatRatRef()}&f`);
                this.dropCurrentTarget('failed to resolve aim point');
                return;
            }

            Rotations.lookAtVector(aimPoint);
            Rotations.onComplete(() => {
                if (!this.enabled || attackToken !== this.pendingAttackToken || !this.pendingAttackAtGoal) return;

                const yaw = Number.parseFloat(Player.getYaw());
                const pitch = Number.parseFloat(Player.getPitch());
                this.debug(`firing at rat &e${this.formatRatRef()}&f with yaw &e${yaw.toFixed(2)}&f pitch &e${pitch.toFixed(2)}`);
                Client.sendSequencedPacket((sequence) => new PlayerInteractItemC2S(MCHand.MAIN_HAND, sequence, yaw, pitch));
                this.markRatAssumedDead(attackTarget);
                this.pendingAttackAtGoal = false;
                this.finishCurrentTargetKilled();
            }, 'rat_macro_attack');
        });
    }

    getAvailableCandidates(rats = this.getLiveRats()) {
        const sortOrigin = this.getPathSortOrigin();
        const candidates = [];
        const seenIds = new Set();
        const seenKeys = new Set();

        rats.forEach((entity) => {
            const candidate = this.createCandidate(entity, sortOrigin);
            if (!candidate) return;
            if (candidate.id) seenIds.add(candidate.id);
            if (candidate.key) seenKeys.add(candidate.key);

            if (!candidate.goal) {
                this.blacklistCandidate(candidate);
                return;
            }

            if (!this.isCandidateAvailable(candidate)) return;
            candidates.push(candidate);
        });

        this.ratPositionCache.forEach((record, id) => {
            if (!id || seenIds.has(id)) return;
            if (record && record.key && seenKeys.has(record.key)) return;

            const cachedRecord = this.getCachedRatRecord(id);
            if (!cachedRecord) return;

            const candidate = this.createCandidateFromCache(cachedRecord, sortOrigin);
            if (!candidate || !candidate.goal) return;
            if (!this.isCandidateAvailable(candidate)) return;
            candidates.push(candidate);
        });

        candidates.sort((a, b) => {
            if (a.originDistanceSq !== b.originDistanceSq) return a.originDistanceSq - b.originDistanceSq;
            return a.anchorDistanceSq - b.anchorDistanceSq;
        });

        return candidates;
    }

    createCandidate(entity, sortOrigin = this.getPathSortOrigin()) {
        const id = getRatId(entity);
        const position = this.getRatPosition(entity);
        if (!id || !position) return null;

        return this.createCandidateFromPosition(id, position, sortOrigin);
    }

    createCandidateFromCache(record, sortOrigin = this.getPathSortOrigin()) {
        if (!record || !record.id || !record.position) return null;
        return this.createCandidateFromPosition(record.id, record.position, sortOrigin, record.key);
    }

    createCandidateFromPosition(id, position, sortOrigin = this.getPathSortOrigin(), key = this.getRatPositionKey(position)) {
        if (!id || !position) return null;

        const goal = this.resolveNearestLandingGoal(position, {
            radius: RAT_GOAL_RADIUS,
            maxDistance: RAT_GOAL_MAX_DISTANCE,
            sortOrigin,
        });
        const standingCenter = goal ? this.getLandingCenter(goal) || goal : null;

        return {
            id,
            key: key || this.getRatPositionKey(position),
            position,
            goal,
            originDistanceSq: goal && sortOrigin ? this.getDistanceSq(goal, sortOrigin) : Number.MAX_VALUE,
            anchorDistanceSq: standingCenter ? this.getDistanceSq(standingCenter, position) : Number.MAX_VALUE,
        };
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
        if (this.isNearKilledRatZone(candidate.position)) return false;
        const assumedDeadKey = this.getRatAssumedDeadKey(candidate.position);
        if (assumedDeadKey && this.assumedDeadRatKeys.has(assumedDeadKey)) return false;
        return true;
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

    getRatAssumedDeadKey(position) {
        if (!position) return null;
        return `${Math.floor(position.x)},${Math.floor(position.z)}`;
    }

    markRatAssumedDead(entity) {
        const position = this.getRatPosition(entity);
        const assumedDeadKey = this.getRatAssumedDeadKey(position);
        if (!assumedDeadKey) return;
        this.assumedDeadRatKeys.set(assumedDeadKey, Date.now() + ASSUMED_DEAD_TIMEOUT_MS);
        this.markKilledRatZone(position);
    }

    pruneAssumedDeadRatKeys() {
        if (!this.assumedDeadRatKeys.size) return;

        const now = Date.now();
        this.assumedDeadRatKeys.forEach((expiresAt, key) => {
            if (expiresAt > now) return;
            this.assumedDeadRatKeys.delete(key);
        });
    }

    rememberLiveRatPositions(now = Date.now(), rats = this.getLiveRats()) {
        rats.forEach((entity) => {
            const id = getRatId(entity);
            const position = this.getRatPosition(entity);
            if (!id || !position) return;

            const key = this.getRatPositionKey(position);
            const assumedDeadKey = this.getRatAssumedDeadKey(position);

            if (
                this.blacklistedRatIds.has(id) ||
                (key && this.blacklistedRatKeys.has(key)) ||
                this.isNearKilledRatZone(position) ||
                (assumedDeadKey && this.assumedDeadRatKeys.has(assumedDeadKey))
            ) {
                this.ratPositionCache.delete(id);
                return;
            }

            this.ratPositionCache.set(id, {
                id,
                key,
                position,
                lastSeen: now,
            });
        });
    }

    pruneRatPositionCache(now = Date.now(), liveRats = this.getLiveRats()) {
        if (!this.ratPositionCache.size) return;

        const liveRatIds = new Set();
        const liveRatKeys = new Set();
        liveRats.forEach((entity) => {
            const id = getRatId(entity);
            if (id) liveRatIds.add(id);
            const key = this.getRatKey(entity);
            if (key) liveRatKeys.add(key);
        });

        this.ratPositionCache.forEach((record, id) => {
            if (!id || !record || !record.position) {
                this.ratPositionCache.delete(id);
                return;
            }

            const age = now - (record.lastSeen || 0);
            if (age > RAT_MEMORY_MS) {
                this.ratPositionCache.delete(id);
                return;
            }

            if (record.id && this.blacklistedRatIds.has(record.id)) {
                this.ratPositionCache.delete(id);
                return;
            }
            if (record.key && this.blacklistedRatKeys.has(record.key)) {
                this.ratPositionCache.delete(id);
                return;
            }
            if (this.isNearKilledRatZone(record.position)) {
                this.ratPositionCache.delete(id);
                return;
            }

            const assumedDeadKey = this.getRatAssumedDeadKey(record.position);
            if (assumedDeadKey && this.assumedDeadRatKeys.has(assumedDeadKey)) {
                this.ratPositionCache.delete(id);
                return;
            }

            if (record.key && liveRatKeys.has(record.key) && !liveRatIds.has(record.id)) {
                this.ratPositionCache.delete(id);
                return;
            }

            const hasLiveMatch = liveRatIds.has(record.id) || (record.key && liveRatKeys.has(record.key));
            if (!hasLiveMatch && this.getDistanceToPlayer(record.position) <= RAT_CACHE_VERIFY_DISTANCE) {
                this.ratPositionCache.delete(id);
            }
        });
    }

    getCachedRatRecord(id, now = Date.now()) {
        if (!id) return null;

        const record = this.ratPositionCache.get(id);
        if (!record || !record.position) return null;

        const age = now - (record.lastSeen || 0);
        if (age > RAT_MEMORY_MS) {
            this.ratPositionCache.delete(id);
            return null;
        }

        if (record.id && this.blacklistedRatIds.has(record.id)) {
            this.ratPositionCache.delete(id);
            return null;
        }
        if (record.key && this.blacklistedRatKeys.has(record.key)) {
            this.ratPositionCache.delete(id);
            return null;
        }
        if (this.isNearKilledRatZone(record.position)) {
            this.ratPositionCache.delete(id);
            return null;
        }

        const assumedDeadKey = this.getRatAssumedDeadKey(record.position);
        if (assumedDeadKey && this.assumedDeadRatKeys.has(assumedDeadKey)) {
            this.ratPositionCache.delete(id);
            return null;
        }

        return record;
    }

    isNearKilledRatZone(position) {
        if (!position || !this.killedRatZones.length) return false;
        return this.killedRatZones.some((zonePosition) => this.getDistanceSq(zonePosition, position) <= RAT_KILL_BLACKLIST_RADIUS_SQ);
    }

    markKilledRatZone(position) {
        if (!position) return;
        if (this.isNearKilledRatZone(position)) return;

        this.killedRatZones.push({
            x: Number(position.x),
            y: Number(position.y),
            z: Number(position.z),
        });
    }

    getRatPosition(entity) {
        if (!entity) return null;
        return {
            x: entity.getX(),
            y: entity.getY(),
            z: entity.getZ(),
        };
    }

    getDistanceToPlayer(position) {
        if (!position) return Number.MAX_VALUE;

        const dx = position.x - Player.getX();
        const dy = position.y - Player.getY();
        const dz = position.z - Player.getZ();
        return Math.hypot(dx, dy, dz);
    }

    canEngageTargetRat(entity, position = this.getRatPosition(entity)) {
        if (!entity) return false;
        return this.getDistanceToPlayer(position) <= RAT_ENGAGE_DISTANCE || Player.asPlayerMP().canSeeEntity(entity);
    }

    canEngageCurrentTargetRat() {
        if (!this.currentTargetId) return false;

        const target = this.findRatById(this.currentTargetId);
        if (!target) return false;

        return this.canEngageTargetRat(target);
    }

    getDistanceSq(a, b) {
        if (!a || !b) return Number.MAX_VALUE;

        const dx = Number(a.x) - Number(b.x);
        const dy = Number(a.y) - Number(b.y);
        const dz = Number(a.z) - Number(b.z);
        return dx * dx + dy * dy + dz * dz;
    }

    getClosestRatToPlayer(rats = this.getLiveRats()) {
        let closestRat = null;
        let closestDistanceSq = Number.MAX_VALUE;

        rats.forEach((entity) => {
            const position = this.getRatPosition(entity);
            const distanceSq = this.getDistanceSq(position, {
                x: Player.getX(),
                y: Player.getY(),
                z: Player.getZ(),
            });

            if (distanceSq >= closestDistanceSq) return;
            closestRat = entity;
            closestDistanceSq = distanceSq;
        });

        return closestRat;
    }

    getPathSortOrigin() {
        return EtherwarpPathfinder.getPlayerSupportBlock() || { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    }

    resolveNearestLandingGoal(anchor, options = {}) {
        const targetX = Number(anchor?.x);
        const targetY = Number(anchor?.y);
        const targetZ = Number(anchor?.z);
        if (![targetX, targetY, targetZ].every(Number.isFinite)) return null;

        const radius = Math.max(0, Math.floor(Number(options.radius) || 3));
        const maxDistance = Number.isFinite(options.maxDistance) ? Number(options.maxDistance) : radius;
        let sortOrigin = options.sortOrigin;
        if (!sortOrigin || !Number.isFinite(Number(sortOrigin.x)) || !Number.isFinite(Number(sortOrigin.y)) || !Number.isFinite(Number(sortOrigin.z))) {
            sortOrigin = this.getPathSortOrigin();
        } else {
            sortOrigin = {
                x: Number(sortOrigin.x),
                y: Number(sortOrigin.y),
                z: Number(sortOrigin.z),
            };
        }
        const filter = typeof options.filter === 'function' ? options.filter : null;
        if (!sortOrigin) return null;

        const result = PathManager.getEtherwarpLandingCandidates(targetX, targetY, targetZ, radius, maxDistance, sortOrigin.x, sortOrigin.y, sortOrigin.z);
        if (!result) return null;

        const goals = result.goals;
        const centers = result.centers;
        for (let goalIndex = 0, centerIndex = 0; goalIndex + 2 < goals.length && centerIndex + 2 < centers.length; goalIndex += 3, centerIndex += 3) {
            const goal = {
                x: goals[goalIndex],
                y: goals[goalIndex + 1],
                z: goals[goalIndex + 2],
            };
            if (!filter) return goal;

            const standingCenter = {
                x: centers[centerIndex],
                y: centers[centerIndex + 1],
                z: centers[centerIndex + 2],
            };
            if (filter(goal, standingCenter)) return goal;
        }

        return null;
    }

    getLandingCenter(goal) {
        const goalX = Math.floor(Number(goal?.x));
        const goalY = Math.floor(Number(goal?.y));
        const goalZ = Math.floor(Number(goal?.z));
        if (![goalX, goalY, goalZ].every(Number.isFinite)) return null;

        const center = PathManager.getEtherwarpLandingCenter(goalX, goalY, goalZ);
        if (!center) return null;
        return {
            x: center[0],
            y: center[1],
            z: center[2],
        };
    }

    finishCurrentTargetCleared() {
        this.debug(`cleared rat target &e${this.formatRatRef()}`);
        if (this.currentTargetId) this.blacklistedRatIds.add(this.currentTargetId);
        if (this.currentTargetKey) this.blacklistedRatKeys.add(this.currentTargetKey);
        OverlayManager.incrementTrackedValue(this.oid, 'cleared');
        this.clearCurrentTarget();
    }

    dropCurrentTarget(reason = 'lost target') {
        this.debug(`dropping rat target &e${this.formatRatRef()}&f: ${reason}`);
        this.clearCurrentTarget();
    }

    finishCurrentTargetKilled() {
        this.finishCurrentTargetCleared();
        this.scheduleNextTargetDelay();
    }

    scheduleNextTargetDelay() {
        this.nextTargetDelayActive = true;
        const delayToken = ++this.nextTargetDelayToken;

        ScheduleTask(POST_KILL_DELAY_TICKS, () => {
            if (delayToken !== this.nextTargetDelayToken) return;
            this.nextTargetDelayActive = false;
        });
    }

    blacklistCurrentTarget() {
        this.debug(`blacklisting current rat target &e${this.formatRatRef()}`);
        if (this.currentTargetId) this.blacklistedRatIds.add(this.currentTargetId);
        if (this.currentTargetKey) this.blacklistedRatKeys.add(this.currentTargetKey);
        this.clearCurrentTarget();
    }

    clearCurrentTarget() {
        this.cancelPathing();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.currentTargetGoal = null;
        this.currentTargetPathAttempts = 0;
        this.pendingAttackAtGoal = false;
        this.pendingAttackToken++;
        Keybind.stopMovement();
        Rotations.stop();
        this.setState(STATES.WAITING, 'cleared active target');
    }

    beginLobbySwap() {
        this.clearCurrentTarget();

        if (this.swapStage !== SWAP_STAGES.NONE) return;

        this.debug(`no rat candidates left, beginning ${this.swapMode} lobby swap`);
        if (Utils.area() === 'Hub') {
            if (this.swapMode === SWAP_MODES.VIP) {
                this.swapStage = SWAP_STAGES.WAIT_VIP_MENU;
                this.swapUntil = Date.now() + VIP_SWAP_TIMEOUT_MS;
                this.lastSwapActionAt = 0;
                this.debug('hub already loaded, opening VIP lobby selector');
                this.setState('Changing Lobby', 'opening VIP selector');
                this.tryHandleVipSwapMenu();
                return;
            }

            this.swapStage = SWAP_STAGES.WAIT_ISLAND_RETURN;
            this.swapUntil = Date.now() + LOBBY_SWAP_WAIT_MS;
            this.lastSwapActionAt = Date.now();
            this.debug('hub already loaded, returning to island before next hub warp');
            this.setState('Changing Lobby', 'returning to island for lobby swap');
            ChatLib.command('is');
            return;
        }

        this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
        this.swapUntil = this.swapMode === SWAP_MODES.VIP ? 0 : Date.now() + LOBBY_SWAP_WAIT_MS;
        this.lastSwapActionAt = 0;
        this.setState('Warping Hub', 'starting lobby swap cycle');
        ChatLib.command('warp hub');
    }

    resumeNormalModeIfRatsExist(reason) {
        const availableCandidates = this.getAvailableCandidates();
        const candidateCount = availableCandidates.length;
        if (!candidateCount) return null;

        const shouldWaitForGuiClose = Client.isInGui() && this.isHandlingSwapGui();
        if (shouldWaitForGuiClose) {
            Guis.closeInv();
        }

        this.cancelPathing();
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken++;
        this.debug(`detected ${candidateCount} rat candidate${candidateCount === 1 ? '' : 's'} during ${this.swapMode} swap, resuming normal rat hunt`);
        this.setState(STATES.WAITING, reason);
        return shouldWaitForGuiClose;
    }

    handleLobbySwap() {
        if (this.swapStage === SWAP_STAGES.NONE) return false;

        if (this.swapStage === SWAP_STAGES.WAIT_HUB_SCAN) {
            if (Utils.area() === 'Hub') {
                const shouldWaitForGuiClose = this.resumeNormalModeIfRatsExist('rats found after swap');
                if (shouldWaitForGuiClose !== null) {
                    return shouldWaitForGuiClose;
                }

                if (this.swapMode === SWAP_MODES.VIP) {
                    if (Date.now() < this.swapUntil) return true;
                    this.swapStage = SWAP_STAGES.WAIT_VIP_MENU;
                    this.swapUntil = Date.now() + VIP_SWAP_TIMEOUT_MS;
                    this.lastSwapActionAt = 0;
                    this.debug('opening VIP lobby selector');
                    this.setState('Changing Lobby', 'opening VIP selector');
                    this.tryHandleVipSwapMenu();
                    return true;
                }
            }

            if (this.swapMode === SWAP_MODES.VIP) return true;
            if (Date.now() < this.swapUntil) return true;

            this.swapStage = SWAP_STAGES.WAIT_ISLAND_RETURN;
            this.swapUntil = Date.now() + LOBBY_SWAP_WAIT_MS;
            this.lastSwapActionAt = Date.now();
            this.debug('hub scan empty, returning to island before next hub warp');
            this.setState('Changing Lobby', 'returning to island for lobby swap');
            ChatLib.command('is');
            return true;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_ISLAND_RETURN) {
            if (Date.now() < this.swapUntil) return true;

            this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
            this.swapUntil = Date.now() + LOBBY_SWAP_WAIT_MS;
            this.lastSwapActionAt = Date.now();
            this.debug('island wait finished, warping back to hub');
            this.setState('Warping Hub', 'returning to hub after island swap');
            ChatLib.command('warp hub');
            return true;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_VIP_MENU) {
            const shouldWaitForGuiClose = this.resumeNormalModeIfRatsExist('rats found before VIP selector');
            if (shouldWaitForGuiClose !== null) {
                return shouldWaitForGuiClose;
            }

            if (Client.isInGui()) {
                this.cancelPathing();
                Guis.clickSlot(VIP_SWAP_SLOT, false, 'RIGHT');
                this.swapStage = SWAP_STAGES.WAIT_VIP_TRANSFER;
                this.swapUntil = Date.now() + VIP_SWAP_TRANSFER_TIMEOUT_MS;
                this.lastSwapActionAt = Date.now();
                this.vipRotationToken++;
                this.debug('VIP selector opened, clicking transfer slot');
                this.setState('Switching VIP Hub', 'clicked VIP transfer slot');
                return true;
            }

            if (Date.now() - this.lastSwapActionAt >= VIP_SWAP_RETRY_MS) {
                this.tryHandleVipSwapMenu();
            }

            if (Date.now() < this.swapUntil) return true;

            this.cancelPathing();
            this.swapStage = SWAP_STAGES.NONE;
            this.swapUntil = 0;
            this.lastSwapActionAt = 0;
            this.vipRotationToken++;
            this.debug('VIP selector timed out, aborting swap flow');
            this.setState(STATES.WAITING, 'VIP selector timed out');
            return false;
        }

        if (this.swapStage === SWAP_STAGES.WAIT_VIP_TRANSFER) {
            const now = Date.now();
            const clickAt = this.lastSwapActionAt || 0;
            const transferClickAge = clickAt > 0 ? now - clickAt : Number.MAX_VALUE;
            const sawWorldChange = clickAt > 0 && this.lastWorldUnloadAt >= clickAt;

            if (!sawWorldChange) {
                if (transferClickAge < VIP_TRANSFER_WORLD_CHANGE_WAIT_MS) return true;

                this.swapStage = SWAP_STAGES.WAIT_VIP_MENU;
                this.swapUntil = Date.now() + VIP_SWAP_TIMEOUT_MS;
                this.lastSwapActionAt = 0;
                this.vipRotationToken++;
                this.debug(`VIP transfer did not change worlds within ${VIP_TRANSFER_WORLD_CHANGE_WAIT_MS}ms, retrying VIP selector`);
                this.setState('Changing Lobby', 'retrying VIP selector after no world change');
                return true;
            }

            if (Utils.area() !== 'Hub') {
                if (Date.now() < this.swapUntil) return true;

                this.cancelPathing();
                this.swapStage = SWAP_STAGES.NONE;
                this.swapUntil = 0;
                this.lastSwapActionAt = 0;
                this.vipRotationToken++;
                this.debug('VIP transfer timed out without leaving hub');
                this.setState(STATES.WAITING, 'VIP transfer timed out');
                return false;
            }

            this.swapStage = SWAP_STAGES.WAIT_HUB_SCAN;
            this.swapUntil = Date.now() + VIP_POST_TRANSFER_SCAN_WAIT_MS;
            this.lastSwapActionAt = 0;
            this.debug('VIP transfer completed, rescanning hub');
            this.setState(STATES.WAITING, 'VIP transfer completed');
            return true;
        }

        const unexpectedStage = this.swapStage;
        this.cancelPathing();
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.vipRotationToken++;
        this.debug(`swap flow fell through unexpected stage ${unexpectedStage}`);
        return false;
    }

    isHandlingSwapGui() {
        return this.swapStage === SWAP_STAGES.WAIT_VIP_MENU;
    }

    tryHandleVipSwapMenu() {
        this.lastSwapActionAt = Date.now();

        if (this.getDistanceToPlayer(VIP_NPC_POSITION) > VIP_SWAP_INTERACT_RANGE) {
            this.debug(`too far from VIP NPC, pathing to &b${this.formatPosition(VIP_NPC_POSITION)}`);
            this.setState('Etherwarping to VIP NPC', 'moving to VIP selector NPC');
            this.startVipSwapPath();
            return true;
        }

        this.cancelPathing();
        this.vipRotationToken++;
        this.debug('in range of VIP NPC, rotating to interact');
        this.setState('Facing VIP NPC', 'rotating to VIP selector NPC');
        const aimPoint = { x: VIP_NPC_POSITION.x, y: VIP_NPC_POSITION.y + 1.5, z: VIP_NPC_POSITION.z };
        Rotations.lookAtVector(aimPoint);
        if (Client.isInGui()) return;
        this.debug('right clicking VIP NPC to open selector');
        Keybind.rightClick();

        return true;
    }

    startVipSwapPath() {
        if (this.currentPathMode === PATH_MODES.VIP && EtherwarpPathfinder.isPathing()) return;

        this.cancelPathing();
        const goal = VIP_SWAP_PATH_GOAL;

        const token = ++this.currentPathRequestToken;
        this.currentPathMode = PATH_MODES.VIP;
        this.debug(`starting VIP path toward &b${this.formatPosition(goal)}`);
        this.setState('Etherwarping to VIP NPC', 'pathing to VIP selector NPC');

        const started = EtherwarpPathfinder.findPath(goal, {
            silent: !this.isEtherwarpPathfinderDebugEnabled(),
            restoreSlot: true,
            onSuccess: () => {
                if (!this.enabled || token !== this.currentPathRequestToken || this.currentPathMode !== PATH_MODES.VIP) return;
                this.currentPathMode = PATH_MODES.NONE;
                this.lastSwapActionAt = Date.now();
                this.debug('VIP path completed, attempting VIP NPC interaction');
                this.tryHandleVipSwapMenu();
            },
            onFail: () => {
                if (!this.enabled || token !== this.currentPathRequestToken || this.currentPathMode !== PATH_MODES.VIP) return;
                this.currentPathMode = PATH_MODES.NONE;
                this.lastSwapActionAt = Date.now();
                this.debug('VIP path failed after pathfinder retries');
            },
        });

        if (!started) {
            this.currentPathMode = PATH_MODES.NONE;
            this.lastSwapActionAt = Date.now();
            this.debug('pathfinder refused VIP path start');
        }
    }

    cancelRatPathState() {
        if (this.currentPathMode === PATH_MODES.RAT || EtherwarpPathfinder.isPathing()) {
            EtherwarpPathfinder.cancel(true);
        }
        this.currentPathRequestToken++;
        this.currentPathMode = PATH_MODES.NONE;
    }

    cancelPathing() {
        EtherwarpPathfinder.cancel(true);
        this.currentPathRequestToken++;
        this.currentPathMode = PATH_MODES.NONE;
    }

    getTargetDisplayName() {
        if (!this.currentTargetId) return 'None';
        return `Rat ${this.currentTargetId.slice(0, 6)}`;
    }

    isEtherwarpPathfinderDebugEnabled() {
        return PathConfig.PATHFINDING_DEBUG;
    }

    formatNumber(value) {
        if (!Number.isFinite(value)) return '0';
        return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    onWorldUnload() {
        this.lastWorldUnloadAt = Date.now();
        this.blacklistedRatIds.clear();
        this.blacklistedRatKeys.clear();
        this.assumedDeadRatKeys.clear();
        this.killedRatZones = [];
        this.ratPositionCache.clear();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.currentTargetGoal = null;
        this.currentTargetPathAttempts = 0;
        this.pendingAttackAtGoal = false;
        this.pendingAttackToken++;
        this.nextTargetDelayActive = false;
        this.nextTargetDelayToken++;
        if (this.swapStage === SWAP_STAGES.NONE) {
            this.lastSwapActionAt = 0;
        }
        this.vipRotationToken++;
        this.cancelPathing();
        Keybind.stopMovement();
        Rotations.stop();
        if (this.swapStage === SWAP_STAGES.NONE) {
            this.debug('world unloaded, clearing Rat Macro runtime state');
            this.setState(STATES.WAITING, 'world unload reset');
        }
    }

    onEnable() {
        this.blacklistedRatIds.clear();
        this.blacklistedRatKeys.clear();
        this.assumedDeadRatKeys.clear();
        this.killedRatZones = [];
        this.ratPositionCache.clear();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.currentTargetGoal = null;
        this.currentTargetPathAttempts = 0;
        this.currentPathMode = PATH_MODES.NONE;
        this.currentPathRequestToken = 0;
        this.pendingAttackAtGoal = false;
        this.pendingAttackToken = 0;
        this.nextTargetDelayActive = false;
        this.nextTargetDelayToken = 0;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.lastWorldUnloadAt = 0;
        this.vipRotationToken = 0;
        this.setState(STATES.WAITING);
        Mouse.ungrab();
        this.debug(`enabled with swap mode &e${this.swapMode}&f and weapon slot &e${this.weaponSlot + 1}`);
        this.message('&aEnabled');
    }

    onDisable() {
        this.cancelPathing();
        this.currentTargetId = null;
        this.currentTargetKey = null;
        this.currentTargetGoal = null;
        this.assumedDeadRatKeys.clear();
        this.killedRatZones = [];
        this.ratPositionCache.clear();
        this.currentTargetPathAttempts = 0;
        this.pendingAttackAtGoal = false;
        this.pendingAttackToken++;
        this.nextTargetDelayActive = false;
        this.nextTargetDelayToken++;
        this.swapStage = SWAP_STAGES.NONE;
        this.swapUntil = 0;
        this.lastSwapActionAt = 0;
        this.lastWorldUnloadAt = 0;
        this.vipRotationToken++;
        Keybind.stopMovement();
        Keybind.unpressKeys();
        Rotations.stop();
        this.debug('disabled, cleared targeting/pathing state');
        this.setState(STATES.WAITING, 'module disabled');
        Mouse.regrab();
        this.message('&cDisabled');
    }
}

if (isDeveloperModeEnabled()) new RatMacro();
