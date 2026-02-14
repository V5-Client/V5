import { Mixin } from '../utils/MixinManager';

// u could  probably use reflection 😭
Mixin('net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket')
    .modifyReturnValue({
        method: 'getSequence',
        at: new At({ value: 'RETURN' }),
    })
    .hook((manager, instance, sequence) => {
        const seq = Number(sequence);

        if (!Number.isNaN(seq)) manager.set('playerActionSequence', seq);

        return sequence;
    });
