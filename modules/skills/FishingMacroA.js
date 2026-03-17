//@VIP
import { Chat } from '../../utils/Chat';
import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';

class FishingMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Fishing Macro',
            subcategory: 'Skills',
            description: 'Fishing Macro general hype',
            tooltip: 'Fishing Macro general hype',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.tickDelay = 3;

        this.hypeSlot = 1;
        this.rodSlot = 0;
        this.petSwap = false;
        this.petSlot = 10;
        this.cooldown = 3;
        this.randomCooldown = 1;

        this.hypeClicksRemaining = 2;
        this.hypeClickAmount = 2;
        this.hypeClickAmountThunder = 15;

        this.thunderSpawn = false;
        this.eelSpawn = false;

        this.deployableUsageTime = 0;
        this.deployableCooldown = 180;
        this.deployableSlot = 0;
        this.useDeployable = false;

        this.on('tick', () => {
            this.tick();
        });

        this.on('chat', (event) => {
            let msg = event.message.getString();
            // holy jewish pls fix
            if (msg.includes('Thunder') || msg.includes('thunder')) {
                this.thunderSpawn = true;
            }
            if (msg.includes('fire eel') || msg.includes('Fire Eel')) {
                this.eelSpawn = true;
            }
        });

        this.addSlider('Hype Slot', 0, 8, 1, (v) => (this.hypeSlot = v));
        this.addSlider('Rod Slot', 0, 8, 0, (v) => (this.rodSlot = v));
        this.addToggle('Pet swap', (v) => (this.petSwap = v));
        this.addSlider('Pet slot', 10, 43, 10, (v) => (this.petSlot = v));
        this.addSlider('Tick cooldown', 3, 7, 5, (v) => (this.cooldown = v));
        this.addSlider('Additional random tick cooldown', 0, 5, 2, (v) => (this.randomCooldown = v));
        this.addSlider('Hyperion click amount', 1, 4, 1, (v) => (this.hypeClickAmount = v));
        this.addSlider('Hyperion click amount (thunder)', 1, 50, 1, (v) => (this.hypeClickAmountThunder = v));

        this.addToggle('Use deployable', (v) => (this.useDeployable = v));
        this.addSlider('Deployable slot', 0, 8, 2, (v) => (this.deployableSlot = v));
        this.addSlider('Deployable cooldown', 0, 300, 180, (v) => (this.deployableCooldown = v));

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    Step: () => this.step,
                    Delay: () => this.tickDelay,
                },
            },
        ]);
    }

    tick() {
        if (this.tickDelay > 0) {
            this.tickDelay--;
            return;
        }
        this.tickDelay = Math.round(this.cooldown + this.randomCooldown * Math.random());
        switch (this.step) {
            case -2:
                Guis.setItemSlot(this.rodSlot);
                this.step++;
                break;
            case -1:
                Keybind.rightClick();
                this.step++;
                break;
            case 0: // detect fish bobber pull ready thing
                let stand = World.getAllEntitiesOfType(ArmorStandEntity);
                const target = stand.find((element) => element.getName() === '!!!');
                if (!target) return;
                Keybind.rightClick();
                this.step++;
                break;
            case 1: // swap to hype
                Guis.setItemSlot(this.hypeSlot);
                this.hypeClicksRemaining = this.hypeClickAmount;
                this.step++;
                break;
            case 2: // use hype x times
                if (this.hypeClicksRemaining > 0) {
                    Keybind.rightClick();
                    this.hypeClicksRemaining--;
                } else {
                    if (this.thunderSpawn) {
                        this.thunderSpawn = false;
                        this.hypeClicksRemaining = this.hypeClickAmountThunder;
                    } else {
                        if (this.useDeployable && Date.now() - this.deployableUsageTime > this.deployableCooldown * 1000) {
                            this.step = 3;
                        } else {
                            this.step = 5;
                        }
                    }
                }
                break;
            case 3:
                Guis.setItemSlot(this.deployableSlot);
                this.step++;
                break;
            case 4:
                Keybind.rightClick();
                this.deployableUsageTime = Date.now();
                this.step++;
                break;
            case 5:
                Guis.setItemSlot(this.rodSlot);
                this.step++;
                break;
            case 6:
                if (this.eelSpawn) {
                    this.eelSpawn = false;
                    return;
                }
                Keybind.rightClick();
                if (this.petSwap) {
                    this.step = 7;
                } else {
                    this.step = 0;
                }
                break;
            case 7:
                ChatLib.command('pets');
                this.tickDelay = Math.round((this.cooldown + this.randomCooldown * Math.random()) * 2);
                this.step++;
                break;
            case 8:
                Guis.clickSlot(this.petSlot);
                this.step = 0;
                break;
        }
    }

    onEnable() {
        Chat.message('fishing macro enabled');
        this.step = -2;
        this.tickDelay = 0;
        this.thunderSpawn = false;
        this.eelSpawn = false;
    }

    onDisable() {
        Chat.message('fishing macro un-enabled');
    }
}

new FishingMacro();
