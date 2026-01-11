import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Vec3d, ZombieEntity, EndermanEntity } from '../../utils/Constants';
import RenderUtils from '../../utils/render/RendererUtils';
import { MathUtils } from '../../utils/Math';
import { Rotations } from '../../utils/player/Rotations';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { Keybind } from '../../utils/player/Keybinding';
import { RayTrace } from '../../utils/Raytrace';

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
        });

        this.on('tick', () => {
            if (!this.enabled) return;
            if (!Client.isInChat() && Client.isInGui()) return;

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
                this.combatState = 'IDLE';
                Rotations.stopRotation();
                return;
            }

            const pos = this.getTargetPosition(this.target);
            if (!pos) return;

            const distance = this.getDistanceToPlayer(pos);

            const targetChanged = previousTarget !== this.target;

            if (!this.isPathing) {
                if (targetChanged || !Rotations.isTrackingEntity(this.target)) {
                    this.startRotationToTarget();
                }
            }

            this.handleState(pos, distance);
        });
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

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z, true);

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
        }
    }

    startPathingToTarget(pos) {
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
            const uuid = target.getUUID ? target.getUUID() : target.toMC ? target.toMC().getUuid() : null;
            if (uuid) {
                this.blacklistedTargets.set(uuid, Date.now() + duration);
            }
        } catch (e) {}
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

            const targetUUID = target.getUUID ? target.getUUID() : entity.getUuid ? entity.getUuid() : null;

            if (targetUUID && this.blacklistedTargets.has(targetUUID)) return true;

            if (!targetUUID) return !this.targets.includes(target);

            const exists = this.targets.some((t) => {
                const tUUID = t.getUUID ? t.getUUID() : t.toMC ? t.toMC().getUuid() : null;
                return tUUID && tUUID.equals(targetUUID);
            });

            return !exists;
        } catch (e) {
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
        if (this.enabledPresets.size === 0) {
            return [];
        }

        const mobs = [];
        const playerMP = Player.asPlayerMP();

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

                        mobs.push(entity);
                    } catch (e) {}
                });
            } else if (config.names) {
                const found = this.findMob(config);
                mobs.push(...found);
            }
        });

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
        } catch (e) {}

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

            const distance = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), pos.x, pos.y, pos.z);
            const angles = MathUtils.angleToPlayer([pos.x, pos.y, pos.z]);

            const cost = distance * 10 + angles.distance * 0.5;

            this.costs.set(target, cost);

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTarget = target;
            }
        });

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
            } catch (e) {}
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
    }
}

export const CombatBot = new Combat();
