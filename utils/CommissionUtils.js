import { FastEtherwarp } from './FastEtherwarp';
import { distanceToPlayerPoint, fastDistance } from './Math';
import Pathfinder from './pathfinder/PathFinder';
import { clickSlot, findItemInHotbar, getGuiName, setItemSlot } from './player/Inventory';
import { Rotations } from './player/Rotations';

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
    }

    handle() {
        if (!Player.getPlayer()) return;

        if (getGuiName() === 'Commissions') {
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
        const target = [closest[0] + 0.5, closest[1] + 1.8, closest[2] + 0.5];

        if (closest[1] - Player.getY() > 3 && closestDist < 10) {
            this.pathToNpc(locations);
            return;
        }

        if (distanceToPlayerPoint(target) <= 3 && !this.isPathing()) {
            if (!this.ensureToolEquipped()) return;
            if (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) >= 0.04) return;

            if (!Rotations.active) {
                this.npcRotationPending = true;
                const token = ++this.npcRotationToken;
                Rotations.lookAtVector(target);
                Rotations.onComplete(() => {
                    if (!this.npcRotationPending || this.npcRotationToken !== token) return;
                    this.npcRotationPending = false;
                    if (!this.isClaiming() || this.isPathing()) return;
                    if (!this.canInteract()) return;
                    Client.leftClick();
                    this.delay(10);
                });
            }
            return;
        }

        this.pathToNpc(locations);
    }

    pathToNpc(locations) {
        if (this.isPathing()) return;

        this.onPathStart();
        const walk = () => {
            Pathfinder.findPath(locations, (success) => {
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
