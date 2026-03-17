import { Chat } from '../../utils/Chat';
import { ArmorStandEntity, EndermanEntity, Vec3d, ZombieEntity } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Raytrace } from '../../utils/Raytrace';
import Render from '../../utils/render/Render';

const BLACKHOLE_TEXTURES = new Set([
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg2Nzc3MywKICAicHJvZmlsZUlkIiA6ICJjNmViMzdjNmE4YjM0MDI3OGJjN2FmZGE3ZjMxOWJmMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJFbFJleUNhbGFiYXphbCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS81NWI3MGYwOTRlMDE2Nzk1MDhkZDViY2EzOTY0MGVkOWVjNWM2YzY3OTJmYmQ4ZjU3YzAzYjNhMTJmOWMwYTkyIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg1MjkxMCwKICAicHJvZmlsZUlkIiA6ICI5OWY1MzhjMDhlN2E0NTg3YmU4MGJjNGVmNzU0ZmQyMSIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb2xvV1MyIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Q2MWI4N2YxYTEwNDBhOGI5MjJjYTUxYmU5YzBiYzZkNmZjNzFiYTVkNzQ1YzZiZjY1OWNiZDBkOWE5Y2Y0ZmMiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTQ3NjI5MiwKICAicHJvZmlsZUlkIiA6ICI0YWY1YmQ3NTdmZDE0MWEwOTczYmUxNTFkZWRjNmM5ZiIsCiAgInByb2ZpbGVOYW1lIiA6ICJjcmFzaGludG95b3VybW9tIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzhkMzQ1NmUyZDkwZjQxMmM1NzA5MjViNTI4YmI1YTNlNGUxZTZhM2YyNGVmODIwYTZiMWNlNDJhYzhlMDA2MDIiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTcxODMwNSwKICAicHJvZmlsZUlkIiA6ICI4NzczZWRiODZmYWQ0MTczOGFiYWJhNTUxMWM3MDcwZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJjb3NtaWNwb3RhdG9lcyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9mNDM4YzZiYzUwMTk4NWNiYTA3OTZkODE3OTcxZTY4Njc5M2JlMDhiZTQyYjUzODVkN2QwYjkzZDg4MTUyMDE5IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTY5MzM4NCwKICAicHJvZmlsZUlkIiA6ICIzZmM3ZmRmOTM5NjM0YzQxOTExOTliYTNmN2NjM2ZlZCIsCiAgInByb2ZpbGVOYW1lIiA6ICJZZWxlaGEiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTI5MDc4MTM3ZWEwOTcxOTQ0YzM3NzQxODY3MTcyNjE2NmI3NTFiZDgzOTVlNDcxNDYwMTk1MjJjNzU3ODIyOSIsCiAgICAgICJtZXRhZGF0YSIgOiB7CiAgICAgICAgIm1vZGVsIiA6ICJzbGltIgogICAgICB9CiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTc0NTg5NCwKICAicHJvZmlsZUlkIiA6ICJmYjZkM2E5Zjk3MWY0ZTdlYmQ0MjE2Yjk0MjE5NDA3NCIsCiAgInByb2ZpbGVOYW1lIiA6ICJtYXJjaXhkZCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9jYjgzMmZjOTdkMzhjY2NhOGJkMTE4YmZiZGEyZmE1N2M1MjA4ZTFmYmJkNmI4ZWE0MjhmNzBjN2NhMTY1NmY0IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
]);

const BLACKHOLE_AVOID_RADIUS = 8.5;
const ATTACK_REACH = 4;
const BLACKHOLE_SCAN_INTERVAL = 10;
const BLACKHOLE_SCAN_RADIUS = 30;
const BLACKHOLE_SCAN_Y_RANGE = 20;
const BLACKHOLE_MEMORY_MS = 60000;
const BLACKHOLE_FORGET_CHECK_RADIUS = 20;
const BLACKHOLE_MERGE_RADIUS = 2.5;

const SEARCH_TARGET_TIMEOUT_MS = 15000;
const TARGET_BLACKLIST_MS = 10000;

const COMBAT_STATE = {
    IDLE: 'IDLE',
    PATHING: 'PATHING',
    APPROACHING: 'APPROACHING',
    ATTACKING: 'ATTACKING',
};

const COMBAT_PRESETS = {
    Graveyard: {
        entityClass: ZombieEntity,
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y >= 60 && y <= 100 && x <= -72,
    },
    Endermen: {
        entityClass: EndermanEntity,
        checkVisibility: true,
        boundaryCheck: () => true,
    },
    Goblins: {
        names: ['Goblin', 'Weakling', 'Knifethrower', 'Fireslinger'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y > 127 && !(z > 153 && x < -157) && !(z < 148 && x > -77),
    },
    'Ice Walkers': {
        names: ['Ice Walker', 'Glacite Walker'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y >= 127 && y <= 145 && z <= 180 && z >= 130 && x <= 80,
    },
};

class Combat extends ModuleBase {
    constructor() {
        super({
            name: 'Combat Bot',
            subcategory: 'Combat',
            description: 'Universal settings for combat bot',
            tooltip: 'Combat bot settings',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();
        this.setTheme('#c74d4d');

        this.enabledPresets = new Set();
        this.customTargetNames = [];
        this.externalTargets = null;

        this.target = null;
        this.targets = [];
        this.blacklistedTargets = new Map();
        this.failedPathCallbacks = new Map();

        this.activeBlackholes = [];
        this.scanTicker = 0;

        this.combatState = COMBAT_STATE.IDLE;
        this.attackRange = ATTACK_REACH;
        this.pathfindingThreshold = 15;
        this.attackCPS = 10;

        this.lastAttackTime = 0;
        this.isPathing = false;
        this.lastPathTarget = null;
        this.pathTargetMoveThreshold = 3;
        this.currentPathStartTime = 0;
        this.targetStickinessRange = 10;
        this.recentVisibility = new Map();
        this.visibilityGraceMs = 1200;
        this.visibilityGraceDistance = 6;
        this.mobMemory = [];
        this.mobMemoryMax = 8;
        this.mobMemoryExpiryMs = 120000;
        this.searchTarget = null;
        this.searchTargetSetTime = 0;
        this.pathRequestToken = 0;

        this.addMultiToggle(
            'Target Presets',
            Object.keys(COMBAT_PRESETS),
            false,
            (selected) => {
                this.enabledPresets.clear();
                const isEnabled = (name) => selected.some((item) => item.name === name && item.enabled === true);
                Object.keys(COMBAT_PRESETS).forEach((presetName) => {
                    if (isEnabled(presetName)) this.enabledPresets.add(presetName);
                });
            },
            'Select which mob types to target when running standalone'
        );

        this.addTextInput(
            'Custom Target Names',
            '',
            (value) => {
                this.customTargetNames = value
                    .split(',')
                    .map((n) => n.trim())
                    .filter((n) => n.length > 0);
            },
            'Enter mob names to target, comma separated. (e.g. "Zombie, Skeleton")'
        );

        this.addSlider(
            'Pathfinding Threshold',
            5,
            30,
            15,
            (value) => {
                this.pathfindingThreshold = value;
            },
            'Distance to use pathfinding vs direct walking'
        );

        this.addSlider(
            'Attack CPS',
            5,
            15,
            10,
            (value) => {
                this.attackCPS = value;
            },
            'Attacks per second'
        );

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.combatState,
                    Target: () => this.getTargetDisplayName(this.target),
                    'Targets Found': () => (this.targets ? this.targets.length : 0),
                    'Known Blackholes': () => this.activeBlackholes.length,
                },
            },
        ]);

        this.on('postRenderWorld', () => this.renderTargets());
        this.on('tick', () => this.onTick());
    }

    renderTargets() {
        if (!this.targets || this.targets.length === 0) return;

        if (this.target) {
            const targetUuid = this.getTargetUuid(this.target);
            if (!targetUuid || !this.blacklistedTargets.has(targetUuid)) {
                const pos = this.getTargetPosition(this.target);
                if (pos && this.isPositionSafe(pos.x, pos.y, pos.z)) {
                    const entity = this.target.toMC ? this.target.toMC() : this.target;
                    Render.drawHitbox(entity, Render.Color(255, 0, 0, 100), 7, false);
                }
            }
        }

        this.targets.forEach((target) => {
            if (target === this.target) return;
            const targetUuid = this.getTargetUuid(target);
            if (targetUuid && this.blacklistedTargets.has(targetUuid)) return;

            const pos = this.getTargetPosition(target);
            if (pos && !this.isPositionSafe(pos.x, pos.y, pos.z)) return;

            const entity = target.toMC ? target.toMC() : target;
            Render.drawHitbox(entity, Render.Color(0, 70, 200, 100), 3, false);
        });

        if (this.activeBlackholes.length > 0) {
            this.activeBlackholes.forEach((bh) => {
                Render.drawBox(new Vec3d(bh.x - 0.5, bh.y + 0.5, bh.z - 0.5), Render.Color(0, 0, 0, 150), false);
            });
        }
    }

    onTick() {
        if (!this.enabled) return;
        if (!Client.isInChat() && Client.isInGui()) return;

        try {
            this.scanBlackholes();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        const now = Date.now();
        this.expireBlacklistedTargets(now);

        this.pruneVisibilityHistory(now);
        this.pruneMobMemory(now);

        this.targets = this.getTargets();
        if (this.target && this.isTargetInvalid(this.target)) {
            this.stopCombat();
            return;
        }

        const previousTarget = this.target;
        if (!this.target) this.target = this.bestTarget();
        if (!this.target) {
            if (this.trySearch()) return;
            this.setState(COMBAT_STATE.IDLE);
            return;
        }

        if (this.searchTarget) this.cancelSearchTarget();

        const pos = this.getTargetPosition(this.target);
        if (!pos) return;

        const distanceData = this.getDistanceToPlayer(pos);
        const targetChanged = previousTarget !== this.target;
        if (targetChanged && this.combatState !== COMBAT_STATE.PATHING) {
            this.setState(COMBAT_STATE.IDLE);
        }

        this.handleState(pos, distanceData);
    }

    getTargetDisplayName(target) {
        if (!target) return 'None';
        if (target.getName) return ChatLib.removeFormatting(target.getName());
        return target.name || 'Unknown';
    }

    expireBlacklistedTargets(now = Date.now()) {
        for (const [uuid, expiry] of this.blacklistedTargets.entries()) {
            if (now > expiry) this.blacklistedTargets.delete(uuid);
        }
    }

    scanBlackholes() {
        this.scanTicker = (this.scanTicker || 0) + 1;
        if (this.scanTicker % BLACKHOLE_SCAN_INTERVAL !== 0) return;

        const stands = World.getAllEntitiesOfType(ArmorStandEntity);
        const visibleBlackholes = [];
        const playerX = Player.getX();
        const playerY = Player.getY();
        const playerZ = Player.getZ();

        for (const stand of stands || []) {
            try {
                const dx = stand.getX() - playerX;
                const dy = stand.getY() - playerY;
                const dz = stand.getZ() - playerZ;
                if (Math.abs(dx) > BLACKHOLE_SCAN_RADIUS || Math.abs(dz) > BLACKHOLE_SCAN_RADIUS || Math.abs(dy) > BLACKHOLE_SCAN_Y_RANGE) continue;

                const headItem = stand.getStackInSlot(5);
                if (!headItem) continue;

                if (this.isBlackholeHead(headItem)) {
                    visibleBlackholes.push({ x: stand.getX(), y: stand.getY(), z: stand.getZ() });
                }
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        const now = Date.now();

        visibleBlackholes.forEach((pos) => {
            const existing = this.activeBlackholes.find((bh) => this.getDistanceBetween(bh, pos).distanceFlat <= BLACKHOLE_MERGE_RADIUS);
            if (existing) {
                existing.x = pos.x;
                existing.y = pos.y;
                existing.z = pos.z;
                existing.lastSeen = now;
                return;
            }
            this.activeBlackholes.push({ x: pos.x, y: pos.y, z: pos.z, lastSeen: now });
        });

        this.activeBlackholes = this.activeBlackholes.filter((bh) => {
            const age = now - (bh.lastSeen || 0);
            if (age <= BLACKHOLE_MEMORY_MS) return true;

            const distance = this.getDistanceBetween({ x: playerX, y: playerY, z: playerZ }, bh);
            return distance.distanceFlat > BLACKHOLE_FORGET_CHECK_RADIUS;
        });
    }

    isBlackholeHead(item) {
        try {
            const mcItem = item?.toMC ? item.toMC() : item;
            if (!mcItem) return false;

            const profileType = net.minecraft.component.DataComponentTypes.PROFILE;
            const profileComponent = mcItem.get(profileType);
            const profileString = profileComponent?.getGameProfile?.()?.toString() || '';
            if (!profileString) return false;

            for (const base64 of BLACKHOLE_TEXTURES) {
                if (profileString.includes(base64)) return true;
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
        return false;
    }

    isPositionSafe(x, y, z) {
        if (!this.activeBlackholes || this.activeBlackholes.length === 0) return true;

        for (const bh of this.activeBlackholes) {
            const distanceData = this.getDistanceBetween({ x, y, z }, bh);
            if (distanceData.distanceFlat < BLACKHOLE_AVOID_RADIUS) return false;
        }
        return true;
    }

    recordVisibility(entity) {
        const uuid = this.getTargetUuid(entity);
        if (!uuid) return;
        const pos = this.getTargetPosition(entity);
        if (!pos) return;
        this.recentVisibility.set(uuid, { x: pos.x, y: pos.y, z: pos.z, time: Date.now() });
    }

    pruneVisibilityHistory(now = Date.now()) {
        for (const [uuid, record] of this.recentVisibility.entries()) {
            if (now - record.time > this.visibilityGraceMs) this.recentVisibility.delete(uuid);
        }
    }

    isVisibleOrRecent(entity, checkVisibility) {
        if (!checkVisibility) return true;
        const playerMP = Player.asPlayerMP();
        if (!playerMP) return true;

        let visible = false;
        try {
            visible = playerMP.canSeeEntity(entity);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return true;
        }

        if (visible) {
            this.recordVisibility(entity);
            return true;
        }

        const uuid = this.getTargetUuid(entity);
        if (!uuid) return false;

        const record = this.recentVisibility.get(uuid);
        if (!record) return false;
        if (Date.now() - record.time > this.visibilityGraceMs) return false;

        const pos = this.getTargetPosition(entity);
        if (!pos) return false;

        const distanceData = this.getDistanceBetween(pos, record);
        return distanceData.distance <= this.visibilityGraceDistance;
    }

    rememberMobPosition(pos) {
        if (!pos) return;
        const now = Date.now();
        this.pruneMobMemory(now);

        const existing = this.mobMemory.find((m) => this.getDistanceBetween(m, pos).distance < 3);
        if (existing) {
            existing.time = now;
            return;
        }

        this.mobMemory.push({ x: pos.x, y: pos.y, z: pos.z, time: now });
        if (this.mobMemory.length > this.mobMemoryMax) this.mobMemory.shift();
    }

    getForwardVector() {
        try {
            const yaw = Player.getYaw();
            const rad = (yaw * Math.PI) / 180;
            return { x: -Math.sin(rad), z: Math.cos(rad) };
        } catch (e) {
            return { x: 0, z: 1 };
        }
    }

    pruneMobMemory(now = Date.now()) {
        if (!this.mobMemory || this.mobMemory.length === 0) return;
        this.mobMemory = this.mobMemory.filter((m) => now - m.time <= this.mobMemoryExpiryMs);
    }

    pickSearchTarget() {
        if (!this.mobMemory || this.mobMemory.length === 0) return null;

        const forward = this.getForwardVector();
        const px = Player.getX();
        const pz = Player.getZ();
        let best = null;
        let bestScore = Infinity;

        this.mobMemory.forEach((m) => {
            const dx = m.x - px;
            const dz = m.z - pz;
            const dist = this.getDistanceToPlayer(m).distanceFlat;
            const dirDot = dist > 0 ? (dx * forward.x + dz * forward.z) / dist : 1;
            const score = dist - dirDot * 6;
            if (score < bestScore) {
                bestScore = score;
                best = m;
            }
        });

        return best ? { x: best.x, y: best.y, z: best.z } : null;
    }

    clearSearchTarget(pos) {
        if (pos) {
            this.mobMemory = this.mobMemory.filter((m) => this.getDistanceBetween(m, pos).distance > 3);
        }
        this.cancelSearchTarget();
        if (!this.target) this.setState(COMBAT_STATE.IDLE);
    }

    cancelSearchTarget() {
        this.searchTarget = null;
        this.searchTargetSetTime = 0;
    }

    trySearch() {
        this.pruneMobMemory();
        if (!this.mobMemory || this.mobMemory.length === 0) return false;

        if (this.searchTarget) {
            const distanceData = this.getDistanceToPlayer(this.searchTarget);
            const timedOut = Date.now() - this.searchTargetSetTime > SEARCH_TARGET_TIMEOUT_MS;
            if (distanceData.distance <= 2.5 || timedOut) this.clearSearchTarget(this.searchTarget);
        }

        if (!this.searchTarget && (!this.mobMemory || this.mobMemory.length === 0)) return false;

        if (!this.searchTarget) {
            const next = this.pickSearchTarget();
            if (!next) return false;
            this.searchTarget = next;
            this.searchTargetSetTime = Date.now();
        }

        if (!this.isPathing || this.combatState !== COMBAT_STATE.PATHING) {
            this.startPathingToSearch(this.searchTarget);
        }

        return true;
    }

    startPathingToSearch(pos) {
        if (!pos) return;
        if (!this.isPositionSafe(pos.x, pos.y, pos.z)) {
            this.clearSearchTarget(pos);
            return;
        }

        const end = this.buildPathEndpoints(pos);
        this.lastPathTarget = { x: pos.x, y: pos.y, z: pos.z };
        this.isPathing = true;
        this.setState(COMBAT_STATE.PATHING);
        this.currentPathStartTime = Date.now();
        const pathToken = ++this.pathRequestToken;

        Pathfinder.resetPath();
        Pathfinder.findPath(end, (success) => {
            if (pathToken !== this.pathRequestToken) return;

            if (!success) {
                this.clearSearchTarget(pos);
                return;
            }

            this.clearSearchTarget(pos);
        });
    }

    startRotationToTarget() {
        if (!this.target) return;
        Rotations.rotateToEntity(this.target);
    }

    isAimingAtTarget() {
        if (!this.target) return false;
        try {
            return Raytrace.isLookingAtEntity(this.target, this.attackRange + 0.5);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
    }

    stopCombat() {
        this.target = null;
        this.setState(COMBAT_STATE.IDLE, true);
    }

    setState(state, force = false) {
        if (!force && this.combatState === state) return;
        this.onExitState(this.combatState);
        this.combatState = state;
        this.onEnterState(state);
    }

    onExitState(state) {
        switch (state) {
            case COMBAT_STATE.PATHING:
                Pathfinder.resetPath();
                this.isPathing = false;
                break;
            case COMBAT_STATE.APPROACHING:
            case COMBAT_STATE.ATTACKING:
                Keybind.stopMovement();
                break;
        }
    }

    onEnterState(state) {
        switch (state) {
            case COMBAT_STATE.IDLE:
            case COMBAT_STATE.PATHING:
                Keybind.stopMovement();
                Rotations.stopRotation();
                break;
            case COMBAT_STATE.APPROACHING:
                Pathfinder.resetPath();
                this.isPathing = false;
                break;
            case COMBAT_STATE.ATTACKING:
                Pathfinder.resetPath();
                this.isPathing = false;
                Keybind.stopMovement();
                break;
        }
    }

    handleState(pos, distanceData) {
        switch (this.combatState) {
            case COMBAT_STATE.IDLE:
                return this.handleIdleState(pos, distanceData);
            case COMBAT_STATE.PATHING:
                return this.handlePathingState(pos, distanceData);
            case COMBAT_STATE.APPROACHING:
                return this.handleApproachingState(pos, distanceData);
            case COMBAT_STATE.ATTACKING:
                return this.handleAttackingState(pos, distanceData);
        }
    }

    handleIdleState(pos, distanceData) {
        if (distanceData.distance > this.pathfindingThreshold) return this.startPathingToTarget(pos);
        if (distanceData.distance > this.attackRange) return this.setState(COMBAT_STATE.APPROACHING);
        this.setState(COMBAT_STATE.ATTACKING);
    }

    handlePathingState(pos, distanceData) {
        if (this.lastPathTarget) {
            const targetMoved = this.getDistanceBetween(pos, this.lastPathTarget);
            if (targetMoved.distance > this.pathTargetMoveThreshold) {
                this.startPathingToTarget(pos);
                return;
            }
        }

        if (distanceData.distance <= this.attackRange) {
            this.setState(COMBAT_STATE.ATTACKING);
        }
    }

    handleApproachingState(pos, distanceData) {
        if (distanceData.distance <= this.attackRange) {
            this.setState(COMBAT_STATE.ATTACKING);
            return;
        }

        if (distanceData.distance > this.pathfindingThreshold) {
            this.startPathingToTarget(pos);
            return;
        }

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z, true, true);
        Keybind.setKey('sprint', true);
        this.startRotationToTarget();
    }

    handleAttackingState(pos, distanceData) {
        if (distanceData.distance > this.pathfindingThreshold) {
            this.startPathingToTarget(pos);
            return;
        }

        if (distanceData.distance > this.attackRange * 1.5) {
            this.setState(COMBAT_STATE.APPROACHING);
            return;
        }

        if (distanceData) this.tryAttack();
        this.startRotationToTarget();

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z, true, true);
        if (distanceData.distanceFlat <= 2) Keybind.stopMovement();
        if (distanceData.distanceY < -3) {
            Keybind.setKey('space', true);
        }
        Keybind.setKey('sprint', true);
    }

    startPathingToTarget(pos) {
        if (!this.isPositionSafe(pos.x, pos.y, pos.z)) {
            Chat.message('&cTarget is inside a Blackhole! Aborting path.');
            this.blacklistTarget(this.target, TARGET_BLACKLIST_MS);
            this.target = null;
            this.setState(COMBAT_STATE.IDLE);
            return;
        }

        const end = this.buildPathEndpoints(pos);

        this.lastPathTarget = { x: pos.x, y: pos.y, z: pos.z };
        this.isPathing = true;
        this.setState(COMBAT_STATE.PATHING);
        this.currentPathStartTime = Date.now();
        const pathToken = ++this.pathRequestToken;

        const pathTarget = this.target;
        const pathTargetUuid = this.getTargetUuid(pathTarget);

        Pathfinder.resetPath();
        Pathfinder.findPath(end, (success) => {
            if (pathToken !== this.pathRequestToken) return;

            if (!success) {
                if (pathTarget && this.recordFailedPathCallback(pathTarget)) {
                    this.target = null;
                    this.setState(COMBAT_STATE.IDLE);
                    return;
                }
                this.setState(COMBAT_STATE.APPROACHING);
                return;
            }

            if (pathTargetUuid) this.failedPathCallbacks.delete(pathTargetUuid);

            if (this.target && !this.isTargetInvalid(this.target)) {
                const currentPos = this.getTargetPosition(this.target);
                const distanceData = currentPos ? this.getDistanceToPlayer(currentPos) : null;
                this.setState((distanceData?.distance ?? Infinity) <= this.attackRange ? COMBAT_STATE.ATTACKING : COMBAT_STATE.APPROACHING);
            } else {
                this.setState(COMBAT_STATE.IDLE);
            }
        });
    }

    buildPathEndpoints(pos) {
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        const z = Math.floor(pos.z);
        return [
            [x, y - 1, z],
            [x, y, z],
            [x, y + 1, z],
        ];
    }

    getTargetUuid(target) {
        try {
            if (!target) return null;
            if (target.getUUID) return target.getUUID().toString();
            if (target.toMC && target.toMC().getUuid) return target.toMC().getUuid().toString();
            return null;
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return null;
        }
    }

    blacklistTarget(target, duration) {
        const uuid = this.getTargetUuid(target);
        if (!uuid) return;
        this.blacklistedTargets.set(uuid, Date.now() + duration);
    }

    recordFailedPathCallback(target) {
        const uuid = this.getTargetUuid(target);
        if (!uuid) return false;

        const failures = (this.failedPathCallbacks.get(uuid) || 0) + 1;
        this.failedPathCallbacks.set(uuid, failures);

        if (failures > 2) {
            Chat.message('&cTarget path failed too many times. Blacklisting target for 10s.');
            this.blacklistTarget(target, TARGET_BLACKLIST_MS);
            this.failedPathCallbacks.delete(uuid);
            return true;
        }

        return false;
    }

    tryAttack() {
        const now = Date.now();
        const cooldown = 1000 / this.attackCPS;
        if (now - this.lastAttackTime < cooldown) return;
        Keybind.leftClick();
        this.lastAttackTime = now;
    }

    isTargetInvalid(target) {
        try {
            const entity = target.toMC ? target.toMC() : target;
            if (entity.isDead()) {
                if (this.target && target === this.target) {
                    const pos = this.getTargetPosition(target);
                    if (pos) this.rememberMobPosition(pos);
                }
                return true;
            }

            const targetUUID = this.getTargetUuid(target);
            if (targetUUID && this.blacklistedTargets.has(targetUUID)) return true;

            const pos = this.getTargetPosition(target);
            if (pos && !this.isPositionSafe(pos.x, pos.y, pos.z)) return true;

            if (!targetUUID) return !this.targets.includes(target);

            return !this.targets.some((t) => this.getTargetUuid(t) === targetUUID);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return true;
        }
    }

    getDistanceToPlayer(pos) {
        return MathUtils.getDistanceToPlayer(pos.x, pos.y, pos.z);
    }

    getDistanceBetween(pos1, pos2) {
        return MathUtils.getDistance(pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z);
    }

    detectTargets() {
        if (this.enabledPresets.size === 0 && (!this.customTargetNames || this.customTargetNames.length === 0)) return [];

        const mobs = [];

        const addMobIfSafe = (entity) => {
            const x = entity.getX();
            const y = entity.getY();
            const z = entity.getZ();
            if (this.isPositionSafe(x, y, z)) mobs.push(entity);
        };

        this.enabledPresets.forEach((presetName) => {
            const config = COMBAT_PRESETS[presetName];
            if (!config) return;

            if (config.entityClass) {
                World.getAllEntitiesOfType(config.entityClass).forEach((entity) => {
                    try {
                        if (entity.isDead()) return;
                        const x = entity.getX();
                        const y = entity.getY();
                        const z = entity.getZ();
                        if (!config.boundaryCheck(x, y, z)) return;
                        if (!this.isVisibleOrRecent(entity, config.checkVisibility)) return;
                        addMobIfSafe(entity);
                    } catch (e) {
                        console.error('V5 Caught error' + e + e.stack);
                    }
                });
                return;
            }

            if (config.names) this.findMob(config).forEach(addMobIfSafe);
        });

        if (this.customTargetNames && this.customTargetNames.length > 0) {
            const customConfig = {
                names: this.customTargetNames,
                checkVisibility: true,
                boundaryCheck: () => true,
            };
            this.findMob(customConfig).forEach(addMobIfSafe);
        }

        return mobs;
    }

    getTargets() {
        if (this.externalTargets !== null) return this.externalTargets;
        if (this.isParentManaged) return [];
        return this.detectTargets();
    }

    setExternalTargets(targets) {
        this.externalTargets = Array.isArray(targets) ? targets : [];
    }

    clearExternalTargets() {
        this.externalTargets = null;
    }

    getTargetPosition(target) {
        if (!target) return null;

        try {
            if (typeof target.getX === 'function') return { x: target.getX(), y: target.getY(), z: target.getZ() };
            if (typeof target.x === 'number' && typeof target.y === 'number' && typeof target.z === 'number') {
                return { x: target.x, y: target.y, z: target.z };
            }
            const entity = target.toMC ? target.toMC() : target;
            if (entity && typeof entity.getX === 'function') return { x: entity.getX(), y: entity.getY(), z: entity.getZ() };
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        return null;
    }

    bestTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        if (this.target && !this.isTargetInvalid(this.target)) {
            const pos = this.getTargetPosition(this.target);
            if (pos && this.getDistanceToPlayer(pos).distance < this.targetStickinessRange) return this.target;
        }

        let lowestCost = Infinity;
        let bestTarget = null;

        this.targets.forEach((target) => {
            if (this.isTargetInvalid(target)) return;
            const pos = this.getTargetPosition(target);
            if (!pos) return;
            if (!this.isPositionSafe(pos.x, pos.y, pos.z)) return;

            const distanceData = this.getDistanceToPlayer(pos);
            const angles = MathUtils.angleToPlayer([pos.x, pos.y, pos.z]);
            const cost = distanceData.distance * 10 + angles.distance * 0.5;

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTarget = target;
            }
        });

        const bestUUID = this.getTargetUuid(bestTarget);
        const currentUUID = this.getTargetUuid(this.target);
        if (bestUUID && bestUUID === currentUUID) return this.target;

        return bestTarget;
    }

    findMob(config, whitelist = null) {
        if (!config || !config.names) {
            console.error('Invalid mob config provided');
            return [];
        }

        const mobs = [];

        World.getAllPlayers().forEach((player) => {
            try {
                const nameObj = player.getName();
                if (!nameObj) return;

                const name = ChatLib.removeFormatting(nameObj);
                const uuid = player.getUUID();
                if (whitelist && whitelist.has(uuid)) return;
                if (!config.names.some((mobName) => name.includes(mobName))) return;
                if (player.isSpectator() || player.isInvisible() || player.isDead()) return;
                if (!this.isVisibleOrRecent(player, config.checkVisibility)) return;

                const x = player.getX();
                const y = player.getY();
                const z = player.getZ();
                if (config.boundaryCheck && !config.boundaryCheck(x, y, z)) return;

                mobs.push(player);
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        });

        return mobs;
    }

    onEnable() {
        if (!this.isParentManaged) this.message('&aEnabled');

        if (this.externalTargets === null) {
            const presets = Array.from(this.enabledPresets).join(', ');
            Chat.message(`&7Targeting: &b${presets || 'None selected'}`);
        }

        this.activeBlackholes = [];
    }

    onDisable() {
        if (!this.isParentManaged) this.message('&cDisabled');

        this.externalTargets = null;
        this.targets = [];
        this.target = null;
        this.setState(COMBAT_STATE.IDLE, true);
        this.lastPathTarget = null;
        this.lastAttackTime = 0;
        this.blacklistedTargets.clear();
        this.failedPathCallbacks.clear();
        this.activeBlackholes = [];
        this.recentVisibility.clear();
        this.mobMemory = [];
        this.searchTarget = null;
        this.searchTargetSetTime = 0;
        this.pathRequestToken = 0;
    }
}

export const CombatBot = new Combat();
