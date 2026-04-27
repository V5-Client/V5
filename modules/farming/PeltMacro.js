import { OverlayManager } from '../../gui/OverlayUtils';
import { MCHand, PathManager, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { PlayerInteractItemC2S } from '../../utils/Packets';
import { ScheduleTask } from '../../utils/ScheduleTask';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import { PathExecutor } from '../../utils/pathfinder/PathExecutor';
import { MathUtils } from '../../utils/Math';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { PeltQOLModule } from './PeltQOL';
import { Mouse } from '../../utils/Ungrab';

// this is complete codex vibecoded slop, but it works so who cares!

const RaycastContext = net.minecraft.world.RaycastContext;

const TREVOR_TARGETS = {
    'desert settlement': [
        [164, 76, -375],
        [196, 76, -369],
    ],
    'desert mountain': [
        [241, 96, -411],
        [259, 95, -533],
    ],
    'mushroom desert': [
        [193, 66, -468],
        [332, 101, -447],
    ],
    'mushroom gorge': [
        [308, 52, -454],
        [272, 55, -523],
    ],
    'glowing mushroom cave': [
        [215, 42, -443],
        [221, 40, -560],
    ],
    oasis: [
        [127, 64, -427],
        [121, 75, -505],
    ],
    'overgrown mushroom cave': [
        [242, 56, -401],
        [284, 54, -379],
    ],
};
const TRAVEL_MODES = ['Pathfind', 'AOTE delayed'];
const TRAP_WARP_POSITION = [281, 104, -548];

const parseAOTERoute = (sequence) => {
    const matches = String(sequence || '').match(/-?\d+(?:\.\d+)?/g);
    if (!matches || matches.length < 2 || matches.length % 2 !== 0) return [];

    const directions = [];
    for (let index = 0; index < matches.length; index += 2) {
        const yaw = Number.parseFloat(matches[index]);
        const pitch = Number.parseFloat(matches[index + 1]);
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return [];
        directions.push({ yaw, pitch });
    }

    return directions;
};
const AOTE_ROUTES = {
    'desert mountain': parseAOTERoute('171 0 -170 20 -110 10 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 33 0 33 0 33 0 33 0 33 0 33 0 33 0'),
    'desert settlement': parseAOTERoute(
        '171 0 -170 20 -110 10 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 33 0 33 0 33 0 33 0 33 0 33 0 33 0 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30'
    ),
    oasis: parseAOTERoute(
        '171 0 -170 20 -110 10 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 0 -90 33 0 33 0 33 0 33 0 33 0 33 0 33 0 90 30 90 30 90 30 90 30 90 30 90 30 90 30 90 30 90 30 90 30 90 30'
    ),
    'glowing mushroom cave': parseAOTERoute(
        '171 0 -170 20 -110 10 -40 -20 -10 -20 -10 -20 -10 -20 12 0 40 80 40 80 40 70 40 60 40 50 100 10 100 10 90 10 90 -10 90 -10 90 0 90 10'
    ),
    'overgrown mushroom cave': parseAOTERoute(
        '171 0 -170 20 -110 10 -40 -20 -10 -20 -10 -20 -10 -20 12 0 40 80 40 80 40 70 40 60 40 50 40 20 40 15 40 10 50 0 -5 -10 -5 -10 0 0 45 -5 45 -5 45 -5 60 8 60 8'
    ),
    'mushroom gorge': parseAOTERoute('171 0 -170 20 -110 10 -40 -20 -10 -20 -10 -20 -10 -20 12 0 12 0'),
};
const PELT_NAMES = new Set(['Cow', 'Pig', 'Sheep', 'Chicken', 'Rabbit', 'Horse', 'Mooshroom', 'Dinnerbone']);
const PELT_HP = new Set([100, 200, 500, 1000, 2000, 5000, 10000, 1024, 20000, 30000, 60000]);
const MOB_REACHED_DISTANCE = 5;
const MOB_KILL_TIMEOUT_DEFAULT_SECONDS = 30;
const MOB_KILL_TIMEOUT_MIN_SECONDS = 15;
const MOB_KILL_TIMEOUT_MAX_SECONDS = 40;
const SHOOT_COOLDOWN_MS = 250;
const AIM_TOLERANCE = 5;
const MAX_STATIONARY_SHOTS = 3;
const MOB_REPOSITION_MS = 1000;
const MOB_PATH_RETRY_MS = 100;
const MOB_VISIBILITY_PADDING = 0.25;
const MOB_VISIBILITY_SAMPLE_OFFSETS = [0, 0.5, 1];
const PELT_ETHERWARP_RADIUS = 14;
const PELT_ETHERWARP_MAX_DISTANCE = 24;
const ETHERWARP_LOS_HEAD_ABOVE_FEET = 1.62;
const ETHERWARP_LOS_RAY_EXTEND = 0.25;
const ETHERWARP_BLACKLIST_CUBE_HALF = 1;

class PeltMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Pelt Macro',
            subcategory: 'Farming',
            description: 'Pathfinds to Trevor hunt coordinates from chat.',
            theme: '#d99a3e',
            isMacro: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();
        this.status = 'Idle';
        this.weaponSlot = 0;
        this.travelMode = TRAVEL_MODES[0];
        this.travelState = null;
        this.travelSequenceToken = 0;
        this.lastMobPathAt = 0;
        this.lastShotAt = 0;
        this.mobShots = 0;
        this.mobRepositions = 0;
        this.mobRepositionUntil = 0;
        this.currentMobId = '';
        this.mobTrackedAt = 0;
        this.mobPathExpand = 5;
        this.mobPathActive = false;
        this.mobPathToken = 0;
        this.holdingMobJump = false;
        this.restartToken = 0;
        this.restartActive = false;
        this.areaTravelState = null;
        this.areaTravelToken = 0;
        this.areaPathRequestToken = 0;
        this.mobKillTimeoutMs = MOB_KILL_TIMEOUT_DEFAULT_SECONDS * 1000;
        this.targetHandleToken = 0;
        this.pendingTrevorTarget = null;
        this.useEtherwarpPathfinder = false;
        this.etherwarpLandingBlacklist = new Set();

        this.addToggle(
            'Etherwarp Pathfinder',
            (enabled) => {
                this.useEtherwarpPathfinder = !!enabled;
            },
            'Use etherwarp pathfinding (Aspect of the Void/End) for area travel and reaching pelt mobs instead of walking paths when possible.',
            false
        );
        this.addMultiToggle(
            'Travel Mode',
            TRAVEL_MODES,
            true,
            (selected) => {
                const enabled = Array.isArray(selected) ? selected.find((item) => item.enabled) : null;
                this.travelMode = enabled?.name || TRAVEL_MODES[0];
            },
            'How Trevor area travel is handled.',
            TRAVEL_MODES[0]
        );
        this.addSlider(
            'Weapon Slot',
            1,
            9,
            1,
            (value) => {
                this.weaponSlot = Math.max(0, Math.min(8, Math.round(value) - 1));
            },
            'Hotbar slot to swap to before shooting the pelt mob.'
        );
        this.addSlider(
            'Mob Kill Timeout',
            MOB_KILL_TIMEOUT_MIN_SECONDS,
            MOB_KILL_TIMEOUT_MAX_SECONDS,
            MOB_KILL_TIMEOUT_DEFAULT_SECONDS,
            (value) => {
                const timeoutSeconds = Math.max(MOB_KILL_TIMEOUT_MIN_SECONDS, Math.min(MOB_KILL_TIMEOUT_MAX_SECONDS, Math.round(value)));
                this.mobKillTimeoutMs = timeoutSeconds * 1000;
            },
            'How long to track a pelt mob before restarting Trevor hunt.'
        );
        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        State: () => this.status,
                        Pelts: () => this.getPeltsDisplay(),
                        'Pelts/hr': () => this.getPeltsPerHourDisplay(),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    pelts: 0,
                },
            }
        );

        this.on('tick', () => this.handleTick());
        this.on('chat', ({ message }) => {
            this.trackPelts(message);
            const target = this.getTrevorTarget(message);
            if (!target || !this.enabled) return;
            this.targetHandleToken++;
            this.pendingTrevorTarget = target;
        });
    }

    onEnable() {
        PeltQOLModule.ensureForceEnabled();
        Mouse.ungrab();
        this.status = 'Calling Trevor';
        this.resetMobTracking();
        this.resetAreaTravelState();
        this.lastShotAt = 0;
        this.targetHandleToken++;
        this.pendingTrevorTarget = null;
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        ChatLib.command('call trevor');
    }

    handleTick() {
        PeltQOLModule.ensureForceEnabled();
        const areaName = Utils.area();
        this.syncMobJumpHold(this.enabled && this.shouldHoldMobJump());
        if (!this.enabled || !areaName) return;
        if (areaName != 'The Farming Islands') {
            this.restartTrevorHunt(areaName);
            return;
        }
        if (this.consumePendingTrevorTarget()) return;
        if (this.handleTravelTick()) return;
        if (this.checkMobTimeout()) return;
        this.tryHandlePeltMob(false);
    }

    consumePendingTrevorTarget() {
        const target = this.pendingTrevorTarget;
        if (!target) return false;
        this.pendingTrevorTarget = null;

        if (this.tryHandlePeltMob(true)) return true;
        this.startTravelToTarget(target);
        return true;
    }

    getTrevorTarget(message) {
        const text = this.getMessageText(message);
        const match = text.match(/\[npc\]\s*trevor:.*?near the (.+?)\.\s*$/i);
        if (!match) return null;
        const name = match[1].trim().toLowerCase();
        const goals = this.normalizeTrevorGoals(TREVOR_TARGETS[name]);
        if (!goals.length) return null;
        return { name, goals };
    }

    normalizeTrevorGoals(rawGoals) {
        if (!Array.isArray(rawGoals) || !rawGoals.length) return [];

        const input = typeof rawGoals[0] === 'number' ? [rawGoals] : rawGoals;
        const goals = [];
        const seen = new Set();

        for (const goal of input) {
            if (!Array.isArray(goal) || goal.length < 3) continue;

            const x = Math.floor(Number(goal[0]));
            const y = Math.floor(Number(goal[1]));
            const z = Math.floor(Number(goal[2]));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

            const key = `${x},${y},${z}`;
            if (seen.has(key)) continue;
            seen.add(key);
            goals.push([x, y, z]);
        }

        return goals;
    }

    getMessageText(message) {
        return ChatLib.removeFormatting(String(message?.getUnformattedText?.() ?? ''));
    }

    trackPelts(message) {
        if (!this.enabled) return;

        const match = this.getMessageText(message).match(/Killing the animal rewarded you ([\d,]+) pelts?\./i);
        if (!match) return;

        const pelts = parseInt(match[1].replace(/,/g, ''), 10);
        if (!Number.isFinite(pelts) || pelts <= 0) return;
        OverlayManager.incrementTrackedValue(this.oid, 'pelts', pelts);
        this.targetHandleToken++;
        this.pendingTrevorTarget = null;
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        this.resetAreaTravelState();
        this.stopMovement();
        this.resetMobTracking();
        this.lastShotAt = 0;
    }

    getPeltsDisplay() {
        return this.formatCount(OverlayManager.getTrackedValue(this.oid, 'pelts', 0));
    }

    getPeltsPerHourDisplay() {
        const hours = this.getActiveHours();
        if (hours <= 0) return '0';
        return this.formatCount(OverlayManager.getTrackedValue(this.oid, 'pelts', 0) / hours);
    }

    getActiveHours() {
        const elapsedMs = OverlayManager.getSessionElapsedMs(this.oid);
        if (elapsedMs <= 0) return 0;
        return elapsedMs / 3600000;
    }

    formatCount(value) {
        if (!Number.isFinite(value)) return '0';
        const rounded = Math.round(value);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    findPeltMob() {
        for (const entity of World.getAllEntities()) {
            if (!PELT_NAMES.has(entity.getName()) || entity.isDead() || !PELT_HP.has(entity.getMaxHP())) continue;
            return entity;
        }
        return null;
    }

    canSeeMob(entity) {
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world || !entity) return false;

        try {
            const eyePos = player.getEyePos();
            const mcEntity = entity.toMC ? entity.toMC() : entity;
            const box = mcEntity?.getBoundingBox?.();
            if (!eyePos || !box) return Player.asPlayerMP()?.canSeeEntity?.(entity) ?? false;

            const minX = box.minX - MOB_VISIBILITY_PADDING;
            const minY = box.minY - MOB_VISIBILITY_PADDING;
            const minZ = box.minZ - MOB_VISIBILITY_PADDING;
            const maxX = box.maxX + MOB_VISIBILITY_PADDING;
            const maxY = box.maxY + MOB_VISIBILITY_PADDING;
            const maxZ = box.maxZ + MOB_VISIBILITY_PADDING;

            for (const xOffset of MOB_VISIBILITY_SAMPLE_OFFSETS) {
                const sampleX = minX + (maxX - minX) * xOffset;
                for (const yOffset of MOB_VISIBILITY_SAMPLE_OFFSETS) {
                    const sampleY = minY + (maxY - minY) * yOffset;
                    for (const zOffset of MOB_VISIBILITY_SAMPLE_OFFSETS) {
                        const sampleZ = minZ + (maxZ - minZ) * zOffset;
                        const hit = world.raycast(
                            new RaycastContext(
                                eyePos,
                                new Vec3d(sampleX, sampleY, sampleZ),
                                RaycastContext.ShapeType.COLLIDER,
                                RaycastContext.FluidHandling.NONE,
                                player
                            )
                        );

                        if (!hit || String(hit.getType()) === 'MISS') {
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (e) {
            return Player.asPlayerMP()?.canSeeEntity?.(entity) ?? false;
        }
    }

    /** Eye position once per LOS decision: client eyes, else feet + native etherwarp eye height. */
    getPeltEtherwarpLosEye() {
        const player = Player.getPlayer();
        if (!player) return null;
        try {
            const ep = player.getEyePos?.();
            if (ep) {
                const ex = Number(ep.x);
                const ey = Number(ep.y);
                const ez = Number(ep.z);
                if ([ex, ey, ez].every(Number.isFinite)) return { ex, ey, ez };
            }
        } catch (e) {
            /* fall through */
        }
        try {
            const eh = Number(PathManager.getCurrentEtherwarpEyeHeight?.());
            const add = Number.isFinite(eh) ? eh : ETHERWARP_LOS_HEAD_ABOVE_FEET;
            const ex = Number(Player.getX());
            const ey = Number(Player.getY()) + add;
            const ez = Number(Player.getZ());
            if ([ex, ey, ez].every(Number.isFinite)) return { ex, ey, ez };
        } catch (e2) {
            /* ignore */
        }
        return null;
    }

    /**
     * Collider raycast: first block hit along eye→(sample + small extend toward sample) must be the landing block.
     * Extending the ray slightly past the sample avoids MISS when the endpoint sits exactly on an air/solid boundary.
     */
    isLosRayHitLandingBlock(eyePos, endX, endY, endZ, landingBx, landingBy, landingBz, player, world) {
        if (!eyePos || !player || !world) return false;
        if (![endX, endY, endZ].every(Number.isFinite)) return false;
        try {
            const ex = eyePos.x;
            const ey = eyePos.y;
            const ez = eyePos.z;
            let dx = endX - ex;
            let dy = endY - ey;
            let dz = endZ - ez;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len < 1e-4) return false;
            dx /= len;
            dy /= len;
            dz /= len;
            const ext = ETHERWARP_LOS_RAY_EXTEND;
            const endVec = new Vec3d(endX + dx * ext, endY + dy * ext, endZ + dz * ext);
            const hit = world.raycast(new RaycastContext(eyePos, endVec, RaycastContext.ShapeType.COLLIDER, RaycastContext.FluidHandling.NONE, player));
            if (!hit) return false;
            const typeStr = String(hit.getType?.());
            if (typeStr === 'MISS') return false;
            const pos = hit.getBlockPos?.();
            if (!pos) return false;
            return pos.getX() === landingBx && pos.getY() === landingBy && pos.getZ() === landingBz;
        } catch (e) {
            return false;
        }
    }

    /**
     * Player/world + eye Vec3d once per resolveEtherwarpLandingGoal — avoids N× getPlayer/getWorld/native eye + Vec3d alloc.
     */
    buildEtherwarpLosEnv(eye) {
        if (!eye || ![eye.ex, eye.ey, eye.ez].every(Number.isFinite)) return null;
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world) return null;
        let eyePos = null;
        try {
            const nativeEye = player.getEyePos?.();
            if (nativeEye && [nativeEye.x, nativeEye.y, nativeEye.z].every(Number.isFinite)) {
                eyePos = new Vec3d(nativeEye.x, nativeEye.y, nativeEye.z);
            }
        } catch (e) {
            eyePos = null;
        }
        if (!eyePos) eyePos = new Vec3d(eye.ex, eye.ey, eye.ez);
        return { player, world, eyePos };
    }

    /**
     * Single collider probe: landing block visible from eye (same ray contract as etherwarp LOS).
     */
    hasEtherwarpLandingLos(losEnv, goal) {
        if (!losEnv || !goal) return false;

        const gx = Number(goal.x);
        const gy = Number(goal.y);
        const gz = Number(goal.z);
        if (![gx, gy, gz].every(Number.isFinite)) return false;

        const lbX = Math.floor(gx);
        const lbY = Math.floor(gy);
        const lbZ = Math.floor(gz);
        const { player, world, eyePos } = losEnv;

        const tx = lbX + 0.5;
        const ty = gy + 0.5;
        const tz = lbZ + 0.5;
        return this.isLosRayHitLandingBlock(eyePos, tx, ty, tz, lbX, lbY, lbZ, player, world);
    }

    resetMobTracking() {
        this.resetEtherwarpLandingBlacklist();
        this.lastMobPathAt = 0;
        this.currentMobId = '';
        this.mobShots = 0;
        this.mobRepositions = 0;
        this.mobRepositionUntil = 0;
        this.mobTrackedAt = 0;
        this.mobPathExpand = 5;
        this.mobPathActive = false;
        this.mobPathToken++;
        this.syncMobJumpHold(false);
    }

    resetMobPathState() {
        this.mobPathExpand = 5;
        this.mobPathActive = false;
    }

    stopPathing() {
        this.mobPathActive = false;
        this.mobPathToken++;
        if (EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
        Pathfinder.resetPath();
        PathExecutor.destroy();
    }

    stopMovement() {
        this.stopPathing();
        Keybind.stopMovement();
        Rotations.stopRotation();
    }

    prepareForTravel() {
        if (EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
        Pathfinder.resetPath();
        PathExecutor.destroy();
        this.cancelRestartSequence();
        this.cancelTravelSequence();
        this.resetAreaTravelState();
        this.resetMobTracking();
    }

    getAOTESlot() {
        const aotvSlot = Guis.findItemInHotbar('Aspect of the Void');
        return aotvSlot !== -1 ? aotvSlot : Guis.findItemInHotbar('Aspect of the End');
    }

    isAOTETravelMode(mode = this.travelMode) {
        return mode === 'AOTE delayed';
    }

    startTravelToTarget(target) {
        this.prepareForTravel();
        const goals = this.normalizeTrevorGoals(target?.goals);
        if (!goals.length) return;

        this.areaTravelState = {
            areaName: target.name,
            goals,
            blacklist: new Set(),
            token: ++this.areaTravelToken,
        };

        if (this.shouldUseAOTETravel(target.name)) return this.startAOTETravel(target);
        this.startAreaPath();
    }

    startAreaPath() {
        const state = this.areaTravelState;
        if (!state?.goals?.length) return false;
        if (this.findPeltMob()) return false;

        const availableGoals = state.goals.filter((goal) => !state.blacklist.has(this.getGoalKey(goal)));
        if (!availableGoals.length) return false;

        const pathToken = ++this.areaPathRequestToken;
        const stateToken = state.token;
        const [x, y, z] = availableGoals[0];
        if (!this.mobTrackedAt) this.mobTrackedAt = Date.now();
        this.status = `Area ${x}, ${y}, ${z}`;

        if (this.useEtherwarpPathfinder) {
            const goalCoords = this.getClosestGoalToPlayer(availableGoals);
            if (goalCoords) {
                const goal =
                    this.resolveEtherwarpLandingGoal(goalCoords[0], goalCoords[1], goalCoords[2], {
                        horizontalRefX: goalCoords[0],
                        horizontalRefZ: goalCoords[2],
                    }) || null;
                if (!goal) {
                    this.startAreaPathWithWalkfinder(stateToken, pathToken, availableGoals);
                    return true;
                }
                const started = EtherwarpPathfinder.findPath(goal, {
                    silent: true,
                    restoreSlot: true,
                    onSuccess: () => {
                        if (!this.enabled || pathToken !== this.areaPathRequestToken) return;
                        if (!this.areaTravelState || this.areaTravelState.token !== stateToken) return;
                        this.completeAreaPathSegment(stateToken, pathToken, availableGoals);
                    },
                    onFail: () => {
                        if (!this.enabled || pathToken !== this.areaPathRequestToken) return;
                        if (!this.areaTravelState || this.areaTravelState.token !== stateToken) return;
                        this.startAreaPathWithWalkfinder(stateToken, pathToken, availableGoals);
                    },
                });
                if (started) {
                    this.blacklistEtherwarpLandingGoal(goal);
                    return true;
                }
            }
        }

        this.startAreaPathWithWalkfinder(stateToken, pathToken, availableGoals);
        return true;
    }

    shouldUseAOTETravel(areaName) {
        return this.isAOTETravelMode() && !!AOTE_ROUTES[areaName]?.length;
    }

    startAOTETravel(target) {
        if (!this.mobTrackedAt) this.mobTrackedAt = Date.now();
        this.stopMovement();
        const atTrapWarp = this.isAtTrapWarpPosition();
        const slot = this.getAOTESlot();
        if (slot === -1) {
            this.message('&cNo Aspect of the Void/End in hotbar. Falling back to pathing.');
            this.startAreaPath();
            return;
        }

        this.travelState = {
            areaName: target.name,
            phase: 'warp',
            startedAt: Date.now(),
            routeCompletedAt: 0,
            sequenceToken: this.travelSequenceToken,
        };

        Guis.setItemSlot(slot);

        if (atTrapWarp) {
            this.status = `AOTEing ${target.name}`;
            return;
        }

        this.status = `Warp Trap -> ${target.name}`;
        this.stopMovement();
        ChatLib.command('warp trap');
    }

    handleTravelTick() {
        if (!this.travelState) return false;

        switch (this.travelState.phase) {
            case 'warp':
                return this.handleWarpPhase();
            case 'settle':
                return this.handleSettlePhase();
            default:
                return false;
        }
    }

    cancelTravelSequence() {
        this.travelState = null;
        this.travelSequenceToken++;
    }

    isAtTrapWarpPosition() {
        const [x, y, z] = TRAP_WARP_POSITION;
        return Math.floor(Player.getX()) === x && Math.floor(Player.getY()) === y && Math.floor(Player.getZ()) === z;
    }

    sendAOTEPackets(directions) {
        if (!Array.isArray(directions) || !directions.length) return false;

        const token = this.travelState?.sequenceToken;
        if (!Number.isFinite(token)) return false;

        const sendPacket = (direction, isLast) => {
            if (!this.enabled) return;
            if (this.travelState?.sequenceToken !== token) return;
            if (!direction || !Number.isFinite(direction.yaw) || !Number.isFinite(direction.pitch)) return;

            Rotations.applyRotationWithGCD(direction.yaw, direction.pitch);

            const yaw = Number.parseFloat(Player.getYaw());
            const pitch = Number.parseFloat(Player.getPitch());
            if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;

            Client.sendPacket(new PlayerInteractItemC2S(MCHand.MAIN_HAND, 0, yaw, pitch));
            if (isLast && this.travelState?.sequenceToken === token) {
                this.travelState.routeCompletedAt = Date.now();
            }
        };

        for (let index = 0; index < directions.length; index++) {
            const direction = directions[index];
            const isLast = index === directions.length - 1;
            ScheduleTask(index + 1, () => sendPacket(direction, isLast));
        }

        return true;
    }

    fallbackToAreaPath() {
        this.cancelTravelSequence();
        this.startAreaPath();
        return true;
    }

    handleWarpPhase() {
        if (this.isAtTrapWarpPosition()) {
            this.status = `AOTEing ${this.travelState.areaName}`;
            const route = AOTE_ROUTES[this.travelState.areaName];
            if (!this.sendAOTEPackets(route)) {
                return this.fallbackToAreaPath();
            }

            this.travelState.phase = 'settle';
            return true;
        }

        this.status = 'Waiting for /warp trap';
        if (Date.now() - this.travelState.startedAt <= 5000) return true;
        return this.fallbackToAreaPath();
    }

    handleSettlePhase() {
        if (!this.travelState.routeCompletedAt) return true;
        if (Date.now() - this.travelState.routeCompletedAt < 500) return true;
        return this.fallbackToAreaPath();
    }

    tryHandlePeltMob(forcePath) {
        const mob = this.findPeltMob();
        if (!mob) return false;

        const mobId = this.getMobId(mob);
        const isNewMob = this.currentMobId !== mobId;
        const distance = this.getMobDistance(mob);

        this.trackCurrentMob(mobId);
        if (this.checkMobTimeout()) return true;

        const isRepositioning = this.updateMobRepositionState();
        if (!isRepositioning && this.canSeeMob(mob)) {
            this.handleVisibleMob(mob);
            if (this.mobShots < MAX_STATIONARY_SHOTS) return true;
            this.startMobReposition(mob, mobId, distance);
        }

        if (this.isMobRepositioning()) return true;
        if (distance <= MOB_REACHED_DISTANCE) {
            this.mobPathActive = false;
            this.status = 'At Pelt Mob';
            return true;
        }

        if (isNewMob) this.resetMobPathState();
        if (!this.shouldStartMobPath(isNewMob, forcePath)) return true;

        this.startMobPath(mob, mobId, distance);
        return true;
    }

    getMobDistance(entity) {
        return Math.hypot(entity.getX() - Player.getX(), entity.getY() - Player.getY(), entity.getZ() - Player.getZ());
    }

    getGoalKey(goal) {
        if (!Array.isArray(goal) || goal.length < 3) return '';
        return `${Math.floor(Number(goal[0]))},${Math.floor(Number(goal[1]))},${Math.floor(Number(goal[2]))}`;
    }

    getEtherwarpLandingKey(goal) {
        if (!goal || goal.x === undefined) return '';
        const x = Math.floor(Number(goal.x));
        const y = Math.floor(Number(goal.y));
        const z = Math.floor(Number(goal.z));
        if (![x, y, z].every(Number.isFinite)) return '';
        return `${x},${y},${z}`;
    }

    blacklistEtherwarpLandingGoal(goal) {
        const x = Math.floor(Number(goal?.x));
        const y = Math.floor(Number(goal?.y));
        const z = Math.floor(Number(goal?.z));
        if (![x, y, z].every(Number.isFinite)) return;

        const h = ETHERWARP_BLACKLIST_CUBE_HALF;
        for (let dx = -h; dx <= h; dx++) {
            for (let dy = -h; dy <= h; dy++) {
                for (let dz = -h; dz <= h; dz++) {
                    this.etherwarpLandingBlacklist.add(`${x + dx},${y + dy},${z + dz}`);
                }
            }
        }
    }

    resetEtherwarpLandingBlacklist() {
        this.etherwarpLandingBlacklist.clear();
    }

    getClosestGoalToPlayer(goals) {
        if (!Array.isArray(goals) || !goals.length) return null;

        let closest = null;
        let bestDistSq = Infinity;
        const playerX = Player.getX();
        const playerY = Player.getY();
        const playerZ = Player.getZ();

        for (const goal of goals) {
            if (!Array.isArray(goal) || goal.length < 3) continue;
            const dx = playerX - goal[0];
            const dy = playerY - goal[1];
            const dz = playerZ - goal[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq >= bestDistSq) continue;
            bestDistSq = distSq;
            closest = goal;
        }

        return closest;
    }

    /**
     * Resolves a PathManager-valid etherwarp landing near the anchor (see RatMacro / getEtherwarpLandingCandidates).
     * Sort origin uses the player's support block when available so the native finder matches EtherwarpPathfinder start.
     * Picks the first candidate (native order) with valid LOS; one raycast per candidate until one passes.
     */
    resolveEtherwarpLandingGoal(anchorX, anchorY, anchorZ, options = {}) {
        const radius = Number.isFinite(options.radius) ? options.radius : PELT_ETHERWARP_RADIUS;
        const maxDistance = Number.isFinite(options.maxDistance) ? options.maxDistance : PELT_ETHERWARP_MAX_DISTANCE;

        const ax = Math.floor(Number(anchorX));
        const ay = Math.floor(Number(anchorY));
        const az = Math.floor(Number(anchorZ));
        if (![ax, ay, az].every(Number.isFinite)) return null;

        const support = EtherwarpPathfinder.getPlayerSupportBlock();
        const sortOrigin = support || {
            x: Math.floor(Player.getX()),
            y: Math.floor(Player.getY()),
            z: Math.floor(Player.getZ()),
        };

        const result = PathManager.getEtherwarpLandingCandidates(ax, ay, az, radius, maxDistance, sortOrigin.x, sortOrigin.y, sortOrigin.z);
        if (!result?.goals || !result?.centers) return null;

        const goals = result.goals;
        const centers = result.centers;
        const eye = this.getPeltEtherwarpLosEye();

        const entries = [];
        for (let gi = 0, ci = 0; gi + 2 < goals.length && ci + 2 < centers.length; gi += 3, ci += 3) {
            const goal = { x: goals[gi], y: goals[gi + 1], z: goals[gi + 2] };
            const center = { x: centers[ci], y: centers[ci + 1], z: centers[ci + 2] };
            entries.push({ goal, center });
        }
        const filteredEntries = entries.filter((e) => !this.etherwarpLandingBlacklist.has(this.getEtherwarpLandingKey(e.goal)));
        if (!filteredEntries.length) return null;

        const losEnv = eye ? this.buildEtherwarpLosEnv(eye) : null;
        if (losEnv) {
            for (const e of filteredEntries) {
                if (this.hasEtherwarpLandingLos(losEnv, e.goal)) return e.goal;
            }
        }

        return filteredEntries[0].goal;
    }

    resolvePeltMobEtherwarpGoal(mob) {
        if (!mob) return null;
        const mx = mob.getX();
        const my = mob.getY();
        const mz = mob.getZ();

        return this.resolveEtherwarpLandingGoal(mx, my, mz, {
            horizontalRefX: mx,
            horizontalRefZ: mz,
        });
    }

    resetAreaTravelState() {
        if (this.areaTravelState) EtherwarpPathfinder.cancel(true);
        this.areaTravelState = null;
        this.areaTravelToken++;
        this.areaPathRequestToken++;
    }

    completeAreaPathSegment(stateToken, pathToken, availableGoals) {
        if (!this.enabled || pathToken !== this.areaPathRequestToken) return;

        const currentState = this.areaTravelState;
        if (!currentState || currentState.token !== stateToken) return;

        const reachedGoal = this.getClosestGoalToPlayer(availableGoals);
        if (reachedGoal) currentState.blacklist.add(this.getGoalKey(reachedGoal));

        const remaining = currentState.goals.filter((goal) => !currentState.blacklist.has(this.getGoalKey(goal)));
        if (!remaining.length) return;
        if (this.findPeltMob()) return;

        ScheduleTask(2, () => {
            const latestState = this.areaTravelState;
            if (!this.enabled || !latestState || latestState.token !== stateToken) return;
            this.startAreaPath();
        });
    }

    startAreaPathWithWalkfinder(stateToken, pathToken, availableGoals) {
        Pathfinder.resetPath();
        Pathfinder.findPath(availableGoals, (success) => {
            if (!this.enabled || pathToken !== this.areaPathRequestToken) return;

            const currentState = this.areaTravelState;
            if (!currentState || currentState.token !== stateToken) return;
            if (!success) return;

            this.completeAreaPathSegment(stateToken, pathToken, availableGoals);
        });
    }

    trackCurrentMob(mobId) {
        if (this.currentMobId !== mobId) {
            this.resetEtherwarpLandingBlacklist();
            if (EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
            this.resetAreaTravelState();
            this.currentMobId = mobId;
            this.mobShots = 0;
            this.mobRepositions = 0;
            this.mobRepositionUntil = 0;
            this.syncMobJumpHold(false);
            if (!this.mobTrackedAt) this.mobTrackedAt = Date.now();
            this.restartActive = false;
            return;
        }

        if (!this.mobTrackedAt) this.mobTrackedAt = Date.now();
    }

    shouldStartMobPath(isNewMob, forcePath) {
        if (this.mobPathActive && !isNewMob) return false;
        if (isNewMob || forcePath || !this.lastMobPathAt) return true;
        return Date.now() - this.lastMobPathAt >= MOB_PATH_RETRY_MS;
    }

    checkMobTimeout() {
        if (this.restartActive || !this.mobTrackedAt) return false;
        if (Date.now() - this.mobTrackedAt < this.mobKillTimeoutMs) return false;

        ChatLib.command('warp hub');

        this.restartTrevorHunt();
        return true;
    }

    cancelRestartSequence() {
        this.restartActive = false;
        this.restartToken++;
    }

    queueCommand(command, delay = 0, token = this.restartToken) {
        const normalized = `${command || ''}`.trim().replace(/^\//, '');
        if (!normalized) return;

        ScheduleTask(delay, () => {
            if (!this.enabled || token !== this.restartToken) return;
            this.stopMovement();
            ChatLib.command(normalized);
        });
    }

    restartTrevorHunt() {
        if (this.restartActive) return;

        this.restartActive = true;
        this.restartToken++;
        const token = this.restartToken;

        this.stopMovement();
        this.targetHandleToken++;
        this.pendingTrevorTarget = null;
        this.cancelTravelSequence();
        this.resetAreaTravelState();
        this.resetMobTracking();
        this.lastShotAt = 0;
        this.status = 'Restarting Hunt';

        ScheduleTask(70, () => {
            if (!this.enabled || token !== this.restartToken) return;
            let area = Utils.area();
            if (area == 'unknown') {
                ChatLib.command('play skyblock');
                ScheduleTask(70, () => {
                    if (!this.enabled || token !== this.restartToken) return;
                    ChatLib.command('warp trapper');
                    ScheduleTask(10, () => {
                        if (!this.enabled || token !== this.restartToken) return;
                        ChatLib.command('call trevor');
                    });
                });
            } else {
                ChatLib.command('warp trapper');
                ScheduleTask(10, () => {
                    if (!this.enabled || token !== this.restartToken) return;

                    ChatLib.command('call trevor');
                });
            }
        });
    }

    startMobPath(mob, mobId, distance) {
        this.currentMobId = mobId;
        this.lastMobPathAt = Date.now();
        this.mobPathActive = true;
        const token = ++this.mobPathToken;
        this.status = `Mob ${Math.round(distance)}m`;

        const runWalkMobPath = () => {
            Pathfinder.resetPath();
            Pathfinder.findPath(this.getMobGoals(mob, this.mobPathExpand), (success) => {
                if (!this.enabled || token !== this.mobPathToken) return;

                this.mobPathActive = false;
                if (success) {
                    this.mobPathExpand = 5;
                    return;
                }

                if (this.currentMobId !== mobId) return;
                this.mobPathExpand = Math.min(this.mobPathExpand + 5, 50);
            });
        };

        if (this.useEtherwarpPathfinder) {
            const etherGoal = this.resolvePeltMobEtherwarpGoal(mob);
            if (etherGoal) {
                const started = EtherwarpPathfinder.findPath(etherGoal, {
                    silent: true,
                    restoreSlot: true,
                    onSuccess: () => {
                        if (!this.enabled || token !== this.mobPathToken) return;
                        this.mobPathActive = false;
                        this.mobPathExpand = 5;
                    },
                    onFail: () => {
                        if (!this.enabled || token !== this.mobPathToken) return;
                        runWalkMobPath();
                    },
                });
                if (started) {
                    this.blacklistEtherwarpLandingGoal(etherGoal);
                    return;
                }
            }
        }

        runWalkMobPath();
    }

    isMobRepositioning() {
        return this.mobRepositionUntil > Date.now();
    }

    startMobReposition(mob, mobId, distance) {
        this.mobRepositions++;
        this.mobRepositionUntil = Date.now() + MOB_REPOSITION_MS;
        this.lastMobPathAt = 0;
        Rotations.stopRotation();
        this.syncMobJumpHold(this.shouldHoldMobJump());
        if (mob) this.startMobPath(mob, mobId, distance);
    }

    updateMobRepositionState() {
        if (!this.mobRepositionUntil) return false;
        if (this.isMobRepositioning()) return true;

        this.mobRepositionUntil = 0;
        this.mobShots = 0;
        if (this.mobPathActive || Pathfinder.isPathing() || EtherwarpPathfinder.isPathing()) this.stopPathing();
        return false;
    }

    handleVisibleMob(entity) {
        if (Pathfinder.isPathing() || EtherwarpPathfinder.isPathing()) {
            this.stopPathing();
        }

        this.status = 'Shooting Mob';
        const aimPoint = this.getAimPoint(entity);
        Guis.setItemSlot(this.weaponSlot);
        Rotations.rotateToEntity(entity);

        if (Date.now() - this.lastShotAt < SHOOT_COOLDOWN_MS) return;
        if (!this.isAimedAt(aimPoint)) return;

        Keybind.rightClick();
        this.lastShotAt = Date.now();
        this.mobShots++;
    }

    shouldHoldMobJump() {
        return !!this.currentMobId && this.mobRepositions >= 5;
    }

    syncMobJumpHold(shouldHold) {
        const changed = this.holdingMobJump !== shouldHold;
        this.holdingMobJump = shouldHold;
        if (changed || shouldHold) Keybind.setKey('space', shouldHold);
    }

    getMobGoals(entity, expand = 0) {
        const x = Math.floor(entity.getX());
        const y = Math.floor(entity.getY());
        const z = Math.floor(entity.getZ());
        const playerX = Player.getX();
        const playerZ = Player.getZ();
        const radius = Math.min(Math.max(1 + expand, 10), 25);
        const minY = y - (10 + expand);
        const maxY = y + 4;
        const goals = [];
        const seen = new Set();

        for (let dy = maxY; dy >= minY; dy--) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const goalX = x + dx;
                    const goalZ = z + dz;
                    if (Math.hypot(dx, dz) < 10) continue;
                    if (Math.hypot(goalX - playerX, goalZ - playerZ) < 10) continue;
                    const key = `${goalX},${dy},${goalZ}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    goals.push([goalX, dy, goalZ]);
                }
            }
        }

        const randomGoals = goals.filter(() => Math.random() < 0.01);
        if (randomGoals.length) return randomGoals;
        return goals.length ? [goals[Math.floor(Math.random() * goals.length)]] : goals;
    }

    getMobId(entity) {
        try {
            return entity.getUUID().toString();
        } catch (e) {
            return `${Math.floor(entity.getX())}:${Math.floor(entity.getY())}:${Math.floor(entity.getZ())}`;
        }
    }

    getAimPoint(entity) {
        return Rotations.getEntityAimPoint(entity) || [entity.getX(), entity.getY() + entity.getHeight() * 0.7, entity.getZ()];
    }

    isAimedAt(point) {
        const angleData = MathUtils.angleToPlayer(point);
        return angleData.yawAbs <= AIM_TOLERANCE && angleData.pitchAbs <= AIM_TOLERANCE;
    }

    onDisable() {
        this.status = 'Idle';
        this.lastShotAt = 0;
        this.targetHandleToken++;
        this.pendingTrevorTarget = null;
        this.syncMobJumpHold(false);
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        this.resetAreaTravelState();
        this.resetMobTracking();
        this.stopMovement();
        Mouse.regrab();
    }
}

new PeltMacro();
