import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { ScheduleTask } from '../../utils/ScheduleTask';

const LOADOUT_SLOTS = [14, 15, 16, 23, 24, 25, 32, 33, 34, 41, 42, 43];
const LOADOUT_GUI = '(1/3) Loadouts';

class LoadoutHandler extends ModuleBase {
    constructor() {
        super({
            name: 'Loadout Settings',
            subcategory: 'Farming',
            description: 'Loadouts used while farming.',
            showEnabledToggle: false,
        });

        this.farmingSlot = 1;
        this.pestSpawningSlot = 1;
        this.pestKillingSlot = 1;
        this.visitorSlot = 1;
        this.pestSpawnSwapCooldown = 140;
        this.currentSlot = null;
        this.armorKey = null;
        this.targetSlot = null;
        this.switching = false;

        this.addSlider('Farming Loadout Slot', 1, 12, this.farmingSlot, (value) => (this.farmingSlot = Math.round(value)));
        this.addSlider('Pest Spawning Loadout Slot', 1, 12, this.pestSpawningSlot, (value) => (this.pestSpawningSlot = Math.round(value)));
        this.addSlider('Pest Killing Loadout Slot', 1, 12, this.pestKillingSlot, (value) => (this.pestKillingSlot = Math.round(value)));
        this.addSlider('Visitor Loadout Slot', 1, 12, this.visitorSlot, (value) => (this.visitorSlot = Math.round(value)));
        this.addSlider(
            'Pest Spawn Swap Cooldown',
            0,
            300,
            this.pestSpawnSwapCooldown,
            (value) => (this.pestSpawnSwapCooldown = Math.round(value)),
            'Switches to the pest spawning loadout at or below this cooldown in seconds.'
        );

        register('tick', () => this.tick());
    }

    isLoadoutGui() {
        return Guis.guiName()?.includes(LOADOUT_GUI);
    }

    forgetEquipped() {
        this.currentSlot = null;
        this.armorKey = null;
        this.targetSlot = null;
        this.switching = false;
    }

    getArmorKey() {
        const names = [];
        const pushItem = (item) => names.push(ChatLib.removeFormatting(String(item?.getName?.() ?? item ?? '')));
        try {
            if (Player.armor?.getSize) {
                for (let i = 0; i < Player.armor.getSize(); i++) pushItem(Player.armor.getStackInSlot(i));
            }
        } catch (e) {}
        if (!names.filter(Boolean).length) {
            try {
                const EquipmentSlot = Java.type('net.minecraft.world.entity.EquipmentSlot');
                const player = Player.getPlayer();
                [EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET].forEach((slot) => {
                    pushItem(player.getItemBySlot(slot));
                });
            } catch (e) {}
        }
        if (!names.filter(Boolean).length) {
            const inventory = Player.getInventory();
            if (inventory) for (let i = 36; i <= 39; i++) pushItem(inventory.getStackInSlot(i));
        }
        return names.join('|');
    }

    select(slot) {
        if ([this.farmingSlot, this.pestSpawningSlot, this.pestKillingSlot, this.visitorSlot].every((loadoutSlot) => loadoutSlot === 1)) return true;
        if (this.switching) return false;
        if (slot === this.currentSlot && this.targetSlot === null && this.armorKey != null && this.armorKey === this.getArmorKey()) return true;
        if (this.targetSlot !== slot) {
            this.targetSlot = slot;
            if (!this.isLoadoutGui()) ChatLib.command('loadouts');
        }
        return false;
    }

    tick() {
        if (this.targetSlot === null || !this.isLoadoutGui()) return;
        if (!Guis.clickSlot(LOADOUT_SLOTS[this.targetSlot - 1])) return;
        this.currentSlot = this.targetSlot;
        this.targetSlot = null;
        this.switching = true;
        this.armorKey = null;
        ScheduleTask(5, () => {
            if (this.isLoadoutGui()) Guis.closeInv();
            ScheduleTask(4, () => {
                this.switching = false;
                this.armorKey = this.getArmorKey();
            });
        });
    }
}

export const loadoutHandler = new LoadoutHandler();
