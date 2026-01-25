import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.gui.hud.PlayerListHud')
    .modifyReturnValue({
        method: 'getPlayerName',
        at: new At({ value: 'RETURN' }),
    })
    .hook((manager, instance, originalText) => {
        const processor = manager.getMethod('nameProcessor');
        const modified = processor(originalText);

        return modified !== undefined ? modified : originalText;
    });
