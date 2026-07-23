import { ModuleBase } from '../../utils/ModuleBase';
import { MathUtils } from '../../utils/Math';
import { Guis } from '../../utils/player/Inventory';
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
        };

        this.state = this.STATES.OPENING;

        this.inExcavator = false;
        this.tickCount = this.TICKDELAY || 0;
        this.blacklistedSlots = new Map();
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
                        Client.rightClick();
                        this.state = this.STATES.SETUP;
                    } else {
                        if (Rotations.active) return;
                        Rotations.lookAtVector([19, 120 + 1, 227]);
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
            }
        });
    }

    handleAutoTravel() {
        if (Utils.area() !== 'Dwarven Mines') {
            if (Player.getContainer()) Guis.closeInv();
            if (Pathfinder.isPathing()) Pathfinder.resetPath();
            Rotations.stop();

            if (this.warpCooldownTicks > 0) {
                this.warpCooldownTicks--;
                return true;
            }

            ChatLib.command('warp camp');
            this.warpCooldownTicks = 70;
            return true;
        }

        this.warpCooldownTicks = 0;

        const distance = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), 19, 120, 227);

        if (distance > 3) {
            if (Player.getContainer()) Guis.closeInv();
            Rotations.stop();

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
        this.warpCooldownTicks = 0;
        Pathfinder.resetPath();
        Rotations.stop();
    }
}

new ExcavatorMacro();
