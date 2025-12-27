import { attachMixin } from '../utils/AttachMixin';

const PlayerActionC2SPacket = new Mixin('net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket');

export const PlayerActionPacket = PlayerActionC2SPacket.inject({
    method: 'getSequence',
    at: new At({ value: 'RETURN' }),
    cancellable: true,
});
