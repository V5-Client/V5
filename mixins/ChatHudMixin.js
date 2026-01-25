import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.client.gui.hud.ChatHud')
    .modifyVariable({
        method: 'addMessage(Lnet/minecraft/text/Text;)V',
        at: new At({ value: 'HEAD' }),
        ordinal: 0,
        type: 'Lnet/minecraft/text/Text;',
    })
    .hook((manager, instance, originalText) => {
        const processor = manager.getMethod('nameProcessor');
        const modified = processor(originalText);

        return modified !== undefined ? modified : originalText;
    });
