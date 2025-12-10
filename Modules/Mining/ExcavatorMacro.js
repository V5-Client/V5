import { Chat } from '../../utils/Chat';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import MacroState from '../../utils/MacroState';

class ExcavatorMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Excavator Macro',
            subcategory: 'Mining',
            description: 'Completes Commissions for you',
            tooltip: 'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
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

        this.clickedScrap = false;
        this.clickedChisel = false;
        this.inExcavator = false;
        this.tickCount = this.TICKDELAY || 0;

        this.on('tick', () => {
            if (Utils.subArea() !== 'Fossil Research Center') {
                this.toggle(false);
                this.message('&cNot in the Research Center!');
            }

            if (this.inExcavator) {
                if (Guis.guiName() !== 'Fossil Excavator') {
                    this.message('Excavator closed');
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

                        let chisel = Guis.clickItem('minecraft:armor_stand', true, 'MIDDLE', false);

                        if (!chisel) {
                            this.message('&cNo chisel!');
                            this.toggle(false);
                            return;
                        }

                        this.clickedChisel = true;
                    }

                    if (this.clickedChisel && !this.clickedScrap) {
                        if (!this.clickDelay()) return;

                        let scrap = Guis.clickItem('Suspicious Scrap');

                        if (!scrap) {
                            this.message('&cNo scrap!');
                            this.toggle(false);
                            return;
                        }

                        this.clickedScrap = true;
                    }

                    if (this.clickedChisel && this.clickedScrap) {
                        if (!this.clickDelay()) return;

                        if (this.NODELAY) {
                            let chiselSlot = Player.getContainer().getStackInSlot(14);
                            if (!chiselSlot) return;
                        }

                        Guis.clickItem('Start Excavator', true, 'MIDDLE');
                    }

                    this.state = this.STATES.EXCAVATING;
                    break;
                case this.STATES.EXCAVATING:
                    if (Guis.guiName() !== 'Fossil Excavator') return;

                    const brownSlots = [];
                    for (let i = 0; i < 54; i++) {
                        let slot = Player.getContainer().getStackInSlot(i);

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
                        }

                        if (slot?.type?.getRegistryName()?.includes('brown_stained')) brownSlots.push(i);
                    }

                    if (brownSlots.length > 0) {
                        const randomIndex = Math.floor(Math.random() * brownSlots.length);
                        const randomBrownSlot = brownSlots[randomIndex];

                        if (!this.clickDelay()) return;

                        Guis.clickSlot(randomBrownSlot);
                        return;
                    }
                    break;
            }
        });
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
        MacroState.setMacroRunning(true);
        this.message('&aEnabled');
        this.state = this.STATES.OPENING;
    }

    onDisable() {
        MacroState.setMacroRunning(false);
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;
        this.clickedChisel = false;
        this.clickedScrap = false;
        this.inExcavator = false;
    }

    message(msg) {
        Chat.message('&#c95b10Excavator Macro: &f' + msg);
    }
}

new ExcavatorMacro();
