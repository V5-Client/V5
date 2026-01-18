import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Vec3d, ZombieEntity, EndermanEntity } from '../../utils/Constants';
import RenderUtils from '../../utils/render/RendererUtils';
import { MathUtils } from '../../utils/Math';
import { Rotations } from '../../utils/player/Rotations';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { Keybind } from '../../utils/player/Keybinding';
import { RayTrace } from '../../utils/Raytrace';

const BLACKHOLE_TEXTURES = new Set([
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg2Nzc3MywKICAicHJvZmlsZUlkIiA6ICJjNmViMzdjNmE4YjM0MDI3OGJjN2FmZGE3ZjMxOWJmMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJFbFJleUNhbGFiYXphbCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS81NWI3MGYwOTRlMDE2Nzk1MDhkZDViY2EzOTY0MGVkOWVjNWM2YzY3OTJmYmQ4ZjU3YzAzYjNhMTJmOWMwYTkyIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg1MjkxMCwKICAicHJvZmlsZUlkIiA6ICI5OWY1MzhjMDhlN2E0NTg3YmU4MGJjNGVmNzU0ZmQyMSIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb2xvV1MyIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Q2MWI4N2YxYTEwNDBhOGI5MjJjYTUxYmU5YzBiYzZkNmZjNzFiYTVkNzQ1YzZiZjY1OWNiZDBkOWE5Y2Y0ZmMiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTQ3NjI5MiwKICAicHJvZmlsZUlkIiA6ICI0YWY1YmQ3NTdmZDE0MWEwOTczYmUxNTFkZWRjNmM5ZiIsCiAgInByb2ZpbGVOYW1lIiA6ICJjcmFzaGludG95b3VybW9tIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzhkMzQ1NmUyZDkwZjQxMmM1NzA5MjViNTI4YmI1YTNlNGUxZTZhM2YyNGVmODIwYTZiMWNlNDJhYzhlMDA2MDIiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTcxODMwNSwKICAicHJvZmlsZUlkIiA6ICI4NzczZWRiODZmYWQ0MTczOGFiYWJhNTUxMWM3MDcwZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJjb3NtaWNwb3RhdG9lcyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9mNDM4YzZiYzUwMTk4NWNiYTA3OTZkODE3OTcxZTY4Njc5M2JlMDhiZTQyYjUzODVkN2QwYjkzZDg4MTUyMDE5IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTY5MzM4NCwKICAicHJvZmlsZUlkIiA6ICIzZmM3ZmRmOTM5NjM0YzQxOTExOTliYTNmN2NjM2ZlZCIsCiAgInByb2ZpbGVOYW1lIiA6ICJZZWxlaGEiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTI5MDc4MTM3ZWEwOTcxOTQ0YzM3NzQxODY3MTcyNjE2NmI3NTFiZDgzOTVlNDcxNDYwMTk1MjJjNzU3ODIyOSIsCiAgICAgICJtZXRhZGF0YSIgOiB7CiAgICAgICAgIm1vZGVsIiA6ICJzbGltIgogICAgICB9CiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTc0NTg5NCwKICAicHJvZmlsZUlkIiA6ICJmYjZkM2E5Zjk3MWY0ZTdlYmQ0MjE2Yjk0MjE5NDA3NCIsCiAgInByb2ZpbGVOYW1lIiA6ICJtYXJjaXhkZCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9jYjgzMmZjOTdkMzhjY2NhOGJkMTE4YmZiZGEyZmE1N2M1MjA4ZTFmYmJkNmI4ZWE0MjhmNzBjN2NhMTY1NmY0IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
]);

const BLACKHOLE_AVOID_RADIUS = 8.5;

const COMBAT_PRESETS = {
    Graveyard: {
        entityClass: ZombieEntity,
        checkVisibility: false,
        boundaryCheck: (x, y, z) => y >= 60 && y <= 100 && x <= -72,
    },
    Endermen: {
        entityClass: EndermanEntity,
        checkVisibility: true,
        boundaryCheck: (x, y, z) => true,
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

const ATTACK_REACH = 3.0;

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

        this.enabledPresets = new Set();

        //this.addSeparator('Target Settings', false);

        this.addMultiToggle(
            'Target Presets',
            Object.keys(COMBAT_PRESETS),
            false,
            (selected) => {
                this.enabledPresets.clear();
                const isEnabled = (name) => selected.some((item) => item.name === name && item.enabled === true);

                Object.keys(COMBAT_PRESETS).forEach((presetName) => {
                    if (isEnabled(presetName)) {
                        this.enabledPresets.add(presetName);
                    }
                });
            },
            'Select which mob types to target when running standalone'
        );

        this.customTargetNames = [];
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

        //this.addSeparator('Combat Settings', false);

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
            'Move To Target',
            (value) => {
                this.moveToTarget = value;
            },
            'Automatically move towards targets',
            true
        );

        this.addToggle(
            'Sprint',
            (value) => {
                this.sprintToTarget = value;
            },
            'Sprint when approaching targets',
            true
        );

        this.addSlider(
            'Rotation Speed Multiplier',
            1.0,
            3.0,
            1.0,
            (value) => {
                this.rotSpeedMultiplier = value;
            },
            'Multiplies the global rotation speed for combat'
        );

        this.settingsTarget = null;
        this.target = null;
        this.targetNametag = null;
        this.targets = [];
        this.costs = new Map();
        this.externalTargets = [];
        this.useExternalTargetsOnly = false;

        this.blacklistedTargets = new Map();

        this.activeBlackholes = [];
        this.scanTicker = 0;

        this.combatState = 'IDLE';

        this.attackRange = ATTACK_REACH;
        this.pathfindingThreshold = 15;
        this.attackCPS = 10;
        this.sprintToTarget = true;
        this.moveToTarget = true;
        this.rotSpeedMultiplier = 1.0;

        this.lastAttackTime = 0;
        this.isPathing = false;
        this.lastPathTarget = null;
        this.pathTargetMoveThreshold = 3;
        this.currentPathStartTime = 0;

        this.targetStickinessRange = 10;

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.combatState,
                    Target: () =>
                        this.target ? (this.target.getName ? ChatLib.removeFormatting(this.target.getName()) : this.target.name || 'Unknown') : 'None',
                    'Targets Found': () => (this.targets ? this.targets.length : 0),
                    'Active Zones': () => this.activeBlackholes.length,
                },
            },
        ]);

        this.on('postRenderWorld', () => {
            if (!this.targets || this.targets.length === 0) return;

            if (this.target) {
                const thickness = 7;
                const color = [255, 0, 0, 100];
                const entity = this.target.toMC ? this.target.toMC() : this.target;

                RenderUtils.drawEntityHitbox(entity, color, thickness, false);
            }

            const blueColor = [0, 70, 200, 100];
            const blueThickness = 3;

            this.targets.forEach((target) => {
                if (target === this.target) {
                    return;
                }

                const entity = target.toMC ? target.toMC() : target;

                RenderUtils.drawEntityHitbox(entity, blueColor, blueThickness, false);
            });

            if (this.shouldUseBlackholeLogic() && this.activeBlackholes.length > 0) {
                this.activeBlackholes.forEach((bh) => {
                    RenderUtils.drawBox(new Vec3d(bh.x - 0.5, bh.y + 0.5, bh.z - 0.5), [0, 0, 0, 150], false);
                });
            }
        });

        this.on('tick', () => {
            if (!this.enabled) return;
            if (!Client.isInChat() && Client.isInGui()) return;

            try {
                this.scanBlackholes();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }

            const now = Date.now();
            for (const [uuid, expiry] of this.blacklistedTargets.entries()) {
                if (now > expiry) {
                    this.blacklistedTargets.delete(uuid);
                }
            }

            this.targets = this.getTargets();

            if (this.target && this.isTargetInvalid(this.target)) {
                this.stopCombat();
                return;
            }

            const previousTarget = this.target;

            if (!this.target) {
                this.target = this.bestTarget();
            }

            if (!this.target) {
                if (this.combatState !== 'IDLE') {
                    this.combatState = 'IDLE';
                }
                Rotations.stopRotation();
                return;
            }

            const pos = this.getTargetPosition(this.target);
            if (!pos) return;

            const distance = this.getDistanceToPlayer(pos);
            const targetChanged = previousTarget !== this.target;

            if (!this.isPathing && this.combatState !== 'APPROACHING') {
                if (targetChanged || !Rotations.isTrackingEntity(this.target)) {
                    this.startRotationToTarget();
                }
            }

            this.handleState(pos, distance);
        });
    }

    shouldUseBlackholeLogic() {
        if (this.enabledPresets.has('Ice Walkers')) return true;
        if (this.customTargetNames && this.customTargetNames.length > 0) {
            const lowerNames = this.customTargetNames.map((n) => n.toLowerCase());
            if (lowerNames.some((n) => n.includes('ice') || n.includes('glacite') || n.includes('walker'))) {
                return true;
            }
        }
        return false;
    }

    scanBlackholes() {
        if (!this.shouldUseBlackholeLogic()) {
            this.activeBlackholes = [];
            return;
        }

        if (this.scanTicker == null) this.scanTicker = 0;
        this.scanTicker++;

        if (this.scanTicker % 10 !== 0) return;

        const stands = World.getAllEntities().filter((e) => e.getClassName().includes('ArmorStand') || e.getName().includes('Armor Stand'));

        if (!stands || stands.length === 0) return;

        const newBlackholes = [];
        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        const SCAN_RADIUS = 30;
        const SCAN_Y_RANGE = 20;

        for (let stand of stands) {
            try {
                let dx = stand.getX() - playerPos[0];
                let dy = stand.getY() - playerPos[1];
                let dz = stand.getZ() - playerPos[2];

                if (Math.abs(dx) > SCAN_RADIUS || Math.abs(dz) > SCAN_RADIUS || Math.abs(dy) > SCAN_Y_RANGE) continue;

                let headItem = stand.getStackInSlot(5);
                if (!headItem) continue;

                let mcItem = headItem.toMC ? headItem.toMC() : headItem;
                if (!mcItem) continue;

                let profileType = net.minecraft.component.DataComponentTypes.PROFILE;
                let profileComponent = mcItem.get(profileType);
                if (!profileComponent) continue;

                let gameProfile = profileComponent.getGameProfile();
                let data = gameProfile.toString();
                let base64Match = data.match(/value=([A-Za-z0-9+/=]+)/);

                if (base64Match && base64Match[1] && BLACKHOLE_TEXTURES.has(base64Match[1])) {
                    newBlackholes.push({
                        x: stand.getX(),
                        y: stand.getY(),
                        z: stand.getZ(),
                    });
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

        for (const bh of this.activeBlackholes) {
            const dx = x - bh.x;
            const dz = z - bh.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < BLACKHOLE_AVOID_RADIUS * BLACKHOLE_AVOID_RADIUS && Math.abs(y - bh.y) < 10) {
                return false;
            }
        }
        return true;
    }

    startRotationToTarget() {
        if (!this.target) return;
        Rotations.rotateToEntity(this.target, this.rotSpeedMultiplier);
    }

    isAimingAtTarget() {
        if (!this.target) return false;

        try {
            return RayTrace.isLookingAtEntity(this.target, this.attackRange + 0.5);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
    }

    stopCombat() {
        stopPathing();
        Keybind.stopMovement();
        Rotations.stopRotation();
        this.target = null;
        this.combatState = 'IDLE';
        this.isPathing = false;
    }

    handleState(pos, distance) {
        switch (this.combatState) {
            case 'IDLE':
                this.handleIdleState(pos, distance);
                break;
            case 'PATHING':
                this.handlePathingState(pos, distance);
                break;
            case 'APPROACHING':
                this.handleApproachingState(pos, distance);
                break;
            case 'ATTACKING':
                this.handleAttackingState(pos, distance);
                break;
        }
    }

    handleIdleState(pos, distance) {
        if (!this.moveToTarget) {
            if (distance <= this.attackRange) {
                this.combatState = 'ATTACKING';
            }
            return;
        }

        if (distance > this.pathfindingThreshold) {
            this.startPathingToTarget(pos);
        } else if (distance > this.attackRange) {
            this.combatState = 'APPROACHING';
        } else {
            this.combatState = 'ATTACKING';
        }
    }

    handlePathingState(pos, distance) {
        if (this.lastPathTarget) {
            const targetMoved = this.getDistance3D(pos.x, pos.y, pos.z, this.lastPathTarget.x, this.lastPathTarget.y, this.lastPathTarget.z);

            if (targetMoved > this.pathTargetMoveThreshold) {
                stopPathing();
                this.isPathing = false;
                this.startPathingToTarget(pos);
                return;
            }
        }

        if (distance <= this.attackRange) {
            stopPathing();
            this.isPathing = false;
            this.combatState = 'ATTACKING';
            Keybind.stopMovement();
            this.startRotationToTarget();
            return;
        }
    }

    handleApproachingState(pos, distance) {
        if (distance <= this.attackRange) {
            Keybind.stopMovement();
            this.combatState = 'ATTACKING';
            return;
        }

        if (distance > this.pathfindingThreshold) {
            Keybind.stopMovement();
            this.startPathingToTarget(pos);
            return;
        }

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z, true, true);

        if (this.sprintToTarget) {
            Keybind.setKey('sprint', true);
        }
    }

    handleAttackingState(pos, distance) {
        if (distance > this.attackRange * 1.3) {
            this.combatState = 'APPROACHING';
            return;
        }

        Keybind.stopMovement();

        if (this.isAimingAtTarget()) {
            this.tryAttack();
        } else {
            this.startRotationToTarget();
        }
    }

    startPathingToTarget(pos) {
        if (this.shouldUseBlackholeLogic() && !this.isPositionSafe(pos.x, pos.y, pos.z)) {
            Chat.message('&cTarget is inside a Blackhole! Aborting path.');
            this.blacklistTarget(this.target, 3000);
            this.target = null;
            this.combatState = 'IDLE';
            return;
        }

        const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
        const end = [Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z)];

        this.lastPathTarget = { x: pos.x, y: pos.y, z: pos.z };
        this.isPathing = true;
        this.combatState = 'PATHING';
        this.currentPathStartTime = Date.now();

        Rotations.stopRotation();

        findAndFollowPath(
            start,
            end,
            (success) => {
                this.isPathing = false;

                const pathDuration = Date.now() - this.currentPathStartTime;
                if (success && pathDuration < 500 && this.target) {
                    const currentPos = this.getTargetPosition(this.target);
                    const dist = currentPos ? this.getDistanceToPlayer(currentPos) : 0;

                    if (dist > this.pathfindingThreshold - 2) {
                        Chat.message('&cTarget unreachable by pathfinder. Blacklisting for 3s.');
                        this.blacklistTarget(this.target, 3000);
                        this.target = null;
                        this.combatState = 'IDLE';
                        return;
                    }
                }

                if (this.target && !this.isTargetInvalid(this.target)) {
                    const currentPos = this.getTargetPosition(this.target);
                    const dist = currentPos ? this.getDistanceToPlayer(currentPos) : 999;

                    this.startRotationToTarget();

                    if (dist <= this.attackRange) {
                        this.combatState = 'ATTACKING';
                    } else {
                        this.combatState = 'APPROACHING';
                    }
                } else {
                    this.combatState = 'IDLE';
                }
            },
            true
        );
    }

    blacklistTarget(target, duration) {
        try {
            const uuid = target.getUUID ? target.getUUID().toString() : target.toMC ? target.toMC().getUuid().toString() : null;
            if (uuid) {
                this.blacklistedTargets.set(uuid, Date.now() + duration);
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
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

            const targetUUID = target.getUUID ? target.getUUID().toString() : entity.getUuid ? entity.getUuid().toString() : null;

            if (targetUUID && this.blacklistedTargets.has(targetUUID)) return true;

            if (this.shouldUseBlackholeLogic()) {
                const pos = this.getTargetPosition(target);
                if (pos && !this.isPositionSafe(pos.x, pos.y, pos.z)) {
                    return true;
                }
            }

            if (!targetUUID) return !this.targets.includes(target);

            const exists = this.targets.some((t) => {
                const tUUID = t.getUUID ? t.getUUID().toString() : t.toMC ? t.toMC().getUuid().toString() : null;
                return tUUID && tUUID === targetUUID;
            });

            return !exists;
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
        if (this.enabledPresets.size === 0 && (!this.customTargetNames || this.customTargetNames.length === 0)) {
            return [];
        }

        const mobs = [];
        const playerMP = Player.asPlayerMP();

        const addMobIfSafe = (entity) => {
            if (this.shouldUseBlackholeLogic()) {
                const x = entity.getX();
                const y = entity.getY();
                const z = entity.getZ();
                if (this.isPositionSafe(x, y, z)) mobs.push(entity);
            } else {
                mobs.push(entity);
            }
        };

        this.enabledPresets.forEach((presetName) => {
            const config = COMBAT_PRESETS[presetName];
            if (!config) return;

            if (config.entityClass) {
                const entities = World.getAllEntitiesOfType(config.entityClass);

                entities.forEach((entity) => {
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
            } else if (config.names) {
                const found = this.findMob(config);
                found.forEach(addMobIfSafe);
            }
        });

        if (this.customTargetNames && this.customTargetNames.length > 0) {
            const customConfig = {
                names: this.customTargetNames,
                checkVisibility: true,
                boundaryCheck: (x, y, z) => true,
            };
            const customFound = this.findMob(customConfig);
            customFound.forEach(addMobIfSafe);
        }

        return mobs;
    }

    getTargets() {
        if (this.useExternalTargetsOnly) {
            return this.externalTargets || [];
        }

        if (this.externalTargets && this.externalTargets.length > 0) {
            return this.externalTargets;
        }

        return this.detectTargets();
    }

    setExternalTargets(targets) {
        this.useExternalTargetsOnly = true;

        if (Array.isArray(targets)) {
            this.externalTargets = targets;
        } else {
            this.externalTargets = [];
        }
    }

    clearExternalTargets() {
        this.externalTargets = [];
        this.useExternalTargetsOnly = false;
    }

    getTargetPosition(target) {
        if (!target) return null;

        try {
            if (typeof target.getX === 'function') {
                return { x: target.getX(), y: target.getY(), z: target.getZ() };
            }

            if (typeof target.x === 'number' && typeof target.y === 'number' && typeof target.z === 'number') {
                return { x: target.x, y: target.y, z: target.z };
            }

            const entity = target.toMC ? target.toMC() : target;
            if (entity && typeof entity.getX === 'function') {
                return { x: entity.getX(), y: entity.getY(), z: entity.getZ() };
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        return null;
    }

    bestTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        if (this.target && !this.isTargetInvalid(this.target)) {
            const pos = this.getTargetPosition(this.target);
            if (pos) {
                const distance = this.getDistanceToPlayer(pos);
                if (distance < this.targetStickinessRange) {
                    return this.target;
                }
            }
        }

        this.costs.clear();
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

            this.costs.set(target, cost);

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTarget = target;
            }
        });

        if (bestTarget && this.target) {
            const bestUUID = bestTarget.getUUID ? bestTarget.getUUID().toString() : bestTarget.toMC ? bestTarget.toMC().getUuid().toString() : null;
            const currentUUID = this.target.getUUID ? this.target.getUUID().toString() : this.target.toMC ? this.target.toMC().getUuid().toString() : null;

            if (bestUUID && bestUUID === currentUUID) {
                return this.target;
            }
        }

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

                const x = player.getX(),
                    y = player.getY(),
                    z = player.getZ();
                if (config.boundaryCheck && !config.boundaryCheck(x, y, z)) return;

                mobs.push(player);
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        });

        return mobs;
    }

    onEnable() {
        Chat.message('&aCombat Bot Enabled');

        if (this.useExternalTargetsOnly) {
            Chat.message('&7Mode: &eExternal targets (controlled by another module)');
        } else {
            const presets = Array.from(this.enabledPresets).join(', ');
            Chat.message(`&7Targeting: &b${presets || 'None selected'}`);
        }

        this.activeBlackholes = [];
    }

    onDisable() {
        Chat.message('&cCombat Bot Disabled');

        stopPathing();

        Keybind.stopMovement();
        Keybind.setKey('sprint', false);

        Rotations.stopRotation();

        this.externalTargets = [];
        this.useExternalTargetsOnly = false;
        this.targets = [];
        this.target = null;
        this.combatState = 'IDLE';
        this.isPathing = false;
        this.lastPathTarget = null;
        this.lastAttackTime = 0;
        this.blacklistedTargets.clear();
        this.activeBlackholes = [];
    }
}

export const CombatBot = new Combat();
