import { MathUtils } from './Math';
import { EtherwarpPathfinder } from './pathfinder/EtherwarpPathfinder';
import Pathfinder from './pathfinder/PathFinder';
import { Guis } from './player/Inventory';
import { Rotations } from './player/Rotations';

const PIGEON_STAGE_ROD = 0;
const PIGEON_STAGE_PIGEON = 1;
const PIGEON_STAGE_CLICK = 2;
const PIGEON_STAGE_TOOL = 3;
const PIGEON_STAGE_WAIT = 4;
const PIGEON_COOLDOWN_MS = 5200;
const PIGEON_MAX_FAIL_STREAK = 3;

export class CommissionClaimer {
    constructor({ getLocations, ensureToolEquipped, isClaiming, delay, onClaimsExhausted, onPathStart, onPathFailed, canInteract, useEtherwarp, rodSlot, getToolSlot }) {
        this.getLocations = getLocations;
        this.ensureToolEquipped = ensureToolEquipped;
        this.isClaiming = isClaiming;
        this.delay = delay;
        this.onClaimsExhausted = onClaimsExhausted;
        this.onPathStart = onPathStart || (() => {});
        this.onPathFailed = onPathFailed || (() => {});
        this.canInteract = canInteract || (() => true);
        this.useEtherwarp = useEtherwarp || (() => false);
        this.getRodSlot = rodSlot || (() => null);
        this.getToolSlot = getToolSlot || (() => -1);
        this.npcRotationPending = false;
        this.npcRotationToken = 0;
        this.pigeonStage = PIGEON_STAGE_ROD;
        this.lastPigeonUseAt = 0;
        this.pigeonFailStreak = 0;
        this.pigeonFallbackActive = false;
    }

    handle() {
        if (!Player.getPlayer()) return;

        if (Guis.guiName() === 'Commissions') {
            this.resetPigeonClaimState();
            const container = Player.getContainer();
            if (!container) return;

            if (claimCompletedCommission(container)) {
                this.delay(10);
            } else {
                this.onClaimsExhausted(container);
            }
            return;
        }

        const rodSlot = this.getRodSlot ? this.getRodSlot() : null;
        const hasRod = typeof rodSlot === 'number' && rodSlot >= 0;

        const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
        if (pigeonSlot !== -1 && !this.pigeonFallbackActive) {
            this.cancelNpcRotation();
            this.handlePigeonClaim(pigeonSlot, rodSlot, hasRod);
            return;
        }

        this.pigeonStage = PIGEON_STAGE_ROD;
        this.handleNpcClaim(hasRod, rodSlot);
    }

    handlePigeonClaim(pigeonSlot, rodSlot, hasRod) {
        const now = Date.now();

        switch (this.pigeonStage) {
            case PIGEON_STAGE_ROD:
                if (hasRod) {
                    if (Player.getHeldItemIndex() !== rodSlot) {
                        Guis.setItemSlot(rodSlot);
                        this.delay(2);
                        return;
                    }
                    Client.rightClick();
                    this.pigeonStage = PIGEON_STAGE_PIGEON;
                    this.delay(2);
                    return;
                }
                this.pigeonStage = PIGEON_STAGE_PIGEON;
                return;

            case PIGEON_STAGE_PIGEON:
                if (Player.getHeldItemIndex() !== pigeonSlot) {
                    Guis.setItemSlot(pigeonSlot);
                    this.delay(2);
                    return;
                }
                this.pigeonStage = PIGEON_STAGE_CLICK;
                return;

            case PIGEON_STAGE_CLICK:
                if (now - this.lastPigeonUseAt < PIGEON_COOLDOWN_MS) {
                    this.pigeonStage = PIGEON_STAGE_WAIT;
                    return;
                }
                Client.rightClick();
                this.lastPigeonUseAt = now;
                this.pigeonStage = PIGEON_STAGE_TOOL;
                this.delay(2);
                return;

            case PIGEON_STAGE_TOOL:
                this.equipToolFast();
                this.pigeonStage = PIGEON_STAGE_WAIT;
                return;

            case PIGEON_STAGE_WAIT:
            default:
                if (now - this.lastPigeonUseAt >= PIGEON_COOLDOWN_MS) {
                    if (++this.pigeonFailStreak >= PIGEON_MAX_FAIL_STREAK) {
                        this.pigeonFailStreak = 0;
                        this.pigeonFallbackActive = true;
                        Chat.message('&cRoyal Pigeon claim failed repeatedly, walking to the emissary instead.');
                        return;
                    }
                    this.pigeonStage = PIGEON_STAGE_ROD;
                    return;
                }
                this.ensureToolEquipped();
                return;
        }
    }

    equipToolFast() {
        const toolSlot = this.getToolSlot();
        if (typeof toolSlot === 'number' && toolSlot >= 0) {
            Guis.setItemSlot(toolSlot);
            return;
        }
        this.ensureToolEquipped();
    }

    handleNpcClaim(hasRod, rodSlot) {
        const locations = this.getLocations();
        if (!locations.length) return;

        const closest = this.getClosestLocation(locations);
        const closestDist = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest);
        const target = [closest[0] + 0.5, closest[1] + 1.8, closest[2] + 0.5];

        if (closest[1] - Player.getY() > 3 && closestDist < 10) {
            this.pathToNpc(locations);
            return;
        }

        if (MathUtils.distanceToPlayerPoint(target) <= 3 && !this.isPathing()) {
            if (!hasRod && !this.ensureToolEquipped()) return;
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

                    if (hasRod) {
                        if (Player.getHeldItemIndex() !== rodSlot) {
                            Guis.setItemSlot(rodSlot);
                            this.delay(1);
                            return;
                        }
                        Client.rightClick();
                        this.delay(10);
                        return;
                    }

                    Client.leftClick();
                    this.delay(10);
                });
            }
            return;
        }

        this.pathToNpc(locations);
    }

    resetPigeonClaimState() {
        this.pigeonStage = PIGEON_STAGE_ROD;
        this.lastPigeonUseAt = 0;
        this.pigeonFailStreak = 0;
        this.pigeonFallbackActive = false;
        this.cancelNpcRotation();
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
        if (!this.useEtherwarp()) {
            walk();
            return;
        }

        let walking = false;
        const fallback = () => {
            if (walking || !this.isClaiming()) return;
            walking = true;
            walk();
        };
        const started = EtherwarpPathfinder.findPath(locations, {
            silent: true,
            goalRadius: 2,
            onSuccess: fallback,
            onFail: fallback,
        });
        if (!started) fallback();
    }

    isPathing() {
        return Pathfinder.isPathing() || EtherwarpPathfinder.isPathing();
    }

    getClosestLocation(locations) {
        return locations.reduce((closest, location) => {
            const closestDist = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest);
            const locationDist = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), ...location);
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

        Guis.clickSlot(i, false);
        return true;
    }
    return false;
}
