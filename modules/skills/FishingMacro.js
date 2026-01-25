import { Keybind } from '../../utils/player/Keybinding';
import { Guis } from '../../utils/player/Inventory';
import { ModuleBase } from '../../utils/ModuleBase';
import { OverlayManager } from '../../gui/OverlayUtils';
import { Rotations } from '../../utils/player/Rotations';
import { ArmorStandEntity } from '../../utils/Constants';
import { Chat } from '../../utils/Chat';
import { Mouse } from '../../utils/Ungrab';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Skills',
            description: 'Fishing Macro for stridersurfer',
            tooltip: 'Fishing Macro for stridersurfer',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.tickDelay = 0;
        this.step = 0;

        this.flaySlot = 0;
        this.axeSlot = 0;
        this.rodSlot = 0;
        this.totemSlot = 0;

        this.autoTotem = false;

        this.petSwapKill = false;
        this.petSlotKill = 10;

        this.petSwapRecast = false;
        this.petSlotRecast = 10;

        this.pendingPetSlot = null;

        this.on('tick', () => {
            this.tick();
        });

        this.addSlider('Flay Slot', 0, 8, 1, (v) => (this.flaySlot = v));
        this.addSlider('Axe Slot', 0, 8, 1, (v) => (this.axeSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
        this.addToggle('Auto totem of corruption', (v) => (this.autoTotem = v));
        this.addSlider('Totem Slot', 0, 8, 0, (v) => (this.totemSlot = v));
        this.addToggle('Pet swap after kill', (v) => (this.petSwapKill = v));
        this.addToggle('Pet swap after recast', (v) => (this.petSwapRecast = v));
        this.addSlider('Pet slot (kill)', 10, 43, 10, (v) => (this.petSlotKill = v));
        this.addSlider('Pet slot (recast)', 10, 43, 10, (v) => (this.petSlotRecast = v));

        this.stridersurferTarget = null;
        this.waitingForStriderSwing = false;
        this.waitingForRotationReset = false;
        this.previousYaw = null;
        this.previousPitch = null;
        this.kills = 0;
        this.lastStriderCount = null;
        this.sessionStart = null;
        this.pausedTimeMs = 0;
        this.lastDisableTime = null;

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    Phase: () => this.getStepDescription(),
                },
            },
            {
                title: 'Performance',
                data: {
                    Kills: () => this.kills,
                    'Kills/hr': () => this.getKillsPerHour(),
                    'XP Earned': () => this.getXpEarned(),
                    'XP/hr': () => this.getXpPerHour(),
                },
            },
        ]);
    }
    tick() {
        this.updateKillCounter();

        if (this.tickDelay > 0) {
            this.tickDelay--;
            return;
        }

        switch (this.step) {
            case 0: {
                const armorStands = World.getAllEntitiesOfType(ArmorStandEntity);
                const closeStridersurfer = this.getNearbyStridersurfer(armorStands);
                if (closeStridersurfer) {
                    this.previousYaw = Player.getPlayer().getYaw();
                    this.previousPitch = Player.getPlayer().getPitch();
                    this.stridersurferTarget = closeStridersurfer;
                    Guis.setItemSlot(this.axeSlot);
                    this.step = 100;
                    this.tickDelay = 0;
                    break;
                }
                const target = armorStands.find((element) => element.getName() === '!!!');
                if (!target) return;

                Keybind.rightClick();

                const striderCount = armorStands.reduce((acc, entity) => (entity.getName().includes('Stridersurfer') ? acc + 1 : acc), 0);
                if (striderCount > 27) {
                    Keybind.setKey('shift', true);
                    this.step = 1; // kill
                } else {
                    this.step = 20; // recast
                }
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 1: {
                this.step = 2;
                Keybind.setKey('shift', true);
                if (this.autoTotem) {
                    const totemExists = World.getAllEntitiesOfType(ArmorStandEntity).find((element) => element.getName() === 'Totem of Corruption');
                    if (totemExists) return;

                    Guis.setItemSlot(this.totemSlot);
                    Rotations.rotateToAngles(95, 54);
                    Rotations.onEndRotation(() => {
                        Keybind.rightClick();
                        Client.scheduleTask(2, () => {
                            Rotations.rotateToAngles(23, 8);
                        });
                    });
                    this.tickDelay = 19 + this.randomTickDelay();
                } else {
                    this.tickDelay = this.randomTickDelay();
                }
                break;
            }
            case 2:
                Guis.setItemSlot(this.flaySlot);
                this.tickDelay = this.randomTickDelay();
                Keybind.setKey('shift', true);
                if (this.petSwapKill) {
                    this.pendingPetSlot = this.petSlotKill;
                    this.step = 30;
                } else {
                    this.step = 4;
                }
                break;
            case 3:
                // i cba changing all of them to fix this gap
                break;
            case 4:
                Keybind.rightClick();
                Keybind.setKey('shift', true);
                this.step = 5;
                this.tickDelay = 0;
                break;
            case 5:
                Guis.setItemSlot(this.axeSlot);
                Keybind.setKey('shift', true);
                this.step = 6;
                this.tickDelay = 5 + this.randomTickDelay();
                break;
            case 6:
                Guis.setItemSlot(this.flaySlot);
                Keybind.setKey('shift', true);
                this.step = 7;
                this.tickDelay = this.randomTickDelay();
                break;
            case 7:
                Keybind.rightClick();
                Keybind.setKey('shift', true);
                this.step = 8;
                this.tickDelay = 0;
                break;
            case 8:
                Guis.setItemSlot(this.axeSlot);
                Keybind.setKey('shift', false);
                this.step = 9;
                this.tickDelay = 4 + this.randomTickDelay();
                break;
            case 9:
                Guis.setItemSlot(this.rodSlot);
                this.step = 20;
                this.tickDelay = 1 + this.randomTickDelay();
                break;
            case 20:
                Keybind.rightClick();
                if (this.petSwapRecast) {
                    this.pendingPetSlot = this.petSlotRecast;
                    this.step = 30;
                    this.tickDelay = 1 + this.randomTickDelay();
                } else {
                    this.resetSequence();
                    this.step = 0;
                }
                break;
            case 30:
                ChatLib.command('pets');
                this.step = 31;
                this.tickDelay = 5 + this.randomTickDelay();
                break;
            case 31:
                Guis.clickSlot(this.pendingPetSlot);
                if (this.pendingPetSlot === this.petSlotKill) this.step = 4;
                else {
                    this.resetSequence();
                    this.step = 0;
                }
                break;
            case 100: {
                if (!this.stridersurferTarget || !this.isStridersurferWithinRange(this.stridersurferTarget)) {
                    this.resumeFishingAfterStrider();
                    break;
                }

                const aimPoint = Rotations.getEntityAimPoint(this.stridersurferTarget);
                if (!aimPoint) {
                    this.resumeFishingAfterStrider();
                    break;
                }
                aimPoint.y = aimPoint.y - 1.3;

                this.waitingForStriderSwing = true;
                Rotations.rotateToVector(aimPoint);
                Rotations.onEndRotation(() => {
                    Keybind.leftClick();
                    this.waitingForStriderSwing = false;
                });
                this.step = 101;
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 101: {
                if (this.waitingForStriderSwing || Rotations.isRotating) break;

                this.waitingForRotationReset = true;
                if (this.previousYaw !== null && this.previousPitch !== null) {
                    Rotations.rotateToAngles(this.previousYaw, this.previousPitch);
                    Rotations.onEndRotation(() => {
                        this.waitingForRotationReset = false;
                    });
                } else {
                    this.waitingForRotationReset = false;
                }

                this.step = 102;
                this.tickDelay = this.randomTickDelay();
                break;
            }
            case 102: {
                if (this.waitingForRotationReset || Rotations.isRotating) break;
                this.resumeFishingAfterStrider();
                break;
            }
        }
    }

    resetSequence() {
        this.step = 9;
        this.tickDelay = this.randomTickDelay();
        this.pendingTotem = false;
        this.pendingPetSlot = null;
        this.stridersurferTarget = null;
        this.waitingForStriderSwing = false;
        this.waitingForRotationReset = false;
        this.previousYaw = null;
        this.previousPitch = null;
    }

    randomTickDelay() {
        return 1 + Math.round(Math.random() * 3);
    }

    getStridersurferAimPoint(entity) {
        const aimPoint = Rotations.getEntityAimPoint(entity);
        if (aimPoint) return aimPoint;
    }

    getNearbyStridersurfer(armorStands) {
        const player = Player.getPlayer();
        const playerEyes = player && typeof player.getEyePos === 'function' ? player.getEyePos() : null;
        if (!playerEyes) return null;

        return armorStands.find((entity) => {
            try {
                const name = typeof entity.getName === 'function' ? entity.getName() : null;
                if (!name || !String(name).toLowerCase().includes('stridersurfer')) return false;
                const distance = this.distanceFromEyes(entity, playerEyes);
                return distance !== null && distance <= 3;
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                return false;
            }
        });
    }

    isStridersurferWithinRange(entity) {
        const player = Player.getPlayer();
        const playerEyes = player && typeof player.getEyePos === 'function' ? player.getEyePos() : null;
        if (!playerEyes) return false;
        const distance = this.distanceFromEyes(entity, playerEyes);
        return distance !== null && distance <= 3;
    }

    distanceFromEyes(entity, eyes) {
        const dx = entity.getX() - eyes.x;
        const dy = entity.getY() - 1 - eyes.y;
        const dz = entity.getZ() - eyes.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    resumeFishingAfterStrider() {
        this.stridersurferTarget = null;
        this.waitingForStriderSwing = false;
        this.waitingForRotationReset = false;
        this.previousYaw = null;
        this.previousPitch = null;
        this.step = 9;
        this.tickDelay = this.randomTickDelay();
    }

    updateKillCounter() {
        const currentCount = this.getStridersurferCount();
        if (currentCount === null) return;

        if (this.lastStriderCount !== null) {
            const diff = this.lastStriderCount - currentCount;
            if (diff > 0) {
                this.kills += diff;
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

    getXpEarned() {
        return this.formatNumber(this.kills * 2000);
    }

    getXpPerHour() {
        const hours = this.getActiveHours();
        if (hours <= 0) return '0';
        const xpPerHour = (this.kills * 2000) / hours;
        return this.formatNumber(xpPerHour);
    }

    getKillsPerHour() {
        const hours = this.getActiveHours();
        if (hours <= 0) return '0';
        return this.formatNumber(this.kills / hours);
    }

    formatNumber(value) {
        if (!isFinite(value)) return '0';
        const rounded = Math.round(value);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    getActiveHours() {
        if (!this.sessionStart) return 0;
        const rawElapsed = Date.now() - this.sessionStart;
        const elapsedMs = rawElapsed - this.pausedTimeMs;
        if (elapsedMs <= 0) return 0;
        return elapsedMs / 3600000;
    }

    getStepDescription() {
        switch (this.step) {
            case 0:
                return 'Waiting / fishing';
            case 1:
                return this.autoTotem ? 'Placing totem' : 'Kill prep';
            case 2:
                return 'Equipping flay';
            case 4:
                return 'Kill sequence';
            case 5:
            case 6:
            case 7:
                return 'Killing stridersurfer';
            case 8:
                return 'Resetting stance';
            case 9:
                return 'Equipping rod';
            case 20:
                return 'Recasting';
            case 30:
            case 31:
                return 'Pet swap';
            case 100:
                return 'Stridersurfer engage';
            case 101:
                return 'Resetting rotation';
            case 102:
                return 'Resuming fishing';
            default:
                return `Step ${this.step}`;
        }
    }

    onEnable() {
        Chat.message('Fishing Macro Enabled');

        const now = Date.now();
        const wasRecentlyDisabled = this.lastDisableTime && now - this.lastDisableTime <= 120000;
        if (wasRecentlyDisabled && this.sessionStart) {
            this.pausedTimeMs += now - this.lastDisableTime;
        } else {
            this.kills = 0;
            this.pausedTimeMs = 0;
            this.sessionStart = now;
        }

        this.lastStriderCount = null;
        this.lastDisableTime = null;
        this.updateOverlayUptime(); // this really should be like a overlay util or smth
        this.resetSequence();
        Keybind.setKey('shift', false);
        Mouse.ungrab();
    }

    onDisable() {
        Chat.message('Fishing Macro disabled');
        Keybind.setKey('shift', false);
        this.lastStriderCount = null;
        this.lastDisableTime = Date.now();
        Mouse.regrab();
    }

    updateOverlayUptime() {
        if (!this.oid || !OverlayManager || !OverlayManager.startTimes) return;
        const now = Date.now();
        const activeElapsed = Math.max(0, now - (this.sessionStart || now) - this.pausedTimeMs);
        const adjustedStart = now - activeElapsed;
        OverlayManager.startTimes[this.oid] = adjustedStart;
    }
}

new FishingMacro();
