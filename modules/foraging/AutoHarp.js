import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { ClickSlotC2S } from '../../utils/Packets';

class AutoHarp extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Harp',
            subcategory: 'Foraging',
            description: 'Auto Harp',
            tooltip: 'Auto Harp',
        });

        this.DELAY = 3;
        this.addSlider('Delay', 0, 10, 3, (value) => (this.DELAY = value));

        this.notes = [37, 38, 39, 40, 41, 42, 43].map((slot) => ({
            slot: slot,
            clicked: false,
            delay: 0,
        }));

        this.when(
            () => this.enabled && Guis.guiName()?.includes('Harp'),
            'tick',
            () => {
                const container = Player.getContainer();
                if (!container) return;

                this.notes.forEach((note) => {
                    if (note.delay > 0) note.delay--;

                    const item = container.getStackInSlot(note.slot)?.type?.getRegistryName();

                    if (!item || item.includes('terracotta')) {
                        note.clicked = false;
                        note.delay = 0;
                        return;
                    }

                    if (item.includes('quartz')) {
                        if (note.clicked || note.delay > 0) return;

                        const aboveItem = container.getStackInSlot(note.slot - 9)?.type?.getRegistryName();

                        aboveItem?.includes('wool') ? (note.delay = this.DELAY) : (note.clicked = true);

                        this.sendClickPacket(note.slot);
                    }
                });
            }
        );
    }
    sendClickPacket(slot) {
        const player = Client.getMinecraft().player;
        if (!player) return;

        const handler = player.currentScreenHandler;
        if (!handler) return;

        const syncId = handler.syncId;
        const revision = handler.getRevision();
        const clickSlot = slot;
        const button = 0;

        const actionType = net.minecraft.screen.slot.SlotActionType.PICKUP;

        const Int2ObjectOpenHashMap = Java.type('it.unimi.dsi.fastutil.ints.Int2ObjectOpenHashMap');
        const Int2ObjectMap = Java.type('it.unimi.dsi.fastutil.ints.Int2ObjectMap');
        const ItemStackHash = net.minecraft.screen.sync.ItemStackHash;

        let modifiedStacks = new Int2ObjectOpenHashMap();
        let itemStack = handler.getSlot(slot).getStack();
        let hashedStack = new ItemStackHash(itemStack);

        modifiedStacks.put(clickSlot, hashedStack);

        const castedMap = Int2ObjectMap.class.cast(modifiedStacks);
        const cursorStack = new ItemStackHash(handler.getCursorStack());

        const packet = new ClickSlotC2S(syncId, revision, clickSlot, button, actionType, castedMap, cursorStack);
        Client.sendPacket(packet);
    }
}
new AutoHarp();
