import { ModuleBase } from '../../utils/ModuleBase';
import { MacroState } from '../../utils/MacroState';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Rotations } from '../../utils/player/Rotations';
import { Utils } from '../../utils/Utils';

class ExcavatorMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Excavator Macro',
            subcategory: 'Mining',
            description: 'Automatically gets glacite powder from the Fossil Excavator using suspicious scrap.',
            tooltip: 'Glacite Powder Macro',
            theme: '#c4682b',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
            isMacro: true,
            ignoreFailsafes: true,
        });

        this.bindToggleKey();

        this.NODELAY = false;
        this.TICKDELAY = 0;

        this.addToggle(
            'No delay',
            (v) => {
                this.NODELAY = v;
            },
            'Ignores tick delay and clicks as soon as possible'
        );

        this.addSlider(
            'Tick delay',
            1,
            10,
            5,
            (v) => {
                this.TICKDELAY = v;
            },
            'Amount of ticks until the player can click again'
        );

        this.STATES = {
            WAITING: 0,
            OPENING: 1,
            SETUP: 2,
            EXCAVATING: 3,
            AUTO_COMBINING: 4,
            REFILLING_SCRAP: 5,
        };

        this.state = this.STATES.OPENING;

        this.inExcavator = false;
        this.tickCount = this.TICKDELAY || 0;
        this.blacklistedSlots = new Map();
        this.noScrapMisses = 0;
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.warpCooldownTicks = 0;

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => Object.keys(this.STATES).find((key) => this.STATES[key] === this.state) || 'Unknown',
                },
            },
        ]);

        this.on('tick', () => {
            this.updateBlacklistedSlots();

            if (this.handleAutoTravel()) {
                return;
            }

            if (this.inExcavator) {
                if (Guis.guiName() !== 'Fossil Excavator') {
                    this.message('Excavator closed.');
                    this.toggle(false);
                    return;
                }
            }

            switch (this.state) {
                case this.STATES.OPENING:
                    if (Player.lookingAt() instanceof Entity && !this.inExcavator) {
                        Keybind.rightClick();
                        this.state = this.STATES.SETUP;
                    } else {
                        if (Rotations.isRotating) return;
                        Rotations.rotateToVector([19, 120 + 1, 227]);
                    }

                    break;
                case this.STATES.SETUP:
                    if (Guis.guiName() !== 'Fossil Excavator') return;
                    this.inExcavator = true;

                    if (!this.clickDelay()) return;
                    Guis.clickItem('Start Excavator', true, 'MIDDLE');
                    this.state = this.STATES.EXCAVATING;
                    break;
                case this.STATES.EXCAVATING:
                    if (Guis.guiName() !== 'Fossil Excavator') return;

                    const brownSlots = [];
                    const container = Player.getContainer();
                    if (!container) return;
                    for (let i = 0; i < 54; i++) {
                        if (this.isSlotBlacklisted(i)) continue;

                        let slot = container.getStackInSlot(i);

                        if (slot?.type?.getRegistryName()?.includes('black_stained')) {
                            this.state = this.STATES.SETUP;
                            return;
                        }

                        if (slot?.type?.getRegistryName()?.includes('yellow_stained')) {
                            Guis.closeInv();
                            this.inExcavator = false;
                            this.state = this.STATES.OPENING;
                            return;
                        }

                        if (slot?.type?.getRegistryName()?.includes('lime_stained')) {
                            if (!this.clickDelay()) return;
                            Guis.clickSlot(i);
                            this.blacklistSlot(i, 10);
                            return;
                        }

                        if (slot?.type?.getRegistryName()?.includes('brown_stained')) brownSlots.push(i);
                    }

                    if (brownSlots.length > 0) {
                        const randomIndex = Math.floor(Math.random() * brownSlots.length);
                        const randomBrownSlot = brownSlots[randomIndex];

                        if (!this.clickDelay()) return;

                        Guis.clickSlot(randomBrownSlot);
                        this.blacklistSlot(randomBrownSlot, 10);
                        return;
                    }
                    break;
                case this.STATES.AUTO_COMBINING: {
                    const autoCombine = this.getAutoCombineModule();
                    if (autoCombine?.enabled) return;

                    this.refillCommandSent = false;
                    this.refillDelayTicks = 0;
                    this.state = this.STATES.REFILLING_SCRAP;
                    return;
                }
                case this.STATES.REFILLING_SCRAP:
                    if (Player.getContainer()) {
                        Guis.closeInv();
                        return;
                    }

                    if (!this.refillCommandSent) {
                        ChatLib.command('gfs SUSPICIOUS_SCRAP 2240');
                        this.refillCommandSent = true;
                        this.refillDelayTicks = 40;
                        return;
                    }

                    if (this.hasSuspiciousScrap()) {
                        this.resumeExcavatorLoop();
                        return;
                    }

                    if (this.refillDelayTicks > 0) {
                        this.refillDelayTicks--;
                        return;
                    }

                    this.resumeExcavatorLoop();
                    return;
            }
        });
    }

    handleAutoTravel() {
        if (Utils.area() !== 'Dwarven Mines') {
            if (Player.getContainer()) Guis.closeInv();
            if (Pathfinder.isPathing()) Pathfinder.resetPath();
            Rotations.stopRotation();

            if (this.warpCooldownTicks > 0) {
                this.warpCooldownTicks--;
                return true;
            }

            ChatLib.command('warp camp');
            this.warpCooldownTicks = 70;
            return true;
        }

        this.warpCooldownTicks = 0;

        const distance = Math.hypot(Player.getX() - 19, Player.getY() - 120, Player.getZ() - 227);

        if (distance > 3) {
            if (Player.getContainer()) Guis.closeInv();
            Rotations.stopRotation();

            if (!Pathfinder.isPathing()) {
                Pathfinder.resetPath();
                Pathfinder.findPath([[19, 120, 227]], () => {
                    if (!this.enabled) return;
                    this.state = this.STATES.OPENING;
                });
            }
            return true;
        }

        return false;
    }

    handleNoScrap() {
        this.message('&cNo scrap! Running Auto Combine and refilling.');
        this.inExcavator = false;
        this.noScrapMisses = 0;
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;

        if (Player.getContainer()) Guis.closeInv();

        const autoCombine = this.getAutoCombineModule();
        if (autoCombine && !autoCombine.enabled) {
            autoCombine.toggle(true, true);
        }

        this.state = this.STATES.AUTO_COMBINING;
    }

    getAutoCombineModule() {
        return MacroState.getModule('Auto Combine');
    }

    hasSuspiciousScrap() {
        return Guis.findItemInInventory('Suspicious Scrap') !== -1;
    }

    resumeExcavatorLoop() {
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.inExcavator = false;
        this.noScrapMisses = 0;
        this.state = this.STATES.OPENING;
    }

    clickItem(name, shift = false, button = 'LEFT', displayName = true, startSlot = 0) {
        const container = Player.getContainer();
        if (!container) return false;

        const items = container.getItems();
        if (!items) return false;

        const targetName = name.toLowerCase();
        for (let i = startSlot; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            const itemName = displayName !== false ? ChatLib.removeFormatting(String(item.getName?.() || '')) : String(item.type?.getRegistryName?.() || '');
            if (!itemName) continue;

            if (itemName.toLowerCase().includes(targetName)) {
                return Guis.clickSlot(i, shift, button);
            }
        }

        return false;
    }

    updateBlacklistedSlots() {
        for (const [slot, ticks] of this.blacklistedSlots) {
            if (ticks <= 1) {
                this.blacklistedSlots.delete(slot);
                continue;
            }

            this.blacklistedSlots.set(slot, ticks - 1);
        }
    }

    isSlotBlacklisted(slot) {
        return this.blacklistedSlots.has(slot);
    }

    blacklistSlot(slot, ticks) {
        this.blacklistedSlots.set(slot, ticks);
    }

    clickDelay() {
        if (this.NODELAY) return true;

        if (this.tickCount > 0) {
            this.tickCount--;
            return false;
        }

        this.tickCount = this.TICKDELAY;
        return true;
    }

    onEnable() {
        this.message('&aEnabled');
        this.state = this.STATES.OPENING;
        this.warpCooldownTicks = 0;
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.inExcavator = false;
        this.blacklistedSlots.clear();
        this.noScrapMisses = 0;
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.warpCooldownTicks = 0;
        Pathfinder.resetPath();
        Rotations.stopRotation();
    }
}

new ExcavatorMacro();
