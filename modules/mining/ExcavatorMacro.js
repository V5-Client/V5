import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Utils } from '../../utils/Utils';
class ExcavatorMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Excavator Macro',
            subcategory: 'Mining',
            description: 'Automatically gets glacite powder from the Fossil Excavator using suspicious scrap.',
            tooltip: 'Glacite Powder Macro',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
            isMacro: true,
        });

        this.bindToggleKey();
        this.setTheme('#c4682b');

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

        this.clickedScrap = false;
        this.clickedChisel = false;
        this.inExcavator = false;
        this.tickCount = this.TICKDELAY || 0;
        this.blacklistedSlots = new Map();

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => Object.keys(this.STATES).find((key) => this.STATES[key] === this.state) || 'Unknown',
                    Chisel: () => (this.clickedChisel ? 'Yes' : 'No'),
                    Scrap: () => (this.clickedScrap ? 'Yes' : 'No'),
                },
            },
        ]);

        this.on('tick', () => {
            this.updateBlacklistedSlots();

            if (Utils.subArea() !== 'Fossil Research Center') {
                this.message('&cNot in the Research Center!');
                this.toggle(false);
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
                    }

                    break;
                case this.STATES.SETUP:
                    if (Guis.guiName() !== 'Fossil Excavator') return;

                    this.inExcavator = true;

                    if (!this.clickedChisel) {
                        if (!this.clickDelay()) return;

                        let chisel = this.clickItem('minecraft:armor_stand', true, 'MIDDLE', false, 16);

                        if (!chisel) {
                            this.message('&cNo chisel!');
                            //this.toggle(false);
                            //return;
                        }

                        this.clickedChisel = true;
                    }

                    if (this.clickedChisel && !this.clickedScrap) {
                        if (!this.clickDelay()) return;

                        let scrap = this.clickItem('Suspicious Scrap', false, 'LEFT', true, 16);

                        if (!scrap) {
                            this.message('&cNo scrap!');
                            //this.toggle(false);
                            //return;
                        }

                        this.clickedScrap = true;
                        return;
                    }

                    if (this.clickedChisel && this.clickedScrap) {
                        if (!this.clickDelay()) return;

                        Guis.clickItem('Start Excavator', true, 'MIDDLE');
                    }
                    this.state = this.STATES.EXCAVATING;
                    break;
                case this.STATES.EXCAVATING:
                    if (Guis.guiName() !== 'Fossil Excavator') return;

                    const brownSlots = [];
                    for (let i = 0; i < 54; i++) {
                        if (this.isSlotBlacklisted(i)) continue;

                        let slot = Player.getContainer().getStackInSlot(i);

                        if (slot?.type?.getRegistryName()?.includes('black_stained')) {
                            this.clickedScrap = false;

                            this.clickedChisel = false;
                            this.state = this.STATES.SETUP;
                            return;
                        }

                        if (slot?.type?.getRegistryName()?.includes('yellow_stained')) {
                            Guis.closeInv();
                            this.clickedChisel = false;
                            this.clickedScrap = false;
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
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.clickedChisel = false;
        this.clickedScrap = false;
        this.inExcavator = false;
        this.blacklistedSlots.clear();
    }
}

new ExcavatorMacro();
