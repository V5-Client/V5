import { FastEtherwarp } from './FastEtherwarp';
import { distanceToPlayerPoint, fastDistance } from './Math';
import Pathfinder from './pathfinder/PathFinder';
import { clickSlot, findItemInHotbar, getGuiName, setItemSlot } from './player/Inventory';
import { Rotations } from './player/Rotations';
import { angleDifference, getCurrentRotation } from './player/RotationGCD';
import { MCHand, Vec3d } from './Constants';
import { ServerboundInteractPacket, createSwingPacket } from './Packets';

const NPC_AIM_HEIGHT = 1.0; // body centre of a player-sized NPC
const NPC_MAX_CLICK_ATTEMPTS = 6;
const NPC_SEARCH_RADIUS = 3;
const NPC_AIM_TOLERANCE = 6; // degrees
const NPC_REACH = 4;
const NPC_MAX_REACH = 6;
const NPC_REPATH_COOLDOWN_MS = 3000;
const NPC_MAX_AIM_TICKS = 40; // stop a rotation that hasn't landed on the NPC within 2 seconds

export class CommissionClaimer {
    constructor({
        getLocations,
        ensureToolEquipped,
        isClaiming,
        delay,
        onClaimsExhausted,
        onPathStart = null,
        onPathFailed = null,
        canInteract = null,
        getTravelMode = null,
    }) {
        this.getLocations = getLocations;
        this.ensureToolEquipped = ensureToolEquipped;
        this.isClaiming = isClaiming;
        this.delay = delay;
        this.onClaimsExhausted = onClaimsExhausted;
        this.onPathStart = onPathStart || (() => {});
        this.onPathFailed = onPathFailed || (() => {});
        this.canInteract = canInteract || (() => true);
        this.getTravelMode = getTravelMode || (() => 'Walk');
        this.npcRotationPending = false;
        this.npcRotationToken = 0;
        this.npcClickAttempts = 0;
        this.npcAimTicks = 0;
        this.trackedNpcId = null;
        this.lastPathEndAt = 0;
    }

    getNpcReach(npc) {
        const player = Player.getPlayer();
        const box = npc.toMC().getBoundingBox();
        if (!player || !box) return Infinity;
        const eyes = player.getEyePosition();
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const dx = eyes.x() - clamp(eyes.x(), box.minX, box.maxX);
        const dy = eyes.y() - clamp(eyes.y(), box.minY, box.maxY);
        const dz = eyes.z() - clamp(eyes.z(), box.minZ, box.maxZ);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    findNpcEntity(location) {
        const cx = location[0] + 0.5;
        const cz = location[2] + 0.5;
        let best = null;
        let bestDist = NPC_SEARCH_RADIUS * NPC_SEARCH_RADIUS;
        for (const entity of World.getAllPlayers()) {
            if (String(entity.getUUID()) === String(Player.getUUID())) continue;
            if (entity.getUUID().version() === 4) continue; // real player
            if (Math.abs(entity.getY() - location[1]) > 2) continue;
            const dx = entity.getX() - cx;
            const dz = entity.getZ() - cz;
            const dist = dx * dx + dz * dz;
            if (dist <= bestDist) {
                best = entity;
                bestDist = dist;
            }
        }
        return best;
    }

    // The NPC's nametag armor stand can block the crosshair raytrace, so also accept being aimed close enough.
    isAimedAtNpc(npc, aimPoint) {
        const looking = Player.lookingAt();
        if (looking instanceof Entity && looking.toMC().getId() === npc.toMC().getId()) return true;

        const target = Rotations.getAnglesFromVector(aimPoint);
        const current = getCurrentRotation();
        if (!target || !current) return false;
        return Math.abs(angleDifference(target.yaw, current.yaw)) <= NPC_AIM_TOLERANCE && Math.abs(target.pitch - current.pitch) <= NPC_AIM_TOLERANCE;
    }

    interactWithNpc(npc) {
        const packet = new ServerboundInteractPacket(npc.toMC().getId(), MCHand.MAIN_HAND, new Vec3d(0.0, NPC_AIM_HEIGHT, 0.0), false);
        Client.sendPacket(packet);
        Client.sendPacket(createSwingPacket());
    }

    stopNpcTracking() {
        if (this.trackedNpcId !== null && Rotations.active) Rotations.stop();
        this.trackedNpcId = null;
        this.npcRotationPending = false;
    }

    handle() {
        if (!Player.getPlayer()) return;

        if (getGuiName() === 'Commissions') {
            this.npcClickAttempts = 0;
            this.npcAimTicks = 0;
            this.stopNpcTracking();
            const container = Player.getContainer();
            if (!container) return;

            if (claimCompletedCommission(container)) {
                this.delay(10);
            } else {
                this.onClaimsExhausted(container);
            }
            return;
        }

        const pigeonSlot = findItemInHotbar('Royal Pigeon');
        if (pigeonSlot !== -1) {
            if (Player.getHeldItemIndex() !== pigeonSlot) {
                setItemSlot(pigeonSlot);
                this.delay(3);
            } else {
                Client.rightClick();
                this.delay(10);
            }
            return;
        }

        const locations = this.getLocations();
        if (!locations.length) return;

        const closest = this.getClosestLocation(locations);
        const closestDist = fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest);

        if (closest[1] - Player.getY() > 3 && closestDist < 10) {
            this.stopNpcTracking();
            this.pathToNpc(locations);
            return;
        }

        const npc = this.findNpcEntity(closest);
        const aimPoint = npc ? Rotations.getAimPoint(npc) : null;
        const target = aimPoint ? [aimPoint.x, aimPoint.y, aimPoint.z] : [closest[0] + 0.5, closest[1] + NPC_AIM_HEIGHT, closest[2] + 0.5];

        const reach = npc ? this.getNpcReach(npc) : distanceToPlayerPoint(target);
        const justArrived = Date.now() - this.lastPathEndAt < NPC_REPATH_COOLDOWN_MS;
        const inRange = reach <= NPC_REACH || (justArrived && npc && reach <= NPC_MAX_REACH);

        if (inRange && !this.isPathing()) {
            if (!this.ensureToolEquipped()) return;
            if (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) >= 0.04) return;

            if (!npc) {
                if (!Rotations.active) Rotations.lookAtVector(target);
                return;
            }

            // trackEntity must only be called once per entity.
            const npcId = npc.toMC().getId();
            if (this.trackedNpcId !== npcId || !Rotations.active) {
                if (Rotations.active) Rotations.stop();
                if (Rotations.trackEntity(npc, { precision: 1 })) {
                    this.trackedNpcId = npcId;
                    this.npcRotationPending = true;
                    this.npcAimTicks = 0;
                }
                return;
            }

            if (!this.isAimedAtNpc(npc, aimPoint)) {
                if (++this.npcAimTicks > NPC_MAX_AIM_TICKS) this.stopNpcTracking();
                return;
            }

            this.npcAimTicks = 0;
            if (!this.canInteract()) return;

            this.interactWithNpc(npc);
            this.npcClickAttempts++;

            if (this.npcClickAttempts >= NPC_MAX_CLICK_ATTEMPTS) {
                this.npcClickAttempts = 0;
                this.stopNpcTracking();
                this.pathToNpc(locations);
            }
            this.delay(10);
            return;
        }

        this.stopNpcTracking();
        // The pathfinder's arrival radius is looser than NPC_REACH; re-pathing immediately loops forever.
        if (justArrived) return;
        this.pathToNpc(locations);
    }

    pathToNpc(locations) {
        if (this.isPathing()) return;

        this.onPathStart();
        const walk = () => {
            Pathfinder.findPath(locations, (success) => {
                if (success) this.lastPathEndAt = Date.now();
                if (!this.isClaiming()) return;
                if (!success) this.onPathFailed();
            });
        };
        const travelMode = this.getTravelMode();
        if (travelMode === 'Walk') {
            walk();
            return;
        }

        let walking = false;
        const fallback = () => {
            this.lastPathEndAt = Date.now();
            if (walking || !this.isClaiming()) return;
            walking = true;
            walk();
        };
        const started = FastEtherwarp.findPath(locations, {
            silent: true,
            goalRadius: 2,
            onSuccess: fallback,
            onFail: fallback,
        });
        if (!started) fallback();
    }

    isPathing() {
        return Pathfinder.isPathing() || FastEtherwarp.isPathing();
    }

    getClosestLocation(locations) {
        return locations.reduce((closest, location) => {
            const closestDist = fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest);
            const locationDist = fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...location);
            return locationDist < closestDist ? location : closest;
        });
    }

    cancelNpcRotationIfPathing() {
        if (this.isPathing()) this.cancelNpcRotation();
    }

    cancelNpcRotation() {
        if (!this.npcRotationPending) return;

        this.npcRotationPending = false;
        this.npcRotationToken++;
        this.trackedNpcId = null;
        if (Rotations.active) Rotations.stop();
    }
}

function claimCompletedCommission(container) {
    for (let i = 9; i < 17; i++) {
        const stack = container.getStackInSlot(i);
        if (!stack) continue;
        if (!(stack.getLore() || []).some((line) => String(line).includes('COMPLETED'))) continue;

        clickSlot(i, false);
        return true;
    }
    return false;
}
