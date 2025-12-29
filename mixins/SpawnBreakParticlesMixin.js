import { attachMixin } from '../utils/AttachMixin';

const BlockMixin = new Mixin('net.minecraft.block.Block');

export const spawnBreakParticles = BlockMixin.inject({
    method: 'spawnBreakParticles',
    at: new At({ value: 'HEAD' }),
    cancellable: true,
});
