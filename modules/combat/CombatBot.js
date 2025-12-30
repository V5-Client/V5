import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Vec3d, ZombieEntity, EndermanEntity } from '../../utils/Constants';
import RenderUtils from '../../utils/render/RendererUtils';
import { MathUtils } from '../../utils/Math';
import { Rotations } from '../../utils/player/Rotations';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { Keybind } from '../../utils/player/Keybinding';

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
};

class Combat extends ModuleBase {
    constructor() {
        super({
            name: 'Combat Bot',
            subcategory: 'Combat',
            description: 'Universal settings for combat bot',
            tooltip: 'Combat bot settings',
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.enabledPresets = new Set(['Graveyard']);

        this.addMultiToggle(
            'Target Presets',
            Object.keys(COMBAT_PRESETS),
            false,

            (selected) => {
                this.enabledPresets.clear();

                if (Array.isArray(selected)) {
                    selected.forEach((item) => {
                        const name = typeof item === 'string' ? item : item?.name;
                        if (name && COMBAT_PRESETS[name]) {
                            this.enabledPresets.add(name);
                        }
                    });
                } else if (typeof selected === 'string' && COMBAT_PRESETS[selected]) {
                    this.enabledPresets.add(selected);
                }
            },
            'Select which mob types to target when running standalone',
            'Graveyard'
        );

        this.addSlider(
            'Attack Range',
            2,
            6,
            3.5,
            (value) => {
                this.attackRange = value;
            },
            'Distance to start attacking'
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

        this.settingsTarget = null;
        this.target = null;
        this.targetNametag = null;
        this.targets = [];
        this.costs = new Map();
        this.externalTargets = [];
        this.useExternalTargetsOnly = false;

        this.combatState = 'IDLE';

        this.attackRange = 3.5;
        this.pathfindingThreshold = 15;
        this.attackCPS = 10;
        this.sprintToTarget = true;
        this.moveToTarget = true;

        this.lastAttackTime = 0;
        this.isPathing = false;
        this.lastPathTarget = null;
        this.pathTargetMoveThreshold = 3;

        this.isTrackingTarget = false;

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

            this.targets = this.getTargets();

            if (this.target && this.isTargetInvalid(this.target)) {
                stopPathing();
                Keybind.stopMovement();
                Rotations.stopRotation();
                this.target = null;
                this.combatState = 'IDLE';
                this.isTrackingTarget = false;
            }

            if (!this.target) {
                this.target = this.bestTarget();
                this.isTrackingTarget = false;
            }

            if (!this.target) {
                this.combatState = 'IDLE';
                Rotations.stopRotation();
                this.isTrackingTarget = false;
                return;
            }

            const pos = this.getTargetPosition(this.target);
            if (!pos) return;

            const distance = this.getDistanceToPlayer(pos);

            this.handleState(pos, distance);

            if (this.combatState !== 'PATHING') {
                Rotations.rotateToVector(new Vec3d(pos.x, pos.y + 1.5, pos.z), this.isTrackingTarget);
                this.isTrackingTarget = true;
            }
        });
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
                this.startPathingToTarget(pos);
                return;
            }
        }

        if (distance <= this.pathfindingThreshold * 0.7) {
            stopPathing();
            this.isPathing = false;
            this.combatState = 'APPROACHING';
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

        Keybind.setKeysForStraightLineCoords(pos.x, pos.y, pos.z);

        if (this.sprintToTarget) {
            Keybind.setKey('sprint', true);
        }
    }

    handleAttackingState(pos, distance) {
        if (distance > this.attackRange * 1.5) {
            this.combatState = 'APPROACHING';
            return;
        }

        Keybind.stopMovement();
        this.tryAttack();
    }

    startPathingToTarget(pos) {
        const start = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];
        const end = [Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z)];

        this.lastPathTarget = { x: pos.x, y: pos.y, z: pos.z };
        this.isPathing = true;
        this.combatState = 'PATHING';
        this.isTrackingTarget = false;

        Rotations.stopRotation();

        findAndFollowPath(start, end, (success) => {
            if (!success) return;
            this.isPathing = false;
            this.combatState = 'APPROACHING';
        });
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
            if (!config || !config.entityClass) return;

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
        this.isTrackingTarget = false;
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
        this.costs.clear();
        let lowestCost = Infinity;
        let bestTarget = null;

        if (!this.targets || this.targets.length === 0) return null;

        this.targets.forEach((target) => {
            const pos = this.getTargetPosition(target);
            if (!pos) return;

            const distance = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), pos.x, pos.y, pos.z);
            const angles = MathUtils.angleToPlayer([pos.x, pos.y, pos.z]);
            const cost = distance * 10 + angles.distance;

            this.costs.set(target, cost);

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTarget = target;
            }
        });

        return bestTarget;
    }

    /**
     * Finds mobs :D
     *
     * @param {Object} config - Mob configuration object
     * @param {string[]} config.names - Array of name substrings to match
     * @param {boolean} config.checkVisibility - Whether to check if player can see entity
     * @param {Function} config.boundaryCheck - Function(x,y,z) returning boolean
     * @param {Set} [whitelist] - Optional set of UUIDs to exclude from results
     * @returns {Array<PlayerMP>} - Array of found mobs
     */
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

        this.isTrackingTarget = false;
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
        this.isTrackingTarget = false;
    }
}

export const CombatBot = new Combat();
