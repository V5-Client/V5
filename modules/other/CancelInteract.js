import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { PlayerInteractBlockC2S } from '../../utils/Packets';

const AIR_BLOCKS = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const INTERACTION_WHITELIST = new Set([
    'minecraft:lever',
    'minecraft:chest',
    'minecraft:trapped_chest',
    'minecraft:stone_button',
    'minecraft:oak_button',
    'minecraft:spruce_button',
    'minecraft:birch_button',
    'minecraft:jungle_button',
    'minecraft:acacia_button',
    'minecraft:dark_oak_button',
    'minecraft:mangrove_button',
    'minecraft:cherry_button',
    'minecraft:bamboo_button',
    'minecraft:polished_blackstone_button',
    'minecraft:crimson_button',
    'minecraft:warped_button',
    'minecraft:pale_oak_button',
]);

class CancelInteract extends ModuleBase {
    constructor() {
        super({
            name: 'Cancel Interact',
            subcategory: 'Other',
            description: 'Pearl only.',
            tooltip: 'Pearl only.',
        });

        this.cancelTime = 0;

        this.on('playerInteract', (action, pos) => this.onPlayerInteract(action, pos));
        this.on('packetSent', (packet, event) => this.onPacketSent(packet, event)).setFilteredClass(PlayerInteractBlockC2S);
    }

    onPlayerInteract(action, pos) {
        if (!action?.toString?.().includes('UseBlock')) return;
        const heldItem = Player.getHeldItem();
        if (!heldItem || heldItem?.type?.getRegistryName?.()?.toLowerCase?.() != 'minecraft:ender_pearl') return;
        if (!this.shouldCancelAt(pos.x, pos.y, pos.z)) return;
        this.cancelTime = Date.now();
    }

    onPacketSent(packet, event) {
        if (Date.now() - this.cancelTime > 50) return;
        cancel(event);
    }

    shouldCancelAt(x, y, z) {
        const block = World.getBlockAt(x, y, z);
        const registry = block?.type?.getRegistryName?.()?.toLowerCase?.();
        if (INTERACTION_WHITELIST.has(registry)) return false;
        return !AIR_BLOCKS.has(registry);
    }
}

new CancelInteract();
