import { ModuleBase } from '../../utils/ModuleBase';

class ChatPatch extends ModuleBase {
    constructor() {
        super({
            name: 'ChatPatch',
            subcategory: 'Other',
            description: 'Stacks duplicate chat messages with a counter (e.g., x2)',
            tooltip: 'Patches chat from showing multiple of the same message',
        });

        const McText = net.minecraft.text.Text;

        this.lastMessageContent = null;
        this.lastCounter = 1;

        this.on('chat', (event) => {
            const currentMsgRaw = event.message.getUnformattedText();

            if (currentMsgRaw.toLowerCase() === this.lastMessageContent?.toLowerCase()) {
                cancel(event);
                this.lastCounter++;

                const escapedMsg = currentMsgRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const deleteRegex = new RegExp(`^${escapedMsg}( §7\\(x\\d+\\))?$`);

                ChatLib.deleteChat(deleteRegex);

                const newText = event.message.copy().append(McText.literal(` §7(x${this.lastCounter})`));
                const chatHud = Client.getMinecraft().inGameHud.getChatHud();
                chatHud.addMessage(newText);
                return;
            }

            this.lastMessageContent = currentMsgRaw;
            this.lastCounter = 1;
        });
    }
}

new ChatPatch();
