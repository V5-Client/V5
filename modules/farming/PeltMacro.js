import { OverlayManager } from '../../gui/OverlayUtils';
import { MCHand, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { PlayerInteractItemC2S } from '../../utils/Packets';
import { ScheduleTask } from '../../utils/ScheduleTask';
import Pathfinder from '../../utils/pathfinder/PathFinder';
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
    'desert settlement': [164, 76, -375],
    'desert mountain': [241, 96, -411],
    'mushroom desert': [193, 66, -468],
    'mushroom gorge': [308, 52, -454],
    'glowing mushroom cave': [190, 42, -494],
    oasis: [127, 64, -427],
    'overgrown mushroom cave': [242, 56, -401],
};
const TRAVEL_MODES = ['Pathfind', 'AOTE', 'AOTE delayed'];
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
    'desert mountain': parseAOTERoute('175 2 180 19 -90 2 -30 -10 90 -90 90 -90 90 -90 90 -90 90 -90 52 0 52 0 52 0 52 0 52 0 52 0 5 0 20 75'),
    'desert settlement': parseAOTERoute(
        '175 2 180 19 -90 2 -30 -10 0 -12 0 -12 0 -12 0 -12 0 -12 0 -12 0 -12 0 -12 0 22 0 22 0 22 0 22 0 22 90 22 90 22 90 22 90 22 90 22 90 22 90 22 90 22 90 22 35 0 35 45 35 45 35 45'
    ),
    oasis: parseAOTERoute('175 2 180 19 -90 2 145 5 145 5 145 5 90 0 90 0 90 0 90 0 90 0 18 18 18 18 18 0 35 0 35 0 35 35 35 35 15 -20'),
    'glowing mushroom cave': parseAOTERoute(
        '175 2 180 19 -90 2 -30 -10 -30 -10 -30 -10 0 0 90 90 90 90 90 90 90 90 90 90 132 0 132 0 132 0 100 30 100 30 130 20 130 20 80 0 90 10 35 0 35 0 35 0'
    ),
    'overgrown mushroom cave': parseAOTERoute(
        '175 2 180 19 -90 2 -30 -10 -30 -10 -30 -10 0 0 90 90 90 90 90 90 90 90 90 90 44 -2 44 -2 44 12 44 12 44 12 50 0 50 0 0 20 -15 -10 -15 -10 23 10 23 10 23 10 0 20 0 20'
    ),
    'mushroom gorge': parseAOTERoute('175 2 180 19 -90 2 -30 -10 -30 -10 -30 -10 10 30 10 30 0 30 0 60 0 60'),
};
const PELT_NAMES = new Set(['Cow', 'Pig', 'Sheep', 'Chicken', 'Rabbit', 'Horse', 'Mooshroom', 'Dinnerbone']);
const PELT_HP = new Set([100, 200, 500, 1000, 2000, 5000, 10000, 1024, 20000, 30000, 60000]);
const MOB_REACHED_DISTANCE = 5;
const MOB_KILL_TIMEOUT_MS = 30000;
const SHOOT_COOLDOWN_MS = 250;
const AIM_TOLERANCE = 5;
const MAX_STATIONARY_SHOTS = 3;
const MOB_REPOSITION_MS = 1000;
const MOB_PATH_RETRY_MS = 100;
const MOB_VISIBILITY_PADDING = 0.25;
const MOB_VISIBILITY_SAMPLE_OFFSETS = [0, 0.5, 1];

class PeltMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Pelt Macro',
            subcategory: 'Farming',
            description: 'Pathfinds to Trevor hunt coordinates from chat.',
            isMacro: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();
        this.setTheme('#d99a3e');
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
            if (!target) return;
            if (this.tryHandlePeltMob(true)) return;
            this.startTravelToTarget(target);
        });
    }

    onEnable() {
        PeltQOLModule.ensureForceEnabled();
        Mouse.ungrab();
        this.status = 'Calling Trevor';
        this.resetMobTracking();
        this.lastShotAt = 0;
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        ChatLib.command('call trevor');
    }

    handleTick() {
        PeltQOLModule.ensureForceEnabled();
        const areaName = Utils.area();
        const inFarmingIslands = areaName === 'The Farming Islands';
        this.syncMobJumpHold(this.enabled && inFarmingIslands && this.shouldHoldMobJump());
        if (!this.enabled || !areaName) return;
        if (!inFarmingIslands) {
            this.restartTrevorHunt(`&eDetected area &f${areaName}&e outside of &fThe Farming Islands&e. Restarting Trevor hunt.`);
            return;
        }
        if (this.handleTravelTick()) return;
        if (this.checkMobTimeout()) return;
        this.tryHandlePeltMob(false);
    }

    getTrevorTarget(message) {
        const text = this.getMessageText(message);
        const match = text.match(/\[npc\]\s*trevor:.*?near the (.+?)\.\s*$/i);
        if (!match) return null;
        const name = match[1].trim().toLowerCase();
        const coords = TREVOR_TARGETS[name];
        if (!coords) return null;
        return { name, coords };
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
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        this.stopMovement();
        this.resetMobTracking();
        this.lastShotAt = 0;
        if (!this.isAOTETravelMode()) return;

        const slot = this.getAOTESlot();
        if (slot === -1) {
            this.message('&cNo Aspect of the Void/End in hotbar. Falling back to pathing.');
            return;
        }

        Guis.setItemSlot(slot);
        if (this.isAtTrapWarpPosition()) return;

        this.status = 'Warping to Trap';
        ChatLib.command('warp trap');
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

    resetMobTracking() {
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
        Pathfinder.resetPath();
        PathExecutor.destroy();
    }

    stopMovement() {
        this.stopPathing();
        Rotations.stopRotation();
    }

    prepareForTravel() {
        this.cancelRestartSequence();
        this.cancelTravelSequence();
        this.resetMobTracking();
    }

    getAOTESlot() {
        const aotvSlot = Guis.findItemInHotbar('Aspect of the Void');
        return aotvSlot !== -1 ? aotvSlot : Guis.findItemInHotbar('Aspect of the End');
    }

    isAOTETravelMode(mode = this.travelMode) {
        return mode === 'AOTE' || mode === 'AOTE delayed';
    }

    isDelayedAOTETravelMode(mode = this.travelMode) {
        return mode === 'AOTE delayed';
    }

    startTravelToTarget(target) {
        if (this.shouldUseAOTETravel(target.name)) return this.startAOTETravel(target);
        this.startAreaPath(target);
    }

    startAreaPath(target) {
        this.prepareForTravel();
        const [x, y, z] = target.coords;
        this.mobTrackedAt = Date.now();
        this.status = `Area ${x}, ${y}, ${z}`;
        Pathfinder.resetPath();
        Pathfinder.findPath([[x, y, z]]);
    }

    shouldUseAOTETravel(areaName) {
        return this.isAOTETravelMode() && !!AOTE_ROUTES[areaName]?.length;
    }

    startAOTETravel(target) {
        this.prepareForTravel();
        this.mobTrackedAt = Date.now();
        this.stopMovement();
        const atTrapWarp = this.isAtTrapWarpPosition();
        const slot = this.getAOTESlot();
        if (slot === -1) {
            this.message('&cNo Aspect of the Void/End in hotbar. Falling back to pathing.');
            this.startAreaPath(target);
            return;
        }

        this.travelState = {
            areaName: target.name,
            coords: target.coords,
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

        const mode = this.travelMode;
        const delayed = this.isDelayedAOTETravelMode(mode);
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

        if (!delayed) {
            Client.scheduleTask(1, () => {
                for (let index = 0; index < directions.length; index++) {
                    sendPacket(directions[index], index === directions.length - 1);
                }
            });
            return true;
        }

        for (let index = 0; index < directions.length; index++) {
            const direction = directions[index];
            const isLast = index === directions.length - 1;
            ScheduleTask(index + 1, () => sendPacket(direction, isLast));
        }

        return true;
    }

    fallbackToAreaPath(target) {
        this.cancelTravelSequence();
        this.startAreaPath(target);
        return true;
    }

    handleWarpPhase() {
        if (this.isAtTrapWarpPosition()) {
            this.status = `AOTEing ${this.travelState.areaName}`;
            const route = AOTE_ROUTES[this.travelState.areaName];
            if (!this.sendAOTEPackets(route)) {
                return this.fallbackToAreaPath(this.travelState);
            }

            this.travelState.phase = 'settle';
            return true;
        }

        this.status = 'Waiting for /warp trap';
        if (Date.now() - this.travelState.startedAt <= 5000) return true;
        return this.fallbackToAreaPath(this.travelState);
    }

    handleSettlePhase() {
        if (!this.travelState.routeCompletedAt) return true;
        if (Date.now() - this.travelState.routeCompletedAt < 500) return true;
        return this.fallbackToAreaPath(this.travelState);
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

    trackCurrentMob(mobId) {
        if (this.currentMobId !== mobId) {
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
        if (Date.now() - this.mobTrackedAt < MOB_KILL_TIMEOUT_MS) return false;

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
            ChatLib.command(normalized);
        });
    }

    restartTrevorHunt(reason = null) {
        if (this.restartActive) return;

        this.restartActive = true;
        this.restartToken++;
        const token = this.restartToken;

        this.stopMovement();
        this.cancelTravelSequence();
        this.resetMobTracking();
        this.lastShotAt = 0;
        this.status = 'Restarting Hunt';

        this.queueCommand('warp hub', 0, token);
        this.queueCommand('warp trapper', 70, token);
        this.queueCommand('call trevor', 80, token);
    }

    startMobPath(mob, mobId, distance) {
        const x = Math.floor(mob.getX());
        const y = Math.floor(mob.getY());
        const z = Math.floor(mob.getZ());

        this.currentMobId = mobId;
        this.lastMobPathAt = Date.now();
        this.mobPathActive = true;
        const token = ++this.mobPathToken;
        this.status = `Mob ${Math.round(distance)}m`;

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
        if (this.mobPathActive || Pathfinder.isPathing()) this.stopPathing();
        return false;
    }

    handleVisibleMob(entity) {
        if (Pathfinder.isPathing()) {
            this.stopPathing();
        }

        this.status = 'Shooting Mob';
        const aimPoint = this.getAimPoint(entity);
        Guis.setItemSlot(this.weaponSlot);
        Rotations.rotateToVector(aimPoint, true);

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
        this.syncMobJumpHold(false);
        this.cancelTravelSequence();
        this.cancelRestartSequence();
        this.resetMobTracking();
        this.stopMovement();
        Mouse.regrab();
    }
}

new PeltMacro();
