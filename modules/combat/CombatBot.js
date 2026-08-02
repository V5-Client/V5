import { ArmorStandEntity, EndermanEntity, Vec3d, ZombieEntity } from '../../utils/Constants';
import { angleToPlayer, getDistance, getDistanceToPlayer } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { setKeysForStraightLineCoords } from '../../utils/player/Movement';
import { Rotations } from '../../utils/player/Rotations';
import { isLookingAtEntity } from '../../utils/Raytrace';

const STATES = {
    IDLE: 'IDLE',
    PATHING: 'PATHING',
    FIGHTING: 'FIGHTING',
};

const parseNames = (value) => [
    ...new Set(
        String(value)
            .split(',')
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
    ),
];

const BLACKHOLE_TEXTURES = new Set([
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg2Nzc3MywKICAicHJvZmlsZUlkIiA6ICJjNmViMzdjNmE4YjM0MDI3OGJjN2FmZGE3ZjMxOWJmMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJFbFJleUNhbGFiYXphbCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS81NWI3MGYwOTRlMDE2Nzk1MDhkZDViY2EzOTY0MGVkOWVjNWM2YzY3OTJmYmQ4ZjU3YzAzYjNhMTJmOWMwYTkyIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE4NDg1MjkxMCwKICAicHJvZmlsZUlkIiA6ICI5OWY1MzhjMDhlN2E0NTg3YmU4MGJjNGVmNzU0ZmQyMSIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb2xvV1MyIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Q2MWI4N2YxYTEwNDBhOGI5MjJjYTUxYmU5YzBiYzZkNmZjNzFiYTVkNzQ1YzZiZjY1OWNiZDBkOWE5Y2Y0ZmMiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTQ3NjI5MiwKICAicHJvZmlsZUlkIiA6ICI0YWY1YmQ3NTdmZDE0MWEwOTczYmUxNTFkZWRjNmM5ZiIsCiAgInByb2ZpbGVOYW1lIiA6ICJjcmFzaGludG95b3VybW9tIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzhkMzQ1NmUyZDkwZjQxMmM1NzA5MjViNTI4YmI1YTNlNGUxZTZhM2YyNGVmODIwYTZiMWNlNDJhYzhlMDA2MDIiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTcxODMwNSwKICAicHJvZmlsZUlkIiA6ICI4NzczZWRiODZmYWQ0MTczOGFiYWJhNTUxMWM3MDcwZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJjb3NtaWNwb3RhdG9lcyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9mNDM4YzZiYzUwMTk4NWNiYTA3OTZkODE3OTcxZTY4Njc5M2JlMDhiZTQyYjUzODVkN2QwYjkzZDg4MTUyMDE5IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTY5MzM4NCwKICAicHJvZmlsZUlkIiA6ICIzZmM3ZmRmOTM5NjM0YzQxOTExOTliYTNmN2NjM2ZlZCIsCiAgInByb2ZpbGVOYW1lIiA6ICJZZWxlaGEiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMTI5MDc4MTM3ZWEwOTcxOTQ0YzM3NzQxODY3MTcyNjE2NmI3NTFiZDgzOTVlNDcxNDYwMTk1MjJjNzU3ODIyOSIsCiAgICAgICJtZXRhZGF0YSIgOiB7CiAgICAgICAgIm1vZGVsIiA6ICJzbGltIgogICAgICB9CiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjE5OTc0NTg5NCwKICAicHJvZmlsZUlkIiA6ICJmYjZkM2E5Zjk3MWY0ZTdlYmQ0MjE2Yjk0MjE5NDA3NCIsCiAgInByb2ZpbGVOYW1lIiA6ICJtYXJjaXhkZCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9jYjgzMmZjOTdkMzhjY2NhOGJkMTE4YmZiZGEyZmE1N2M1MjA4ZTFmYmJkNmI4ZWE0MjhmNzBjN2NhMTY1NmY0IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
]);

const ATTACK_REACH = 4;
const PATH_HANDOFF_DISTANCE = 6;
const REPATH_DISTANCE = 7;
const REPATH_DELAY_MS = 1200;
const PATH_FAILURE_BLACKLIST_MS = 5000;
const VISIBILITY_GRACE_MS = 750;

const BLACKHOLE_AVOID_RADIUS = 8.5;
const BLACKHOLE_SCAN_INTERVAL = 10;
const BLACKHOLE_SCAN_RADIUS = 30;
const BLACKHOLE_SCAN_Y_RANGE = 20;
const BLACKHOLE_MEMORY_MS = 60000;
const BLACKHOLE_MERGE_RADIUS = 2.5;

const COMBAT_PRESETS = {
    Graveyard: {
        entityClass: ZombieEntity,
        checkVisibility: false,
        boundaryCheck: (x, y) => y >= 60 && y <= 100 && x <= -72,
    },
    Endermen: {
        entityClass: EndermanEntity,
        checkVisibility: true,
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
            description: 'Automatically hunts entities matching configured names.',
            tooltip: 'Enter one or more entity names, then toggle with the module keybind.',
            theme: '#c74d4d',
            isMacro: true,
        });

        this.bindToggleKey('Toggle Combat Bot');

        this.externalTargets = null;
        this.enabledPresets = new Set(['Graveyard']);
        this.targetNames = [];
        this.targetNameBlacklist = [];
        this.targets = [];
        this.target = null;
        this.trackedTarget = null;
        this.state = STATES.IDLE;

        this.pathToken = 0;
        this.pathStartedAt = 0;
        this.pathTargetPosition = null;
        this.nextAttackAt = 0;

        this.blacklistedTargets = new Map();
        this.visibleUntil = new Map();
        this.activeBlackholes = [];
        this.scanTicker = 0;

        this.attackRange = ATTACK_REACH;
        this.pathfindingThreshold = 15;
        this.attackCPS = 10;
        this.attackButton = 'Left Click';
        this.overrideRotationSpeed = false;
        this.combatRotationSpeed = 400;

        this.addSlider(
            'Pathfinding Threshold',
            5,
            30,
            15,
            (value) => {
                this.pathfindingThreshold = value;
            },
            'Distance to switch from direct pursuit to pathfinding'
        );

        this.addSlider(
            'Attack CPS',
            5,
            15,
            10,
            (value) => {
                this.attackCPS = value;
            },
            'Average attacks per second'
        );

        this.addMultiToggle(
            'Attack Button',
            ['Left Click', 'Right Click'],
            true,
            (selected) => {
                this.attackButton = selected.find((item) => item.enabled)?.name || 'Left Click';
            },
            'Mouse button used to attack.',
            'Left Click'
        );

        let rotationSpeedSlider;
        this.addToggle(
            'Override Rotation Speed',
            (value) => {
                this.overrideRotationSpeed = !!value;
                rotationSpeedSlider.visible = this.overrideRotationSpeed;
                this.refreshTargetRotation();
            },
            'Use a Combat Bot-specific rotation speed instead of the global setting.'
        );
        rotationSpeedSlider = this.addSlider(
            'Combat Rotation Speed',
            30,
            60,
            40,
            (value) => {
                this.combatRotationSpeed = value * 10;
                if (this.overrideRotationSpeed) this.refreshTargetRotation();
            },
            'Degrees per second.'
        );
        rotationSpeedSlider.visible = false;

        this.addMultiToggle(
            'Target Presets',
            Object.keys(COMBAT_PRESETS),
            false,
            (selected) => {
                this.enabledPresets.clear();
                selected.forEach((item) => {
                    if (item.enabled && COMBAT_PRESETS[item.name]) this.enabledPresets.add(item.name);
                });
            },
            'Select built-in mob types to target when running standalone.',
            'Graveyard'
        );

        this.addTextInput(
            'Target Names',
            '',
            (value) => (this.targetNames = parseNames(value)),
            'Generic internal entity names separated by commas. Use presets for location-specific mobs.'
        );

        this.addTextInput(
            'Target Name Blacklist',
            '',
            (value) => (this.targetNameBlacklist = parseNames(value)),
            'Case-insensitive entity names to exclude, separated by commas.'
        );

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.state,
                    Target: () => this.getTargetDisplayName(this.target),
                    'Targets Found': () => this.targets.length,
                    'Known Blackholes': () => this.activeBlackholes.length,
                },
            },
        ]);

        this.on('postRenderWorld', () => this.renderTargets());
        this.on('tick', () => this.onTick());
    }

    onTick() {
        if (!this.enabled) return;
        if (!Client.isInChat() && Client.isInGui()) {
            this.pauseMovement();
            return;
        }

        this.scanBlackholes();
        this.expireTargetData();
        this.targets = this.getTargets();

        if (this.target && !this.isTargetUsable(this.target)) this.setTarget(null);
        if (!this.target) {
            this.setTarget(this.bestTarget());
            const position = this.getTargetPosition(this.target);
            if (!position) this.setState(STATES.IDLE);
            else {
                const distance = this.getDistanceToPlayer(position);
                if (distance.distance <= this.attackRange && this.canSeeTarget(this.target)) this.engage(position, distance);
                else this.startPath(position);
            }
            return;
        }

        const position = this.getTargetPosition(this.target);
        if (!position) {
            this.setTarget(null);
            return;
        }

        const distance = this.getDistanceToPlayer(position);

        if (this.state === STATES.PATHING) {
            if (
                Date.now() - this.pathStartedAt >= REPATH_DELAY_MS &&
                this.pathTargetPosition &&
                this.getDistanceBetween(position, this.pathTargetPosition).distanceFlat >= REPATH_DISTANCE
            ) {
                this.startPath(position);
            }
            return;
        }

        const pathThreshold = this.state === STATES.FIGHTING ? this.pathfindingThreshold + 2 : this.pathfindingThreshold;
        if (distance.distanceFlat > pathThreshold || (distance.distance > this.attackRange && !this.canSeeTarget(this.target))) {
            this.startPath(position);
            return;
        }

        this.engage(position, distance);
    }

    setTarget(target) {
        if (this.sameTarget(this.target, target)) return;

        this.cancelPath();
        Client.stopMovement();
        Rotations.stop();
        this.trackedTarget = null;
        this.target = target;
        this.nextAttackAt = 0;
        this.setState(STATES.IDLE);

        this.trackTarget();
    }

    trackTarget() {
        if (!this.target || this.trackedTarget === this.target) return;
        const options = this.overrideRotationSpeed ? { rotationSpeed: this.combatRotationSpeed } : { speedMultiplier: 0.9 };
        if (Rotations.trackEntity(this.target, options)) this.trackedTarget = this.target;
    }

    refreshTargetRotation() {
        if (!this.target) return;
        this.trackedTarget = null;
        this.trackTarget();
    }

    engage(position, distance) {
        this.setState(STATES.FIGHTING);
        this.trackTarget();

        if (distance.distanceFlat > 2.8) {
            setKeysForStraightLineCoords(position.x, position.y, position.z, true, true);
            Client.setKey('sprint', true);
        } else {
            Client.stopMovement();
        }

        if (distance.distanceY < -1.5) Client.setKey('space', true);
        this.tryAttack(distance.distance);
    }

    tryAttack(distance) {
        const now = Date.now();
        if (distance > this.attackRange + 0.35 || now < this.nextAttackAt) return;
        if (!isLookingAtEntity(this.target, this.attackRange + 0.5)) return;

        if (this.attackButton === 'Right Click') Client.rightClick();
        else Client.leftClick();
        const jitter = 0.82 + Math.random() * 0.36;
        this.nextAttackAt = now + (1000 / this.attackCPS) * jitter;
    }

    startPath(position) {
        if (!this.isPositionSafe(position.x, position.y, position.z)) {
            this.setTarget(null);
            return;
        }

        this.cancelPath();
        this.trackTarget();
        this.setState(STATES.PATHING);
        this.pathStartedAt = Date.now();
        this.pathTargetPosition = { ...position };

        const candidates = this.targets.filter((target) => this.isTargetUsable(target));
        const goals = [];
        candidates.forEach((target) => {
            const targetPosition = this.getTargetPosition(target);
            if (targetPosition) goals.push(...this.buildPathGoals(targetPosition));
        });
        let target = this.target;
        const token = ++this.pathToken;
        Pathfinder.findPath(goals, (success) => this.onPathComplete(token, target, success), {
            resolveEntityTarget: (result) => {
                const selected = this.getPathResultTarget(result, candidates);
                const selectedPosition = this.getTargetPosition(selected);
                if (!selectedPosition) return null;

                target = selected;
                this.pathTargetPosition = { ...selectedPosition };
                if (!this.sameTarget(this.target, selected)) {
                    this.target = selected;
                    this.trackedTarget = null;
                    this.nextAttackAt = 0;
                    this.trackTarget();
                }

                return { target: selected, goals: this.buildPathGoals(selectedPosition) };
            },
            entityTrackDistance: 8,
            walkArrivalRadius: PATH_HANDOFF_DISTANCE,
            avoidPoints: this.activeBlackholes,
            avoidRadius: Math.ceil(BLACKHOLE_AVOID_RADIUS),
            silent: true,
        });
    }

    getPathResultTarget(result, candidates) {
        const path = result?.path;
        const end = path && path.length ? path[path.length - 1] : null;
        if (!end) return this.target;

        const best = candidates.reduce((closest, candidate) => {
            const position = this.getTargetPosition(candidate);
            if (!position) return closest;
            const distance = this.getDistanceBetween(end, position).distance;
            return !closest || distance < closest.distance ? { target: candidate, distance } : closest;
        }, null);
        return best ? best.target : this.target;
    }

    onPathComplete(token, target, success) {
        if (token !== this.pathToken || this.state !== STATES.PATHING || !this.sameTarget(this.target, target)) return;

        this.pathTargetPosition = null;
        if (success && this.isTargetUsable(target)) {
            this.setState(STATES.FIGHTING);
            this.trackTarget();
            return;
        }

        this.blacklistTarget(target, PATH_FAILURE_BLACKLIST_MS);
        this.setTarget(null);
    }

    cancelPath() {
        this.pathToken++;
        this.pathTargetPosition = null;
        if (this.state === STATES.PATHING || Pathfinder.isPathing()) Pathfinder.resetPath();
    }

    pauseMovement() {
        if (this.state === STATES.IDLE && !this.trackedTarget) return;
        this.cancelPath();
        Client.stopMovement();
        Rotations.stop();
        this.trackedTarget = null;
        this.setState(STATES.IDLE);
    }

    setState(state) {
        this.state = state;
    }

    buildPathGoals(position) {
        const x = Math.floor(position.x);
        const y = Math.floor(position.y);
        const z = Math.floor(position.z);
        return [
            [x, y - 1, z],
            [x, y, z],
            [x, y + 1, z],
        ];
    }

    bestTarget() {
        let best = null;
        let bestScore = Infinity;

        this.targets.forEach((target) => {
            if (!this.isTargetUsable(target)) return;
            const position = this.getTargetPosition(target);
            if (!position) return;

            const distance = this.getDistanceToPlayer(position).distance;
            const turn = angleToPlayer([position.x, position.y, position.z]).distance;
            const score = distance + turn * 0.025;
            if (score < bestScore) {
                best = target;
                bestScore = score;
            }
        });

        return best;
    }

    isTargetUsable(target) {
        if (!target) return false;

        try {
            const entity = target.toMC ? target.toMC() : target;
            if (!entity || entity.isRemoved?.() || entity.isDeadOrDying?.() || target.isDead?.()) return false;

            const uuid = this.getTargetUuid(target);
            if (uuid && this.blacklistedTargets.has(uuid)) return false;

            const position = this.getTargetPosition(target);
            if (!position || !this.isPositionSafe(position.x, position.y, position.z)) return false;

            return this.targets.some((candidate) => this.sameTarget(candidate, target));
        } catch (e) {
            return false;
        }
    }

    sameTarget(first, second) {
        if (first === second) return true;
        if (!first || !second) return false;
        const firstUuid = this.getTargetUuid(first);
        return firstUuid !== null && firstUuid === this.getTargetUuid(second);
    }

    getTargetUuid(target) {
        try {
            const entity = target?.toMC ? target.toMC() : target;
            return entity?.getUUID?.()?.toString() || null;
        } catch (e) {
            return null;
        }
    }

    getTargetPosition(target) {
        try {
            const entity = target?.toMC ? target.toMC() : target;
            if (!entity?.getX) return null;
            return { x: entity.getX(), y: entity.getY(), z: entity.getZ() };
        } catch (e) {
            return null;
        }
    }

    getDistanceToPlayer(position) {
        return getDistanceToPlayer(position.x, position.y, position.z);
    }

    getDistanceBetween(first, second) {
        return getDistance(first.x, first.y, first.z, second.x, second.y, second.z);
    }

    canSeeTarget(target) {
        try {
            return Player.asPlayerMP()?.canSeeEntity(target) ?? true;
        } catch (e) {
            return true;
        }
    }

    blacklistTarget(target, duration) {
        const uuid = this.getTargetUuid(target);
        if (uuid) this.blacklistedTargets.set(uuid, Date.now() + duration);
    }

    expireTargetData() {
        const now = Date.now();
        for (const [uuid, expiry] of this.blacklistedTargets) {
            if (now >= expiry) this.blacklistedTargets.delete(uuid);
        }
        for (const [uuid, expiry] of this.visibleUntil) {
            if (now >= expiry) this.visibleUntil.delete(uuid);
        }
    }

    findMob(config, whitelist = null) {
        if (!config?.entityClass && !Array.isArray(config?.names)) return [];

        const names = config.names?.map((name) => name.toLowerCase());
        const entities = config.entityClass ? World.getAllEntitiesOfType(config.entityClass) : World.getAllEntities();

        return entities.filter((entity) => {
            try {
                const uuid = entity.getUUID();
                if (whitelist?.has(uuid)) return false;
                if (names && !names.some((candidate) => this.getCleanEntityName(entity).includes(candidate))) return false;
                if (entity.isSpectator?.() || entity.isInvisible?.() || entity.isDead?.()) return false;
                if (config.boundaryCheck && !config.boundaryCheck(entity.getX(), entity.getY(), entity.getZ())) return false;

                return this.isVisibleOrRecent(entity, config.checkVisibility);
            } catch (e) {
                console.error('V5 Combat Bot target scan error: ' + e);
                return false;
            }
        });
    }

    getCleanEntityName(entity) {
        return ChatLib.removeFormatting(String(entity.getName()?.getString?.() ?? entity.getName())).toLowerCase();
    }

    isVisibleOrRecent(entity, checkVisibility) {
        if (!checkVisibility) return true;

        const uuid = this.getTargetUuid(entity);
        if (!uuid) return false;

        if (this.canSeeTarget(entity)) {
            this.visibleUntil.set(uuid, Date.now() + VISIBILITY_GRACE_MS);
            return true;
        }

        return (this.visibleUntil.get(uuid) || 0) > Date.now();
    }

    getTargets() {
        const targets = this.externalTargets !== null ? this.externalTargets : this.targetNames.length ? this.findMob({ names: this.targetNames }) : [];
        if (this.externalTargets === null) this.enabledPresets.forEach((name) => targets.push(...this.findMob(COMBAT_PRESETS[name])));
        return [...new Map(targets.map((target) => [this.getTargetUuid(target), target])).values()].filter((target) => !this.isTargetNameBlacklisted(target));
    }

    isTargetNameBlacklisted(target) {
        if (!this.targetNameBlacklist.length) return false;
        try {
            const name = this.getCleanEntityName(target);
            return this.targetNameBlacklist.some((blocked) => name.includes(blocked));
        } catch (e) {
            return false;
        }
    }

    setExternalTargets(targets) {
        this.externalTargets = Array.isArray(targets) ? targets : [];
    }

    clearExternalTargets() {
        this.externalTargets = null;
    }

    scanBlackholes() {
        if (++this.scanTicker % BLACKHOLE_SCAN_INTERVAL !== 0) return;

        const player = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        const now = Date.now();

        for (const stand of World.getAllEntitiesOfType(ArmorStandEntity) || []) {
            try {
                const position = { x: stand.getX(), y: stand.getY(), z: stand.getZ() };
                if (
                    Math.abs(position.x - player.x) > BLACKHOLE_SCAN_RADIUS ||
                    Math.abs(position.y - player.y) > BLACKHOLE_SCAN_Y_RANGE ||
                    Math.abs(position.z - player.z) > BLACKHOLE_SCAN_RADIUS ||
                    !this.isBlackholeHead(stand.getStackInSlot(5))
                ) {
                    continue;
                }

                const known = this.activeBlackholes.find((blackhole) => this.getDistanceBetween(blackhole, position).distanceFlat <= BLACKHOLE_MERGE_RADIUS);
                if (known) Object.assign(known, position, { lastSeen: now });
                else this.activeBlackholes.push({ ...position, lastSeen: now });
            } catch (e) {
                console.error('V5 Combat Bot blackhole scan error: ' + e);
            }
        }

        this.activeBlackholes = this.activeBlackholes.filter((blackhole) => now - blackhole.lastSeen <= BLACKHOLE_MEMORY_MS);
    }

    isBlackholeHead(item) {
        try {
            const stack = item?.toMC ? item.toMC() : item;
            const profile = stack?.get(net.minecraft.core.component.DataComponents.PROFILE)?.partialProfile?.()?.toString() || '';
            if (!profile) return false;

            for (const texture of BLACKHOLE_TEXTURES) {
                if (profile.includes(texture)) return true;
            }
        } catch (e) {
            console.error('V5 Combat Bot blackhole texture error: ' + e);
        }
        return false;
    }

    isPositionSafe(x, y, z) {
        return this.activeBlackholes.every((blackhole) => this.getDistanceBetween({ x, y, z }, blackhole).distanceFlat >= BLACKHOLE_AVOID_RADIUS);
    }

    renderTargets() {
        this.targets.forEach((target) => {
            const blacklisted = this.blacklistedTargets.has(this.getTargetUuid(target));
            if (!blacklisted && !this.isTargetUsable(target)) return;

            const entity = target.toMC ? target.toMC() : target;
            const selected = this.sameTarget(target, this.target);
            const color = blacklisted ? new RenderColor(0, 0, 0, 150) : selected ? new RenderColor(255, 0, 0, 100) : new RenderColor(0, 70, 200, 100);
            RenderUtils.drawHitbox(entity, color, selected ? 7 : 3, false);
        });

        this.activeBlackholes.forEach((blackhole) => {
            RenderUtils.drawFilledBox(new Vec3d(blackhole.x - 0.5, blackhole.y + 0.5, blackhole.z - 0.5), new RenderColor(0, 0, 0, 150), false);
        });
    }

    getTargetDisplayName(target) {
        if (!target) return 'None';
        try {
            return ChatLib.removeFormatting(String(target.getName?.()?.getString?.() ?? target.getName?.() ?? target.name ?? 'Unknown'));
        } catch (e) {
            return 'Unknown';
        }
    }

    onEnable() {
        this.activeBlackholes = [];
        this.scanTicker = 0;
        if (!this.isParentManaged) {
            this.message(this.targetNames.length || this.enabledPresets.size ? '&aEnabled' : '&eEnabled, but no targets are configured.');
        }
    }

    onDisable() {
        if (!this.isParentManaged) this.message('&cDisabled');

        this.cancelPath();
        Client.stopMovement();
        Rotations.stop();
        this.externalTargets = null;
        this.targets = [];
        this.target = null;
        this.trackedTarget = null;
        this.state = STATES.IDLE;
        this.nextAttackAt = 0;
        this.blacklistedTargets.clear();
        this.visibleUntil.clear();
        this.activeBlackholes = [];
    }
}

export const CombatBot = new Combat();
