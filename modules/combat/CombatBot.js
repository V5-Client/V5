import { ArmorStandEntity, CreeperEntity, DataComponents, EndermanEntity, MobEntity, PlayerEntity, Vec3d, ZombieEntity } from '../../utils/Constants';
import { angleToPlayer, getDistance, getDistanceToPlayer } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { ClientboundSystemChatPacket } from '../../utils/Packets';
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
const NAMETAG_MOB_RANGE = 1;
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
    Ghost: {
        entityClass: CreeperEntity,
        entityCheck: (entity) => entity.isPowered(),
        allowInvisible: true,
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

        this.pathfindingThreshold = 15;
        this.attackCPS = 10;
        this.attackButton = 'Left Click';
        this.autoHeal = true;
        this.healThreshold = 20;
        this.health = null;
        this.healthUpdatedAt = 0;
        this.vitality = null;
        this.vitalityUpdatedAt = 0;
        this.healReadyAt = new Map();
        this.healReturnSlot = null;
        this.healingSlot = null;
        this.nextHealAt = 0;
        this.suppressCombatClickThisTick = false;
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

        this.addToggle(
            'Auto Heal',
            (value) => {
                this.autoHeal = !!value;
                if (!this.autoHeal) this.stopHealing();
            },
            'Use a Zombie Sword or healing wand from the hotbar when health is low.',
            true
        );
        this.addSlider('Heal Threshold', 1, 100, 20, (value) => (this.healThreshold = value), 'Heal below this percentage of maximum SkyBlock health.');

        this.addButton('Healing Debug', () => this.showHealingDebug(), 'Show the latest health reading and healing items found in the hotbar.');

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
            'Case-insensitive nametag text separated by commas. Matches partial names and links armor stands to mob hitboxes within 1 block.'
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
        register('actionBar', (text) => this.readHealth(text)).setCriteria('${text}');
        register('packetReceived', (packet) => {
            if (packet.overlay()) this.readHealth(packet.content().getString());
        }).setFilteredClass(ClientboundSystemChatPacket);
        register('packetReceived', (packet) => this.readHealth(packet.text().getString())).setFilteredClass(
            net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket
        );
        register('worldUnload', () => this.resetHealing());
    }

    onTick() {
        if (!this.enabled) return;
        this.suppressCombatClickThisTick = false;
        if (!World.isLoaded() || !Player.getPlayer()) {
            this.resetHealing();
            this.pauseMovement();
            return;
        }
        if (!Client.isInChat() && Client.isInGui()) {
            this.stopHealing();
            this.pauseMovement();
            return;
        }

        this.heal();

        this.scanBlackholes();
        this.expireTargetData();
        this.targets = this.getTargets();

        if (this.target && !this.isTargetUsable(this.target)) this.setTarget(null);
        if (!this.target) {
            this.setTarget(this.bestTarget());
            const position = this.getTargetPosition(this.target);
            if (!position) this.setState(STATES.IDLE);
            else {
                const distance = this._getDistanceToPlayer(position);
                if (distance.distance <= ATTACK_REACH && this.canSeeTarget(this.target)) this.engage(position, distance);
                else this.startPath(position);
            }
            return;
        }

        const position = this.getTargetPosition(this.target);
        if (!position) {
            this.setTarget(null);
            return;
        }

        const distance = this._getDistanceToPlayer(position);

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
        if (distance.distanceFlat > pathThreshold || (distance.distance > ATTACK_REACH && !this.canSeeTarget(this.target))) {
            this.startPath(position);
            return;
        }

        this.engage(position, distance);
    }

    readHealth(text) {
        const clean = this.stripHealingFormatting(text);
        const vitalityMatch = clean.match(/([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)\s*[♡\uE028]/);
        if (vitalityMatch) {
            const current = Number(vitalityMatch[1].replace(/,/g, ''));
            const maximum = Number(vitalityMatch[2].replace(/,/g, ''));
            if (Number.isFinite(current) && Number.isFinite(maximum) && current >= 0 && maximum > 0) {
                this.vitality = current;
                this.vitalityUpdatedAt = Date.now();
            }
        }
        const match = clean.match(/([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)\s*[❤♥\uE010]/);
        if (!match) return;

        const current = Number(match[1].replace(/,/g, ''));
        const maximum = Number(match[2].replace(/,/g, ''));
        if (!Number.isFinite(current) || !Number.isFinite(maximum) || current < 0 || maximum <= 0) return;

        this.health = { current, maximum };
        this.healthUpdatedAt = Date.now();
    }

    showHealingDebug() {
        const reading = this.health ? `${this.health.current}/${this.health.maximum} (${Date.now() - this.healthUpdatedAt}ms old)` : 'No health received';
        const slot = this.findHealSlot();
        const item =
            slot === -1 ? 'None found in hotbar' : `Slot ${slot + 1}: ${this.stripHealingFormatting(Player.getInventory().getStackInSlot(slot).getName())}`;
        this.message(`&7Auto Heal: &f${this.autoHeal ? 'On' : 'Off'} &7Threshold: &f${this.healThreshold}% &7Health: &f${reading}`);
        const ability = slot === -1 ? null : this.getHealingAbility(Player.getInventory().getStackInSlot(slot));
        const vitality = this.vitality === null ? 'No vitality received' : `${this.vitality} (${Date.now() - this.vitalityUpdatedAt}ms old)`;
        this.message(`&7Healing item: &f${item} &7Vitality cost: &f${ability?.cost ?? 'Unknown'} &7Vitality: &f${vitality}`);
    }

    stripHealingFormatting(text) {
        if (text == null) return '';
        const value = text.getUnformattedText?.() ?? text.getString?.() ?? String(text);
        return ChatLib.removeFormatting(String(value)).replace(/\s+/g, ' ').trim();
    }

    getHealingAbility(item) {
        if (!item) return null;
        const lore = Array.from(item.getLore() || [], (line) => this.stripHealingFormatting(line)).join('\n');
        const costMatch = lore.match(/Vitality Cost:\s*([\d,]+(?:\.\d+)?)/i);
        if (!costMatch) return null;
        const cost = Number(costMatch[1].replace(/,/g, ''));
        if (!Number.isFinite(cost) || cost < 0) return null;
        const cooldownMatch = lore.match(/Cooldown:\s*([\d,]+(?:\.\d+)?)\s*(ms|s)\b/i);
        const cooldown = cooldownMatch ? Number(cooldownMatch[1].replace(/,/g, '')) * (cooldownMatch[2].toLowerCase() === 'ms' ? 1 : 1000) : 1000;
        return { cost, cooldown: Number.isFinite(cooldown) ? Math.max(100, cooldown) : 1000 };
    }

    findHealingItem(usableOnly = false, now = Date.now()) {
        const inventory = Player.getInventory();
        if (!inventory) return null;

        let wand = null;
        for (let slot = 0; slot < Math.min(inventory.getSize(), 9); slot++) {
            if (usableOnly && now < (this.healReadyAt.get(slot) || 0)) continue;

            const item = inventory.getStackInSlot(slot);
            const name = this.stripHealingFormatting(item?.getName?.()).toLowerCase();
            const isSword = name.includes('zombie sword');
            const isWand = /\bwand of (healing|mending|restoration|atonement)\b/.test(name);
            if (!isSword && !isWand) continue;

            const ability = usableOnly ? this.getHealingAbility(item) : null;
            if (usableOnly && (!ability || this.vitality < ability.cost)) continue;

            const candidate = { slot, ability };
            if (isSword) return candidate;
            if (!wand) wand = candidate;
        }
        return wand;
    }

    findHealSlot(usableOnly = false) {
        return this.findHealingItem(usableOnly)?.slot ?? -1;
    }

    heal() {
        const now = Date.now();
        const player = Player.getPlayer();
        const health = this.health;
        if (
            !this.autoHeal ||
            !World.isLoaded() ||
            !player ||
            player.isDeadOrDying() ||
            Client.isInGui() ||
            !health ||
            this.vitality === null ||
            now - this.vitalityUpdatedAt >= 5000 ||
            now - this.healthUpdatedAt >= 5000 ||
            health.current <= 0 ||
            health.current >= (health.maximum * this.healThreshold) / 100
        ) {
            return this.stopHealing();
        }

        const candidate = this.findHealingItem(true, now);
        if (!candidate) return this.stopHealing();

        const { slot, ability } = candidate;
        const heldSlot = Player.getHeldItemIndex();
        if (this.healReturnSlot === null) this.healReturnSlot = heldSlot;
        this.suppressCombatClickThisTick = true;
        this.healingSlot = slot;
        if (heldSlot !== slot) {
            Player.setHeldItemIndex(slot);
            this.nextHealAt = now + 100;
        } else if (now >= this.nextHealAt) {
            Client.rightClick();
            this.vitality = Math.max(0, this.vitality - ability.cost);
            this.healReadyAt.set(slot, now + ability.cooldown);
            this.nextHealAt = now + 100;
        }
        return true;
    }

    resetHealing() {
        this.health = null;
        this.healthUpdatedAt = 0;
        this.vitality = null;
        this.vitalityUpdatedAt = 0;
        this.healReadyAt.clear();
        this.stopHealing(false);
    }

    stopHealing(restoreSlot = true) {
        if (this.healReturnSlot === null) return false;
        this.suppressCombatClickThisTick = true;
        if (restoreSlot && World.isLoaded() && Player.getPlayer() && Player.getHeldItemIndex() === this.healingSlot) {
            Player.setHeldItemIndex(this.healReturnSlot);
        }
        this.healReturnSlot = null;
        this.healingSlot = null;
        this.nextHealAt = 0;
        return true;
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
        if (this.suppressCombatClickThisTick || this.healReturnSlot !== null) return;
        const now = Date.now();
        if (distance > ATTACK_REACH + 0.35 || now < this.nextAttackAt) return;
        if (!isLookingAtEntity(this.target, ATTACK_REACH + 0.5)) return;

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

        if (this.externalTargets === null) this.blacklistTarget(target, PATH_FAILURE_BLACKLIST_MS);
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

            const distance = this._getDistanceToPlayer(position).distance;
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
            if (!this.isCombatTargetCandidate(target, true)) return false;

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

    _getDistanceToPlayer(position) {
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

    findMob(config) {
        if (!config?.entityClass && !Array.isArray(config?.names)) return [];

        const names = Array.isArray(config.names)
            ? config.names
                  .filter((name) => typeof name === 'string')
                  .map((name) => name.trim().toLowerCase())
                  .filter(Boolean)
            : null;
        if (names && !names.length) return [];

        const entities = names ? World.getAllEntities() : World.getAllEntitiesOfType(config.entityClass);
        const nametagMobs = names ? entities.filter((entity) => this.isCombatTargetCandidate(entity, true)) : [];
        const mobs = entities.filter((entity) => {
            try {
                if (!this.isCombatTargetCandidate(entity, config.allowInvisible)) return false;
                if (config.entityClass && !(entity.toMC() instanceof config.entityClass)) return false;
                if (this.isTargetNameBlacklisted(entity)) return false;
                if (config.boundaryCheck && !config.boundaryCheck(entity.getX(), entity.getY(), entity.getZ())) return false;
                if (config.entityCheck && !config.entityCheck(entity.toMC())) return false;

                return this.isVisibleOrRecent(entity, config.checkVisibility);
            } catch (e) {
                console.error('V5 Combat Bot target scan error: ' + e);
                return false;
            }
        });
        const candidates = new Map(mobs.map((mob) => [this.getTargetUuid(mob), mob]));
        if (!names) return [...candidates.values()];

        const targets = new Map();
        for (const entity of entities) {
            try {
                const name = this.getCleanEntityName(entity);
                if (!names.some((candidate) => name.includes(candidate)) || this.isTargetNameBlacklisted(entity)) continue;

                const target = entity.toMC() instanceof ArmorStandEntity ? this.resolveNametagTarget(entity, nametagMobs) : entity;
                if (target && candidates.has(this.getTargetUuid(target))) targets.set(this.getTargetUuid(target), target);
            } catch (e) {
                console.error('V5 Combat Bot target scan error: ' + e);
            }
        }

        return [...targets.values()];
    }

    isCombatTargetCandidate(entity, allowInvisible = false) {
        try {
            const mcEntity = entity?.toMC ? entity.toMC() : entity;
            if (mcEntity instanceof PlayerEntity) {
                const uuid = mcEntity.getUUID();
                if (uuid.version() !== 2 || String(uuid) === String(Player.getUUID())) return false;
            } else if (!(mcEntity instanceof MobEntity)) {
                return false;
            }

            return (
                !mcEntity.isSpectator() &&
                !mcEntity.isRemoved?.() &&
                !mcEntity.isDeadOrDying?.() &&
                (allowInvisible || !entity.isInvisible?.()) &&
                !entity.isDead?.()
            );
        } catch (e) {
            return false;
        }
    }

    resolveNametagTarget(namedEntity, mobs) {
        const mcEntity = namedEntity.toMC();
        if (mcEntity.isRemoved?.() || namedEntity.isDead?.()) return null;

        const point = mcEntity.position();

        const maxDistanceSq = NAMETAG_MOB_RANGE ** 2;
        let closest = null;
        let closestDistanceSq = Infinity;

        for (const mob of mobs) {
            try {
                const distanceSq = mob.toMC().getBoundingBox().distanceToSqr(point);
                if (distanceSq <= maxDistanceSq && distanceSq < closestDistanceSq) {
                    closest = mob;
                    closestDistanceSq = distanceSq;
                }
            } catch (e) {
                console.error('V5 Combat Bot target scan error: ' + e);
            }
        }

        return closest;
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
            const profile = stack?.get(DataComponents.PROFILE)?.partialProfile?.()?.toString() || '';
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
        const groups = new Map();
        this.targets.forEach((target) => {
            const blacklisted = this.blacklistedTargets.has(this.getTargetUuid(target));
            if (!blacklisted && !this.isTargetUsable(target)) return;

            const entity = target.toMC ? target.toMC() : target;
            const selected = this.sameTarget(target, this.target);
            const key = `${blacklisted}:${selected}`;
            if (!groups.has(key))
                groups.set(key, {
                    color: blacklisted ? new RenderColor(0, 0, 0, 150) : selected ? new RenderColor(255, 0, 0, 100) : new RenderColor(0, 70, 200, 100),
                    thickness: selected ? 7 : 3,
                    entities: [],
                });
            groups.get(key).entities.push(entity);
        });
        groups.forEach(({ entities, color, thickness }) => Render3D.drawHitboxes(entities, color, thickness, false));
        Render3D.drawFilledBoxes(
            this.activeBlackholes.map((blackhole) => new Vec3d(blackhole.x - 0.5, blackhole.y + 0.5, blackhole.z - 0.5)),
            new RenderColor(0, 0, 0, 150),
            false
        );
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
        this.stopHealing();
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
