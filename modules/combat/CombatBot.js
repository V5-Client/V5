import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Vec3d, ZombieEntity, EndermanEntity } from '../../utils/Constants';
import RenderUtils from '../../utils/render/RendererUtils';
import { MathUtils } from '../../utils/Math';
import { Rotations } from '../../utils/player/Rotations';
import Pathfinder from '../../utils/Pathfinderrewrtie/PathFinder';
import { Keybind } from '../../utils/player/Keybinding';
import { Raytrace } from '../../utils/Raytrace';

const BLACKHOLE_TEXTURES = new Set([
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg2Nzc3MywKICAicHJvZmlsZUlkIiA6ICJjNmViMzdjNmE4YjM0MDI3OGJjN2FmZGE3ZjMxOWJmMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJFbFJleUNhbGFiYXphbCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS81NWI3MGYwOTRlMDE2Nzk1MDhkZDViY2EzOTY0MGVkOWVjNWM2YzY3OTJmYmQ4ZjU3YzAzYjNhMTJmOWMwYTkyIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg1MjkxMCwKICAicHJvZmlsZUlkIiA6ICI5OWY1MzhjMDhlN2E0NTg3YmU4MGJjNGVmNzU0ZmQyMSIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb2xvV1MyIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Q2MWI4N2YxYTEwNDBhOGI5MjJjYTUxYmU5YzBiYzZkNmZjNzFiYTVkNzQ1YzZiZjY1OWNiZDBkOWE5Y2Y0ZmMiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTQ3NjI5MiwKICAicHJvZmlsZUlkIiA6ICI0YWY1YmQ3NTdmZDE0MWEwOTczYmUxNTFkZWRjNmM5ZiIsCiAgInByb2ZpbGVOYW1lIiA6ICJjcmFzaGludG95b3VybW9tIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzhkMzQ1NmUyZDkwZjQxMmM1NzA5MjViNTI4YmI1YTNlNGUxZTZhM2YyNGVmODIwYTZiMWNlNDJhYzhlMDA2MDIiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTcxODMwNSwKICAicHJvZmlsZUlkIiA6ICI4NzczZWRiODZmYWQ0MTczOGFiYWJhNTUxMWM3MDcwZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJjb3NtaWNwb3RhdG9lcyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9mNDM4YzZiYzUwMTk4NWNiYTA3OTZkODE3OTcxZTY4Njc5M2JlMDhiZTQyYjUzODVkN2QwYjkzZDg4MTUyMDE5IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTY5MzM4NCwKICAicHJvZmlsZUlkIiA6ICIzZmM3ZmRmOTM5NjM0YzQxOTExOTliYTNmN2NjM2ZlZCIsCiAgInByb2ZpbGVOYW1lIiA6ICJZZWxlaGEiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTI5MDc4MTM3ZWEwOTcxOTQ0YzM3NzQxODY3MTcyNjE2NmI3NTFiZDgzOTVlNDcxNDYwMTk1MjJjNzU3ODIyOSIsCiAgICAgICJtZXRhZGF0YSIgOiB7CiAgICAgICAgIm1vZGVsIiA6ICJzbGltIgogICAgICB9CiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTc0NTg5NCwKICAicHJvZmlsZUlkIiA6ICJmYjZkM2E5Zjk3MWY0ZTdlYmQ0MjE2Yjk0MjE5NDA3NCIsCiAgInByb2ZpbGVOYW1lIiA6ICJtYXJjaXhkZCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9jYjgzMmZjOTdkMzhjY2NhOGJkMTE4YmZiZGEyZmE1N2M1MjA4ZTFmYmJkNmI4ZWE0MjhmNzBjN2NhMTY1NmY0IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
]);

const BLACKHOLE_AVOID_RADIUS = 8.5;
const ATTACK_REACH = 3.0;

const COMBAT_PRESETS = {
    Graveyard: {
        entityClass: ZombieEntity,
        checkVisibility: false,
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

        this.combatState = 'IDLE';
        this.attackRange = ATTACK_REACH;
        this.pathfindingThreshold = 15;
        this.attackCPS = 10;
        this.sprintToTarget = true;

        this.lastAttackTime = 0;
        this.isPathing = false;
        this.lastPathTarget = null;
        this.pathTargetMoveThreshold = 3;
        this.currentPathStartTime = 0;
        this.targetStickinessRange = 10;

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

        this.addToggle(
            'Sprint',
            (value) => {
                this.sprintToTarget = value;
            },
            'Sprint when approaching targets',
            true
        );

        const targetName = () =>
            this.target ? (this.target.getName ? ChatLib.removeFormatting(this.target.getName()) : this.target.name || 'Unknown') : 'None';

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.combatState,
                    Target: targetName,
                    'Targets Found': () => (this.targets ? this.targets.length : 0),
                    'Active Zones': () => this.activeBlackholes.length,
                },
            },
        ]);

        this.on('postRenderWorld', () => this.renderTargets());
        this.on('tick', () => this.onTick());
    }

    renderTargets() {
        if (!this.targets || this.targets.length === 0) return;

        if (this.target) {
            const entity = this.target.toMC ? this.target.toMC() : this.target;
            RenderUtils.drawEntityHitbox(entity, [255, 0, 0, 100], 7, false);
        }

        this.targets.forEach((target) => {
            if (target === this.target) return;
            const entity = target.toMC ? target.toMC() : target;
            RenderUtils.drawEntityHitbox(entity, [0, 70, 200, 100], 3, false);
        });

        if (this.shouldUseBlackholeLogic() && this.activeBlackholes.length > 0) {
            this.activeBlackholes.forEach((bh) => {
                RenderUtils.drawBox(new Vec3d(bh.x - 0.5, bh.y + 0.5, bh.z - 0.5), [0, 0, 0, 150], false);
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
        for (const [uuid, expiry] of this.blacklistedTargets.entries()) {
            if (now > expiry) this.blacklistedTargets.delete(uuid);
        }

        this.targets = this.getTargets();
        if (this.target && this.isTargetInvalid(this.target)) {
            this.stopCombat();
            return;
        }

        const previousTarget = this.target;
        if (!this.target) this.target = this.bestTarget();
        if (!this.target) {
            this.setState('IDLE');
            Rotations.stopRotation();
            return;
        }

        const pos = this.getTargetPosition(this.target);
        if (!pos) return;

        const distance = this.getDistanceToPlayer(pos);
        const targetChanged = previousTarget !== this.target;
        if (!this.isPathing && this.combatState !== 'APPROACHING' && (targetChanged || !Rotations.isTrackingEntity(this.target))) {
            this.startRotationToTarget();
        }

        this.handleState(pos, distance);
    }

    shouldUseBlackholeLogic() {
        if (this.enabledPresets.has('Ice Walkers')) return true;
        if (this.customTargetNames && this.customTargetNames.length > 0) {
            const lowerNames = this.customTargetNames.map((n) => n.toLowerCase());
            return lowerNames.some((n) => n.includes('ice') || n.includes('glacite') || n.includes('walker'));
        }
        return false;
    }

    scanBlackholes() {
        if (!this.shouldUseBlackholeLogic()) {
            this.activeBlackholes = [];
            return;
        }

        this.scanTicker = (this.scanTicker || 0) + 1;
        if (this.scanTicker % 10 !== 0) return;

        const stands = World.getAllEntities().filter((e) => e.getClassName().includes('ArmorStand') || e.getName().includes('Armor Stand'));
        if (!stands || stands.length === 0) return;

        const newBlackholes = [];
        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        const SCAN_RADIUS = 30;
        const SCAN_Y_RANGE = 20;

        for (const stand of stands) {
            try {
                const dx = stand.getX() - playerPos[0];
                const dy = stand.getY() - playerPos[1];
                const dz = stand.getZ() - playerPos[2];
                if (Math.abs(dx) > SCAN_RADIUS || Math.abs(dz) > SCAN_RADIUS || Math.abs(dy) > SCAN_Y_RANGE) continue;

                const headItem = stand.getStackInSlot(5);
                if (!headItem) continue;

                const mcItem = headItem.toMC ? headItem.toMC() : headItem;
                const profileType = net.minecraft.component.DataComponentTypes.PROFILE;
                const profileComponent = mcItem?.get(profileType);
                const data = profileComponent?.getGameProfile?.().toString();
                const base64Match = data ? data.match(/value=([A-Za-z0-9+/=]+)/) : null;

                if (base64Match && base64Match[1] && BLACKHOLE_TEXTURES.has(base64Match[1])) {
                    newBlackholes.push({ x: stand.getX(), y: stand.getY(), z: stand.getZ() });
                }
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }

        this.activeBlackholes = newBlackholes;
    }

    isPositionSafe(x, y, z) {
        if (!this.activeBlackholes || this.activeBlackholes.length === 0) return true;
        if (!this.shouldUseBlackholeLogic()) return true;

        const radiusSq = BLACKHOLE_AVOID_RADIUS * BLACKHOLE_AVOID_RADIUS;
        for (const bh of this.activeBlackholes) {
            const dx = x - bh.x;
            const dz = z - bh.z;
            if (dx * dx + dz * dz < radiusSq && Math.abs(y - bh.y) < 10) return false;
        }
        return true;
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
        Pathfinder.resetPath();
        Keybind.stopMovement();
        Rotations.stopRotation();
        this.target = null;
        this.setState('IDLE');
        this.isPathing = false;
    }

    setState(state) {
        if (this.combatState !== state) this.combatState = state;
    }

    handleState(pos, distance) {
        if (this.combatState === 'IDLE') return this.handleIdleState(pos, distance);
        if (this.combatState === 'PATHING') return this.handlePathingState(pos, distance);
        if (this.combatState === 'APPROACHING') return this.handleApproachingState(pos, distance);
        if (this.combatState === 'ATTACKING') return this.handleAttackingState(pos, distance);
    }

    handleIdleState(pos, distance) {
        if (distance > this.pathfindingThreshold) return this.startPathingToTarget(pos);
        if (distance > this.attackRange) return this.setState('APPROACHING');
        this.setState('ATTACKING');
    }

    handlePathingState(pos, distance) {
        if (this.lastPathTarget) {
            const targetMoved = this.getDistance3D(pos.x, pos.y, pos.z, this.lastPathTarget.x, this.lastPathTarget.y, this.lastPathTarget.z);
            if (targetMoved > this.pathTargetMoveThreshold) {
                Pathfinder.resetPath();
                this.isPathing = false;
                this.startPathingToTarget(pos);
                return;
            }
        }

        if (distance <= this.attackRange) {
            Pathfinder.resetPath();
            this.isPathing = false;
            this.setState('ATTACKING');
            Keybind.stopMovement();
            this.startRotationToTarget();
        }
    }

    handleApproachingState(pos, distance) {
        if (distance <= this.attackRange) {
            Keybind.stopMovement();
            this.setState('ATTACKING');
            return;
        }

        if (distance > this.pathfindingThreshold) {
            Keybind.stopMovement();
            this.startPathingToTarget(pos);
            return;
        }

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z, true, true);
        if (this.sprintToTarget) Keybind.setKey('sprint', true);
    }

    handleAttackingState(pos, distance) {
        if (distance > this.attackRange * 1.3) {
            this.setState('APPROACHING');
            return;
        }

        Keybind.stopMovement();

        if (this.isAimingAtTarget()) this.tryAttack();
        else this.startRotationToTarget();
    }

    startPathingToTarget(pos) {
        if (this.shouldUseBlackholeLogic() && !this.isPositionSafe(pos.x, pos.y, pos.z)) {
            Chat.message('&cTarget is inside a Blackhole! Aborting path.');
            this.blacklistTarget(this.target, 3000);
            this.target = null;
            this.setState('IDLE');
            return;
        }

        const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
        const end = [Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z)];

        this.lastPathTarget = { x: pos.x, y: pos.y, z: pos.z };
        this.isPathing = true;
        this.setState('PATHING');
        this.currentPathStartTime = Date.now();

        Rotations.stopRotation();

        const pathTarget = this.target;
        const pathTargetUuid = this.getTargetUuid(pathTarget);

        Pathfinder.resetPath();
        Pathfinder.findPath(start, end, (success) => {
            this.isPathing = false;

            if (!success) {
                if (pathTarget && this.recordFailedPathCallback(pathTarget)) {
                    this.target = null;
                    this.setState('IDLE');
                    return;
                }
                this.setState('APPROACHING');
                return;
            }

            if (pathTargetUuid) this.failedPathCallbacks.delete(pathTargetUuid);

            const pathDuration = Date.now() - this.currentPathStartTime;
            if (success && pathDuration < 500 && this.target) {
                const currentPos = this.getTargetPosition(this.target);
                const dist = currentPos ? this.getDistanceToPlayer(currentPos) : 0;
                if (dist > this.pathfindingThreshold - 2) {
                    Chat.message('&cTarget unreachable by pathfinder. Blacklisting for 3s.');
                    this.blacklistTarget(this.target, 3000);
                    this.target = null;
                    this.setState('IDLE');
                    return;
                }
            }

            if (this.target && !this.isTargetInvalid(this.target)) {
                const currentPos = this.getTargetPosition(this.target);
                const dist = currentPos ? this.getDistanceToPlayer(currentPos) : 999;
                this.startRotationToTarget();
                this.setState(dist <= this.attackRange ? 'ATTACKING' : 'APPROACHING');
            } else {
                this.setState('IDLE');
            }
        });
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
            this.blacklistTarget(target, 10000);
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
            if (entity.isDead()) return true;

            const targetUUID = this.getTargetUuid(target);
            if (targetUUID && this.blacklistedTargets.has(targetUUID)) return true;

            if (this.shouldUseBlackholeLogic()) {
                const pos = this.getTargetPosition(target);
                if (pos && !this.isPositionSafe(pos.x, pos.y, pos.z)) return true;
            }

            if (!targetUUID) return !this.targets.includes(target);

            return !this.targets.some((t) => this.getTargetUuid(t) === targetUUID);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return true;
        }
    }

    getDistanceToPlayer(pos) {
        return Math.hypot(Player.getX() - pos.x, Player.getY() - pos.y, Player.getZ() - pos.z);
    }

    getDistance3D(x1, y1, z1, x2, y2, z2) {
        return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    }

    detectTargets() {
        if (this.enabledPresets.size === 0 && (!this.customTargetNames || this.customTargetNames.length === 0)) return [];

        const mobs = [];
        const playerMP = Player.asPlayerMP();

        const addMobIfSafe = (entity) => {
            if (!this.shouldUseBlackholeLogic()) return mobs.push(entity);
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
                        if (config.checkVisibility && playerMP && !playerMP.canSeeEntity(entity)) return;
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
            if (pos && this.getDistanceToPlayer(pos) < this.targetStickinessRange) return this.target;
        }

        let lowestCost = Infinity;
        let bestTarget = null;

        this.targets.forEach((target) => {
            if (this.isTargetInvalid(target)) return;
            const pos = this.getTargetPosition(target);
            if (!pos) return;
            if (this.shouldUseBlackholeLogic() && !this.isPositionSafe(pos.x, pos.y, pos.z)) return;

            const distance = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), pos.x, pos.y, pos.z);
            const angles = MathUtils.angleToPlayer([pos.x, pos.y, pos.z]);
            const cost = distance * 10 + angles.distance * 0.5;

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
        const playerMP = config.checkVisibility ? Player.asPlayerMP() : null;

        World.getAllPlayers().forEach((player) => {
            try {
                const nameObj = player.getName();
                if (!nameObj) return;

                const name = ChatLib.removeFormatting(nameObj);
                const uuid = player.getUUID();
                if (whitelist && whitelist.has(uuid)) return;
                if (!config.names.some((mobName) => name.includes(mobName))) return;
                if (player.isSpectator() || player.isInvisible() || player.isDead()) return;
                if (config.checkVisibility && playerMP && !playerMP.canSeeEntity(player)) return;

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

        Pathfinder.resetPath();
        Keybind.stopMovement();
        Keybind.setKey('sprint', false);
        Rotations.stopRotation();

        this.externalTargets = null;
        this.targets = [];
        this.target = null;
        this.setState('IDLE');
        this.isPathing = false;
        this.lastPathTarget = null;
        this.lastAttackTime = 0;
        this.blacklistedTargets.clear();
        this.failedPathCallbacks.clear();
        this.activeBlackholes = [];
    }
}

export const CombatBot = new Combat();
