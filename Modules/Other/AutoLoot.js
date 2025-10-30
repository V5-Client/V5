import { ModuleBase } from '../../Utility/ModuleBase';

class AutoChestLoot extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Chest Loot',
            subcategory: 'Skywars',
            description: 'Automatically shift-clicks all items from chests into your inventory',
            tooltip: 'Shift-clicks items from opened chests',
        });

        this.clickDelay = 0;
        this.isLooting = false;
        this.tickCounter = 0;
        this.currentSlot = 0;
        this.chestSlots = 0;

        this.bindToggleKey();

        this.on('tick', () => {
            const container = Player.getContainer();

            if (!this.isLooting && container) {
                const containerName = container.getName();
                const cleanName = ChatLib.removeFormatting(containerName).toLowerCase();
                if (containerName && cleanName == 'chest') {
                    this.actuallyStartLooting();
                }
            }

            if (this.isLooting) {
                if (!container) {
                    this.isLooting = false;
                    return;
                }

                if (this.tickCounter > 0) {
                    this.tickCounter--;
                    return;
                }

                this.lootNextSlot();
            }
        });

        this.addSlider(
            'Click Delay (ticks)',
            0,
            20,
            0,
            (value) => {
                this.clickDelay = value;
            },
            'Delay in ticks between each shift-click (1 tick = 50ms)'
        );
    }

    actuallyStartLooting() {
        const container = Player.getContainer();
        if (!container) return;

        const totalSlots = container.getSize();
        this.chestSlots = totalSlots - 36;

        if (this.chestSlots <= 0) {
            return;
        }

        this.currentSlot = 0;
        this.isLooting = true;
        this.tickCounter = 0;
    }

    lootNextSlot() {
        const container = Player.getContainer();

        if (!container) {
            this.isLooting = false;
            return;
        }

        while (this.currentSlot < this.chestSlots) {
            const item = container.getStackInSlot(this.currentSlot);

            if (item) {
                try {
                    container.click(this.currentSlot, true);
                } catch (e) {
                    this.isLooting = false;
                    return;
                }

                this.currentSlot++;
                this.tickCounter = this.clickDelay;
                return;
            }

            this.currentSlot++;
        }

        this.isLooting = false;
    }

    onDisable() {
        this.isLooting = false;
        this.tickCounter = 0;
        this.currentSlot = 0;
        this.chestSlots = 0;
    }
}

new AutoChestLoot();
