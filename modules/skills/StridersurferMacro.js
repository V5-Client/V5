import { OverlayManager } from '../../gui/OverlayUtils';
import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Mouse } from '../../utils/Ungrab';

const STEPS = Object.freeze({
    WAITING_FOR_BITE: 0,
    EQUIP_FLAY: 2,
    START_KILL_COMBO: 4,
    EQUIP_AXE_AFTER_OPEN: 5,
    RE_EQUIP_FLAY: 6,
    FINISH_KILL_COMBO: 7,
    RESET_STANCE: 8,
    EQUIP_ROD: 9,
    CAST_ROD: 20,
    POST_REEL_DECISION: 21,
    RECOVERY_SWAP_BACK_TO_ROD: 22,
    RECOVERY_RECAST_ROD: 23,
    OPEN_PETS: 30,
    CLICK_PET_SLOT: 31,
    SNAP_TO_STRIDER: 100,
    RESTORE_ROTATION: 101,
    RESUME_LOOP: 102,
});

class StridersurferMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Stridersurfer Macro',
            subcategory: 'Skills',
            description: 'Automates the stridersurfer fishing loop and kill sequence',
            tooltip: 'Automates the stridersurfer fishing loop and kill sequence',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.tickDelay = 0;
        this.step = STEPS.WAITING_FOR_BITE;

        this.petNameKill = '';
        this.petNameRecast = '';

        this.pendingPetName = '';
        this.pendingPetPhase = null;

        this.on('tick', () => {
            this.tick();
        });

        this.addTextInput(
            'Pet name (kill)',
            '',
            (v) => (this.petNameKill = this.normalizeInput(v)),
            'Optional. Leave blank to skip the pet swap after the kill combo'
        );
        this.addTextInput(
            'Pet name (recast)',
            '',
            (v) => (this.petNameRecast = this.normalizeInput(v)),
            'Optional. Leave blank to skip the pet swap after recasting'
        );

        this.stridersurferTarget = null;
        this.waitingForStriderSwing = false;
        this.waitingForRotationReset = false;
        this.previousYaw = null;
        this.previousPitch = null;
        this.lastStriderCount = null;
        this.biteWaitStartedAt = 0;

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        Phase: () => this.getStepDescription(),
                    },
                },
                {
                    title: 'Performance',
                    data: {
                        Kills: () => this.getKills(),
                        'Kills/hr': () => this.getKillsPerHour(),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    kills: 0,
                },
            }
        );
    }
    tick() {
        this.updateKillCounter();

        if (this.tickDelay > 0) {
            this.tickDelay--;
            return;
        }

        switch (this.step) {
            case STEPS.WAITING_FOR_BITE:
                const biteIndicator = World.getAllEntitiesOfType(ArmorStandEntity).find((entity) => entity.getName() === '!!!');
                if (!biteIndicator) {
                    if (this.hasBiteWaitTimedOut()) {
                        const rodSlot = this.getRodSlot();
                        if (rodSlot !== -1) {
                            Guis.setItemSlot(rodSlot);
                            this.biteWaitStartedAt = 0;
                            this.transitionTo(STEPS.RECOVERY_SWAP_BACK_TO_ROD, 1 + this.randomTickDelay());
                        }
                    }
                    return;
                }

                this.biteWaitStartedAt = 0;
                Keybind.rightClick();
                this.transitionTo(STEPS.POST_REEL_DECISION);
                break;
            case STEPS.POST_REEL_DECISION:
                const armorStands = World.getAllEntitiesOfType(ArmorStandEntity);
                const striderCount = armorStands.reduce((acc, entity) => (entity.getName().includes('Stridersurfer') ? acc + 1 : acc), 0);
                if (striderCount > 24) {
                    this.transitionTo(STEPS.EQUIP_FLAY);
                    return;
                }

                const closeStridersurfer = this.getNearbyStridersurfer(armorStands);
                if (closeStridersurfer) {
                    this.previousYaw = Player.getPlayer().getYaw();
                    this.previousPitch = Player.getPlayer().getPitch();
                    this.stridersurferTarget = closeStridersurfer;
                    Guis.setItemSlot(this.getAxeSlot());
                    this.transitionTo(STEPS.SNAP_TO_STRIDER, 0);
                    return;
                }

                this.transitionTo(STEPS.CAST_ROD);
                break;
            case STEPS.RECOVERY_SWAP_BACK_TO_ROD:
                Guis.setItemSlot(this.getRodSlot());
                this.transitionTo(STEPS.RECOVERY_RECAST_ROD, 1 + this.randomTickDelay());
                break;
            case STEPS.RECOVERY_RECAST_ROD:
                Keybind.rightClick();
                this.biteWaitStartedAt = Date.now();
                this.transitionTo(STEPS.WAITING_FOR_BITE, 1 + this.randomTickDelay());
                break;
            case STEPS.EQUIP_FLAY:
                Guis.setItemSlot(this.getFlaySlot());

                if (this.shouldSwapPet(this.petNameKill)) {
                    this.startPetSwap(this.petNameKill, 'kill');
                    return;
                }

                Keybind.setKey('shift', true);
                this.transitionTo(STEPS.START_KILL_COMBO);
                break;
            case STEPS.START_KILL_COMBO:
                Keybind.rightClick();
                Keybind.setKey('shift', true);
                this.transitionTo(STEPS.EQUIP_AXE_AFTER_OPEN, 1);
                break;
            case STEPS.EQUIP_AXE_AFTER_OPEN:
                Guis.setItemSlot(this.getAxeSlot());
                Keybind.setKey('shift', true);
                this.transitionTo(STEPS.RE_EQUIP_FLAY, 7 + this.randomTickDelay());
                break;
            case STEPS.RE_EQUIP_FLAY:
                Guis.setItemSlot(this.getFlaySlot());
                Keybind.setKey('shift', true);
                this.transitionTo(STEPS.FINISH_KILL_COMBO);
                break;
            case STEPS.FINISH_KILL_COMBO:
                Keybind.rightClick();
                Keybind.setKey('shift', true);
                this.transitionTo(STEPS.RESET_STANCE, 0);
                break;
            case STEPS.RESET_STANCE:
                Guis.setItemSlot(this.getAxeSlot());
                Keybind.setKey('shift', false);
                this.transitionTo(STEPS.EQUIP_ROD, 4 + this.randomTickDelay());
                break;
            case STEPS.EQUIP_ROD:
                Guis.setItemSlot(this.getRodSlot());
                this.transitionTo(STEPS.CAST_ROD, 1 + this.randomTickDelay());
                break;
            case STEPS.CAST_ROD:
                Keybind.rightClick();
                this.biteWaitStartedAt = Date.now();

                if (this.shouldSwapPet(this.petNameRecast)) {
                    this.startPetSwap(this.petNameRecast, 'recast');
                    return;
                }

                this.restartWaitingForBite();
                break;
            case STEPS.OPEN_PETS:
                ChatLib.command('pets');
                this.transitionTo(STEPS.CLICK_PET_SLOT, 4 + this.randomTickDelay());
                break;
            case STEPS.CLICK_PET_SLOT:
                if (!this.shouldSwapPet(this.pendingPetName) || !Guis.clickItem(this.pendingPetName, false, 'LEFT', true, false)) {
                    Guis.closeInv();
                }

                if (this.pendingPetPhase === 'kill') {
                    this.clearPendingPetSwap();
                    this.transitionTo(STEPS.START_KILL_COMBO, 1 + this.randomTickDelay());
                    return;
                }

                this.restartWaitingForBite();
                break;
            case STEPS.SNAP_TO_STRIDER:
                if (!this.stridersurferTarget || !this.isStridersurferWithinRange(this.stridersurferTarget)) {
                    this.resumeLoopAfterStrider();
                    return;
                }

                const aimPoint = Rotations.getEntityAimPoint(this.stridersurferTarget);
                if (!aimPoint) {
                    this.resumeLoopAfterStrider();
                    return;
                }

                aimPoint.y = aimPoint.y - 1.3;

                this.waitingForStriderSwing = true;
                Rotations.rotateToVector(aimPoint);
                Rotations.onEndRotation(() => {
                    Keybind.leftClick();
                    this.waitingForStriderSwing = false;
                });
                this.transitionTo(STEPS.RESTORE_ROTATION);
                break;
            case STEPS.RESTORE_ROTATION:
                if (this.waitingForStriderSwing || Rotations.isRotating) return;

                this.waitingForRotationReset = true;
                if (this.previousYaw !== null && this.previousPitch !== null) {
                    Rotations.rotateToAngles(this.previousYaw, this.previousPitch);
                    Rotations.onEndRotation(() => {
                        this.waitingForRotationReset = false;
                    });
                } else {
                    this.waitingForRotationReset = false;
                }

                this.transitionTo(STEPS.RESUME_LOOP);
                break;
            case STEPS.RESUME_LOOP:
                if (this.waitingForRotationReset || Rotations.isRotating) break;
                this.resumeLoopAfterStrider();
                break;
        }
    }

    restartWaitingForBite() {
        this.clearPendingPetSwap();
        this.clearStriderState();
        this.transitionTo(STEPS.WAITING_FOR_BITE);
    }

    transitionTo(step, delay = this.randomTickDelay()) {
        this.step = step;
        this.tickDelay = delay;
    }

    startPetSwap(name, phase) {
        this.pendingPetName = name;
        this.pendingPetPhase = phase;
        this.transitionTo(STEPS.OPEN_PETS);
    }

    clearPendingPetSwap() {
        this.pendingPetName = '';
        this.pendingPetPhase = null;
    }

    clearStriderState() {
        this.stridersurferTarget = null;
        this.waitingForStriderSwing = false;
        this.waitingForRotationReset = false;
        this.previousYaw = null;
        this.previousPitch = null;
    }

    randomTickDelay() {
        return 1 + Math.round(Math.random() * 3);
    }

    normalizeInput(value) {
        return String(value || '').trim();
    }

    normalizeName(value) {
        return ChatLib.removeFormatting(String(value || ''))
            .trim()
            .toLowerCase();
    }

    shouldSwapPet(name) {
        return this.normalizeInput(name).length > 0;
    }

    getFlaySlot() {
        return this.findHotbarSlotByNames(['Soul Whip', 'Flaming Flay']);
    }

    getAxeSlot() {
        return this.findHotbarSlotByNames(['Figstone Splitter', 'axe']);
    }

    getRodSlot() {
        return this.findHotbarSlotByNames(['Rod']);
    }

    findHotbarSlotByNames(names) {
        const inventory = Player.getInventory();
        if (!inventory) return -1;

        for (let i = 0; i < 9; i++) {
            const stack = inventory.getStackInSlot(i);
            if (!stack || typeof stack.getName !== 'function') continue;

            const itemName = this.normalizeName(stack.getName());
            if (!itemName) continue;

            if (names.some((name) => this.itemNameMatches(itemName, name))) return i;
        }

        return -1;
    }

    itemNameMatches(itemName, target) {
        const normalizedTarget = this.normalizeName(target);
        if (!normalizedTarget) return false;
        if (normalizedTarget.includes(' ')) return itemName.includes(normalizedTarget);

        const escapedTarget = normalizedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?:^|[^a-z0-9])${escapedTarget}(?:$|[^a-z0-9])`);
        return pattern.test(itemName);
    }

    getNearbyStridersurfer(armorStands) {
        const player = Player.getPlayer();
        if (!player) return null;
        const eyes = player.getEyePos();
        if (!eyes) return null;

        return armorStands.find((entity) => {
            try {
                const name = entity.getName();
                if (!name || !String(name).toLowerCase().includes('stridersurfer')) return false;
                const distance = this.distanceFromEyes(entity, eyes);
                return distance !== null && distance <= 3;
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                return false;
            }
        });
    }

    isStridersurferWithinRange(entity) {
        const player = Player.getPlayer();
        if (!player) return false;
        const eyes = player.getEyePos();
        if (!eyes) return false;

        const distance = this.distanceFromEyes(entity, eyes);
        return distance !== null && distance <= 3;
    }

    distanceFromEyes(entity, eyes) {
        const dx = entity.getX() - eyes.x;
        const dy = entity.getY() - 1 - eyes.y;
        const dz = entity.getZ() - eyes.z;
        return Math.hypot(dx, dy, dz);
    }

    resumeLoopAfterStrider() {
        this.clearStriderState();
        this.transitionTo(STEPS.EQUIP_ROD);
    }

    hasBiteWaitTimedOut() {
        return this.biteWaitStartedAt > 0 && Date.now() - this.biteWaitStartedAt >= 8000;
    }

    updateKillCounter() {
        const currentCount = this.getStridersurferCount();
        if (currentCount === null) return;

        if (this.lastStriderCount !== null) {
            const diff = this.lastStriderCount - currentCount;
            if (diff > 0) {
                OverlayManager.incrementTrackedValue(this.oid, 'kills', diff);
            }
        }

        this.lastStriderCount = currentCount;
    }

    getStridersurferCount() {
        try {
            const armorStands = World.getAllEntitiesOfType(ArmorStandEntity);
            return armorStands.reduce((acc, entity) => {
                try {
                    const name = typeof entity.getName === 'function' ? entity.getName() : null;
                    if (name && String(name).includes('Stridersurfer')) return acc + 1;
                } catch (e) {
                    console.error('V5 Caught error' + e + e.stack);
                }
                return acc;
            }, 0);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return null;
        }
    }

    getKills() {
        return OverlayManager.getTrackedValue(this.oid, 'kills', 0);
    }

    getKillsPerHour() {
        const hours = this.getActiveHours();
        if (hours <= 0) return '0';
        return this.formatNumber(this.getKills() / hours);
    }

    formatNumber(value) {
        if (!Number.isFinite(value)) return '0';
        const rounded = Math.round(value);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    getActiveHours() {
        const elapsedMs = OverlayManager.getSessionElapsedMs(this.oid);
        if (elapsedMs <= 0) return 0;
        return elapsedMs / 3600000;
    }

    getStepDescription() {
        switch (this.step) {
            case STEPS.WAITING_FOR_BITE:
                return 'Waiting for bite';
            case STEPS.EQUIP_FLAY:
                return 'Equipping flay';
            case STEPS.START_KILL_COMBO:
                return 'Starting kill combo';
            case STEPS.EQUIP_AXE_AFTER_OPEN:
            case STEPS.RE_EQUIP_FLAY:
            case STEPS.FINISH_KILL_COMBO:
                return 'Killing stridersurfer';
            case STEPS.RESET_STANCE:
                return 'Resetting stance';
            case STEPS.EQUIP_ROD:
                return 'Equipping rod';
            case STEPS.POST_REEL_DECISION:
                return 'Checking catch';
            case STEPS.RECOVERY_SWAP_BACK_TO_ROD:
            case STEPS.RECOVERY_RECAST_ROD:
                return 'Recovering rod';
            case STEPS.CAST_ROD:
                return 'Casting rod';
            case STEPS.OPEN_PETS:
            case STEPS.CLICK_PET_SLOT:
                return 'Pet swap';
            case STEPS.SNAP_TO_STRIDER:
                return 'Engaging stridersurfer';
            case STEPS.RESTORE_ROTATION:
                return 'Resetting rotation';
            case STEPS.RESUME_LOOP:
                return 'Resuming loop';
            default:
                return `Step ${this.step}`;
        }
    }

    onEnable() {
        this.message('&aEnabled');
        this.lastStriderCount = null;
        this.clearPendingPetSwap();
        this.clearStriderState();
        this.transitionTo(STEPS.EQUIP_ROD);
        Keybind.setKey('shift', false);
        Mouse.ungrab();
    }

    onDisable() {
        this.message('&cDisabled');
        Keybind.setKey('shift', false);
        this.lastStriderCount = null;
        this.biteWaitStartedAt = 0;
        Mouse.regrab();
    }
}

new StridersurferMacro();
