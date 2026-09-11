import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { Movement } from '../../utils/player/Movement';
import { Guis } from '../../utils/player/Inventory';
import { Rotations } from '../../utils/player/Rotations';
import { Raytrace } from '../../utils/Raytrace';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { getLoadedPests } from '../visuals/PestESP';

const STATES = {
    IDLE: 'Idle',
    APPROACHING: 'Approaching',
    CASTING: 'Casting',
    WAITING_REEL: 'Waiting to reel',
    REELING: 'Reeling',
};
const REEL_STAND_RANGE_SQ = 3 ** 2;
const HOLOGRAM_RANGE_SQ = 4 ** 2;
const CAST_RANGE_SLACK = 2;
const AIM_MS = 280;
const ACTION_COOLDOWN_MS = 300;
const REEL_CONFIRM_TICKS = 4;
const REEL_AFTER_CAST_MS = 700;
const REEL_REPEAT_MS = 550;
const RECAST_MS = 8_000;
const HOVER_HEIGHT = 2;
const FLIGHT_START_TICKS = 6;

function unwrapText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
        if (typeof value.isPresent === 'function') return value.isPresent() ? unwrapText(value.get()) : '';
    } catch (e) {}
    try {
        if (typeof value.getString === 'function') return value.getString();
    } catch (e) {}
    return '';
}

function stripName(value) {
    return ChatLib.removeFormatting(unwrapText(value))
        .replace(/\u00A7[0-9A-FK-OR]/gi, '')
        .replace(/&[0-9A-FK-OR]/gi, '')
        .trim();
}

function getEntityDisplayNames(entity) {
    if (!entity) return [];
    const names = [];
    const seen = new Set();
    const push = (value) => {
        const text = stripName(value);
        if (!text || seen.has(text)) return;
        seen.add(text);
        names.push(text);
    };
    try {
        push(entity.getName?.());
    } catch (e) {}
    try {
        const mc = entity.toMC?.();
        if (mc) {
            push(mc.getCustomName?.());
            push(mc.getDisplayName?.());
            push(mc.getName?.());
        }
    } catch (e) {}
    return names.filter((name) => !/^armor stand$/i.test(name));
}

function getEntityDisplayName(entity) {
    return getEntityDisplayNames(entity)[0] || '';
}

function entityName(entity) {
    if (!entity) return '';
    let name = '';
    try {
        const raw = entity.getName?.();
        if (raw != null) {
            const text = typeof raw.getString === 'function' ? raw.getString() : typeof raw === 'string' ? raw : '';
            name = ChatLib.removeFormatting(text)
                .replace(/\u00A7[0-9A-FK-OR]/gi, '')
                .trim();
        }
    } catch (e) {}
    if (name && !/^armor stand$/i.test(name)) return name;
    try {
        const custom = stripName(entity.toMC?.()?.getCustomName?.());
        if (custom) return custom;
    } catch (e) {}
    return name;
}

function isCustomNameShown(entity) {
    try {
        if (typeof entity.isCustomNameVisible === 'function') return !!entity.isCustomNameVisible();
    } catch (e) {}
    try {
        const mc = entity.toMC?.();
        if (mc && typeof mc.isCustomNameVisible === 'function') return !!mc.isCustomNameVisible();
    } catch (e) {}
    return true;
}

function isReelPrompt(entity) {
    return getEntityDisplayNames(entity).some((name) => {
        if (matchPestType(name)) return false;
        const text = name.toLowerCase().replace(/\s+/g, ' ');
        if (text === 'reel' || /^reel[!?.]*$/.test(text) || /^click to reel[!?.]*$/.test(text)) return true;
        return text.length <= 18 && /\breel\b/.test(text);
    });
}

const EXCLUDED_PEST_TYPES = new Set(['fly', 'moth', 'mosquito', 'firefly', 'lunar moth']);

function matchPestType(name) {
    const text = String(name || '').toLowerCase();
    if (text.includes('lunar moth')) return 'lunar moth';
    if (text.includes('field mouse')) return 'field mouse';
    if (text.includes('praying mantis')) return 'praying mantis';
    if (text.includes('dragonfly')) return 'dragonfly';
    if (text.includes('earthworm')) return 'earthworm';
    if (text.includes('firefly')) return 'firefly';
    if (text.includes('mosquito')) return 'mosquito';
    if (/\bmoth\b/.test(text)) return 'moth';
    if (/\bfly\b/.test(text)) return 'fly';
    return ['cricket', 'locust', 'rat', 'mite', 'slug', 'beetle'].find((type) => text.includes(type)) || null;
}

function entityId(entity) {
    try {
        return entity?.getUUID?.()?.toString?.() ?? null;
    } catch (e) {
        return null;
    }
}

function mcEntity(entity) {
    if (!entity) return null;
    try {
        if (entity.toMC) return entity.toMC();
    } catch (e) {}
    return entity;
}

function mcId(entity) {
    const mc = mcEntity(entity);
    if (!mc) return null;
    try {
        return mc.getId();
    } catch (e) {
        return null;
    }
}

function playerMcId() {
    return mcId(Player.getPlayer());
}

function leashHolder(mc) {
    try {
        return mc.getLeashHolder();
    } catch (e) {}
    try {
        const data = mc.getLeashData();
        if (!data) return null;
        try {
            return data.leashHolder;
        } catch (e2) {}
        try {
            return data.getLeashHolder();
        } catch (e3) {}
    } catch (e) {}
    return null;
}

function isLeashedToPlayer(entity) {
    const mc = mcEntity(entity);
    const player = mcEntity(Player.getPlayer());
    if (!mc || !player) return false;
    try {
        if (!mc.isLeashed()) return false;
    } catch (e) {}
    const holder = leashHolder(mc);
    if (!holder) {
        try {
            return mc.isLeashed();
        } catch (e) {
            return false;
        }
    }
    try {
        if (holder === player) return true;
    } catch (e) {}
    try {
        return holder.getId() === player.getId();
    } catch (e) {
        return false;
    }
}

function distEntities(a, b) {
    return Math.hypot(a.getX() - b.getX(), a.getY() - b.getY(), a.getZ() - b.getZ());
}

function entitySpeed(entity) {
    try {
        return Math.hypot(entity.getMotionX(), entity.getMotionY(), entity.getMotionZ());
    } catch (e) {}
    const mc = mcEntity(entity);
    if (!mc) return 0;
    try {
        const motion = mc.getDeltaMovement();
        return Math.hypot(motion.x, motion.y, motion.z);
    } catch (e) {}
    return 0;
}

function isHologramStand(stand) {
    return getEntityDisplayNames(stand).some((name) => isReelText(name) || matchPestType(name) || name.length > 18);
}

function linkIds(packet) {
    let source = null;
    let dest = null;
    try {
        source = packet.getSourceId();
    } catch (e) {}
    try {
        dest = packet.getDestId();
    } catch (e) {}
    if (source == null) {
        try {
            source = packet.sourceId();
        } catch (e) {}
    }
    if (dest == null) {
        try {
            dest = packet.destId();
        } catch (e) {}
    }
    return { source, dest };
}

class PestLasso extends ModuleBase {
    constructor() {
        super({
            name: 'Pest Lasso',
            subcategory: 'Farming',
            description: 'Tracks garden pests, flies in, and reels only when the REEL nametag is over the hooked pest.',
            tooltip: 'Standalone pest lasso. Enable Use in Pest Killer to hook it into Pest Killer.',
            isMacro: true,
            autoDisableOnWorldUnload: true,
        });

        this.useInPestKiller = false;
        this.excludeSmallPests = true;
        this.targetRange = 24;
        this.approachDistance = 5;
        this.trackingTimeout = 20;
        this.status = STATES.IDLE;
        this.lastResult = null;
        this.taskMode = false;
        this.castAt = 0;
        this.lastReelAt = 0;
        this.reelCount = 0;
        this.reelSeenTicks = 0;
        this.reelStandId = null;
        this.flightStartTicks = 0;
        this.groundRecovering = false;
        this.attached = false;

        this.bindToggleKey();
        this.addToggle('Use in Pest Killer', (value) => (this.useInPestKiller = !!value), 'Pest Killer lassos pests instead of vacuuming them.');
        this.addToggle(
            'Exclude Fly/Moth/Mosquito/Firefly',
            (value) => (this.excludeSmallPests = !!value),
            'Do not target flies, moths, mosquitoes, fireflies, or lunar moths. Types are read from the nametag above the pest.'
        );
        this.addSlider('Target Range', 8, 48, this.targetRange, (value) => (this.targetRange = value), 'How far to look for a pest.');
        this.addSlider('Approach Distance', 2, 10, this.approachDistance, (value) => (this.approachDistance = value), 'Fly this close before throwing the lasso.');
        this.addSlider(
            'Vacuum After',
            5,
            60,
            this.trackingTimeout,
            (value) => (this.trackingTimeout = Math.round(value)),
            'Seconds allowed to attach the lead. Stops once the pest is leashed. Pest Killer vacuums only if it never hooks.'
        );
        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.status,
                    Target: () => (this.pest ? `${this.getPestTypeLabel(this.pest)} ${Math.round(this.distanceTo(this.pest))}m` : 'None'),
                    Reel: () => this.reelOverlay(),
                    Lead: () => this.leadLabel(),
                },
            },
        ]);

        this.on('tick', () => this.onStandaloneTick());
    }

    onEnable() {
        Mouse.ungrab();
        this.resetCapture();
        this.startedAt = Date.now();
        this.lastResult = null;
        this.status = STATES.APPROACHING;
    }

    onDisable() {
        this.stop();
        Mouse.regrab();
    }

    start(pest) {
        this.taskMode = true;
        this.lastResult = null;
        this.resetCapture();
        this.setPest(pest);
        if (this.isExcludedPest(this.pest)) return this.finish('failed');
        this.startedAt = Date.now();
        this.status = STATES.APPROACHING;
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        return true;
    }

    tick() {
        if (this.lastResult) return true;
        if (!this.taskMode && !this.enabled) return true;

        const pest = this.resolvePest();
        if (!pest) return this.finish('success');
        if (this.isExcludedPest(pest)) {
            if (this.taskMode) return this.finish('failed');
            this.setPest(this.findPest());
            return false;
        }
        if (!this.selectLasso()) {
            Client.stopMovement();
            return false;
        }

        this.trackPest(pest);
        const distance = this.distanceTo(pest);
        this.maintainFlight(pest, distance);

        if (this.castAt) {
            const reelStand = this.findReelStand(pest);
            if (reelStand) {
                this.attached = true;
                this.status = STATES.WAITING_REEL;
                if (Date.now() - this.castAt < REEL_AFTER_CAST_MS) return false;
                if (Date.now() - this.lastReelAt < REEL_REPEAT_MS) return false;
                const id = entityId(reelStand);
                if (this.reelStandId !== id) {
                    this.reelStandId = id;
                    this.reelSeenTicks = 1;
                    return false;
                }
                this.reelSeenTicks++;
                if (this.reelSeenTicks < REEL_CONFIRM_TICKS) return false;
                return this.reel(reelStand);
            }
            this.reelStandId = null;
            this.reelSeenTicks = 0;
            if (this.attached || Date.now() - this.castAt < RECAST_MS) return false;
            this.castAt = 0;
        }

        if (!this.attached && Date.now() - this.startedAt >= this.trackingTimeout * 1000) return this.finish('failed');

        if (distance > this.approachDistance) {
            this.status = STATES.APPROACHING;
            return false;
        }

        return this.cast(pest, distance);
    }

    onStandaloneTick() {
        if (!this.enabled || this.taskMode) return;
        if (Utils.area() !== 'Garden') return;
        if (Client.isInGui()) {
            Client.stopMovement();
            return;
        }
        if (!this.pest) this.setPest(this.findPest());
        this.tick();
        if (this.lastResult) {
            this.resetCapture();
            this.startedAt = Date.now();
            this.lastResult = null;
            this.status = STATES.APPROACHING;
        }
    }

    selectLasso() {
        const slot = Guis.findItemInHotbar('Lasso');
        if (slot < 0) {
            if (!this.hasReportedMissingLasso) this.message('&cNo Lasso found in hotbar.');
            this.hasReportedMissingLasso = true;
            return false;
        }
        this.hasReportedMissingLasso = false;
        if (Player.getHeldItemIndex() === slot) return true;
        Guis.setItemSlot(slot);
        return false;
    }

    setPest(pest) {
        if (this.trackedId && this.trackedId !== entityId(pest)) {
            Rotations.stop();
            this.trackedId = null;
        }
        this.pest = pest && !pest.isDead() ? pest : null;
        this.pestId = entityId(this.pest);
    }

    resolvePest() {
        if (this.pest && !this.pest.isDead()) return this.pest;
        const match = this.pestId && getLoadedPests().find((pest) => entityId(pest) === this.pestId);
        if (match) {
            this.setPest(match);
            return match;
        }
        if (this.taskMode) return null;
        const next = this.findPest();
        this.setPest(next);
        if (next) this.startedAt = Date.now();
        return next;
    }

    findPest() {
        const rangeSq = this.targetRange ** 2;
        let closest = null;
        let closestDistance = rangeSq;
        getLoadedPests().forEach((pest) => {
            if (this.isExcludedPest(pest)) return;
            const dx = pest.getX() - Player.getX();
            const dy = pest.getY() - Player.getY();
            const dz = pest.getZ() - Player.getZ();
            const distanceSq = dx * dx + dy * dy + dz * dz;
            if (distanceSq <= closestDistance) {
                closest = pest;
                closestDistance = distanceSq;
            }
        });
        return closest;
    }

    trackPest(pest) {
        const id = entityId(pest);
        if (this.trackedId === id && Rotations.active) return;
        if (Rotations.trackEntity(pest)) {
            this.trackedId = id;
            this.trackedAt = Date.now();
        }
    }

    maintainFlight(pest, distance) {
        const player = Player.getPlayer();
        if (!player) return;
        const flying = !!player.getAbilities?.().flying;
        const onGround = player.onGround();
        const hoverY = pest.getY() + HOVER_HEIGHT;
        const dy = hoverY - Player.getY();

        if (onGround || !flying) {
            if (!this.groundRecovering) {
                this.groundRecovering = true;
                this.flightStartTicks = 0;
                Client.setKey('space', false);
            }
            ['w', 'a', 's', 'd', 'shift', 'sprint'].forEach((key) => Client.setKey(key, false));
            Client.setKey('space', !Client.isKeyDown('space'));
            this.flightStartTicks++;
            if (this.flightStartTicks >= FLIGHT_START_TICKS) this.flightStartTicks = 0;
            return;
        }
        this.groundRecovering = false;
        this.flightStartTicks = FLIGHT_START_TICKS;

        if (distance > this.approachDistance) {
            Movement.setKeysForStraightLineCoords(pest.getX(), hoverY, pest.getZ(), false, true);
            Client.setKey('sprint', distance > this.approachDistance + 3);
        } else {
            ['w', 'a', 's', 'd', 'sprint'].forEach((key) => Client.setKey(key, false));
        }
        Client.setKey('space', dy > 0.45);
        Client.setKey('shift', dy < -0.45 && Player.getY() > pest.getY() + 1.25);
    }

    cast(pest, distance) {
        if (Date.now() < this.nextActionAt) return false;
        if (distance > this.approachDistance + CAST_RANGE_SLACK) return false;
        const aimedFor = Date.now() - (this.trackedAt || 0);
        if (aimedFor < AIM_MS) return false;
        if (!Raytrace.isLookingAtEntity(pest, this.approachDistance + 4)) return false;

        this.status = STATES.CASTING;
        Client.rightClick();
        this.castAt = Date.now();
        this.lastReelAt = 0;
        this.reelCount = 0;
        this.reelSeenTicks = 0;
        this.reelStandId = null;
        this.attached = false;
        this.nextActionAt = Date.now() + ACTION_COOLDOWN_MS;
        this.status = STATES.WAITING_REEL;
        return false;
    }

    reel(stand) {
        if (Date.now() < this.nextActionAt) return false;
        Client.rightClick();
        this.lastReelAt = Date.now();
        this.reelCount++;
        this.reelSeenTicks = 0;
        this.nextActionAt = Date.now() + ACTION_COOLDOWN_MS;
        this.status = STATES.WAITING_REEL;
        return false;
    }

    isExcludedPest(pest) {
        if (!this.excludeSmallPests || !pest) return false;
        const types = this.getPestLabels(pest).map(matchPestType).filter(Boolean);
        if (types.some((type) => EXCLUDED_PEST_TYPES.has(type))) return true;
        return !types.length && /bat/i.test(getEntityDisplayName(pest));
    }

    getPestLabels(pest) {
        const labels = [getEntityDisplayName(pest)];
        const stands = World.getAllEntitiesOfType(ArmorStandEntity);
        if (!stands) return labels;
        for (const stand of stands) {
            const dx = stand.getX() - pest.getX();
            const dy = stand.getY() - pest.getY();
            const dz = stand.getZ() - pest.getZ();
            if (dx * dx + dy * dy + dz * dz > HOLOGRAM_RANGE_SQ) continue;
            labels.push(getEntityDisplayName(stand));
        }
        return labels;
    }

    getPestTypeLabel(pest) {
        const type = this.getPestLabels(pest).map(matchPestType).find(Boolean);
        return type ? type.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pest';
    }

    findReelStand(pest) {
        if (!pest) return null;
        const stands = World.getAllEntitiesOfType(ArmorStandEntity);
        if (!stands) return null;
        for (const stand of stands) {
            if (!isReelPrompt(stand)) continue;
            const dx = stand.getX() - pest.getX();
            const dy = stand.getY() - pest.getY();
            const dz = stand.getZ() - pest.getZ();
            if (dy < -1) continue;
            if (dx * dx + dz * dz <= REEL_STAND_RANGE_SQ && dy * dy <= 9) return stand;
        }
        return null;
    }

    distanceTo(entity) {
        const dx = entity.getX() - Player.getX();
        const dy = entity.getY() - Player.getY();
        const dz = entity.getZ() - Player.getZ();
        return Math.hypot(dx, dy, dz);
    }

    finish(result) {
        this.lastResult = result;
        this.cleanup();
        this.status = STATES.IDLE;
        return true;
    }

    resetCapture() {
        this.pest = null;
        this.pestId = null;
        this.trackedId = null;
        this.trackedAt = 0;
        this.castAt = 0;
        this.lastReelAt = 0;
        this.reelCount = 0;
        this.reelSeenTicks = 0;
        this.reelStandId = null;
        this.flightStartTicks = 0;
        this.groundRecovering = false;
        this.attached = false;
        this.nextActionAt = 0;
        this.hasReportedMissingLasso = false;
        this.status = STATES.IDLE;
    }

    cleanup() {
        Rotations.stop();
        Client.unpressKeys();
        Client.stopMovement();
        this.trackedId = null;
        this.pest = null;
    }

    stop() {
        this.taskMode = false;
        this.lastResult = this.lastResult || 'stopped';
        this.cleanup();
        this.resetCapture();
        this.status = STATES.IDLE;
    }
}

export const pestLasso = new PestLasso();
