import { chat } from './Chat';
import { ClientboundBlockUpdatePacket } from './Packets';

let countdown = 0;
let multiplier = 1;
let blocksBroken = 0;
let isMax = false;
let block = { x: 0, y: 0, z: 0 };

register('playerInteract', (action, target) => {
    if (String(action) !== 'AttackBlock' || !(target instanceof Block)) return;
    const type = String(target.type?.getRegistryName() || '').toLowerCase();
    block = type && !type.includes('bedrock') ? { x: target.getX(), y: target.getY(), z: target.getZ() } : { x: 0, y: 0, z: 0 };
});

register('packetReceived', (packet) => {
    const heldItem = Player.getHeldItem();
    if (!heldItem) return;
    const match = heldItem
        .getLore()
        .map((line) => ChatLib.removeFormatting(String(line)))
        .join(' ')
        .match(/flowstate\s*(i{1,3})/i);
    const bonus = match ? { I: 1, II: 2, III: 3 }[match[1].toUpperCase()] || 0 : 0;
    const position = packet?.getPos?.();
    const state = String(packet?.getBlockState?.()?.getBlock?.() || '');
    if (
        !match ||
        position?.getX() != block.x ||
        position?.getY() != block.y ||
        position?.getZ() != block.z ||
        (!state.includes('bedrock') && !state.includes('air'))
    )
        return;

    blocksBroken += bonus;
    countdown = 10;
    if (isMax || blocksBroken <= 100 * multiplier) return;
    if (multiplier === 6) {
        isMax = true;
        chat('Reached max Flowstate!');
        return;
    }
    multiplier++;
    chat(`Current Flowstate: ${Math.floor(blocksBroken / 100) * 100}`);
}).setFilteredClass(ClientboundBlockUpdatePacket);

register('step', () => {
    if (countdown === 0) {
        if (blocksBroken > 100) chat(`Flowstate lost at ${blocksBroken} blocks`);
        isMax = false;
        blocksBroken = 0;
    } else {
        countdown--;
    }
    if (isMax) blocksBroken = 600;
}).setFps(1);

export const getCurrentFlowstate = () => Math.min(600, blocksBroken);
