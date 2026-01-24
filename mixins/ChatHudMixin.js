const ChatHud = new Mixin('net.minecraft.client.gui.hud.ChatHud');

export const addMessage = ChatHud.modifyVariable({
    method: 'addMessage(Lnet/minecraft/text/Text;)V',
    at: new At({ value: 'HEAD' }),
    ordinal: 0,
    type: 'Lnet/minecraft/text/Text;',
});
