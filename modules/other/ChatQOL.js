import { ModuleBase } from '../../utils/ModuleBase';

class ChatQOL extends ModuleBase {
    constructor() {
        super({
            name: 'modules.chatqol.name',
            subcategory: 'Other',
            description: 'modules.chatqol.description',
            tooltip: 'modules.chatqol.tooltip',
            showEnabledToggle: false,
        });

        this.CHAT_PATCH = false;
        this.CHAT_BYPASS = false;

        this.addToggle('labels.chat_patch', (v) => (this.CHAT_PATCH = !!v), 'descriptions.chat_patch', false);
        this.addToggle('labels.chat_bypass', (v) => (this.CHAT_BYPASS = !!v), 'descriptions.chat_bypass', false);

        this.lastMessageContent = null;
        this.lastCounter = 1;
        this.bypassDict = {
            a: 'а',
            e: 'е',
            o: 'о',
            p: 'р',
            c: 'с',
            y: 'у',
            x: 'х',
            i: 'і',
            j: 'ј',
            A: 'А',
            E: 'Е',
            O: 'О',
            P: 'Р',
            C: 'С',
            Y: 'Ү',
            X: 'Х',
            I: 'І',
            J: 'Ј',
        };

        this.blockDetected = false;
        this.ignoreDashes = false;
        this.lastMessage = '';

        this.registerChatPatch();
        this.registerChatBypass();
    }

    registerChatPatch() {
        const McText = net.minecraft.network.chat.Component;

        register('chat', (event) => {
            if (!this.CHAT_PATCH) return;

            const currentMsgRaw = event.message.getUnformattedText();

            if (currentMsgRaw.toLowerCase() === this.lastMessageContent?.toLowerCase()) {
                cancel(event);
                this.lastCounter++;

                const escapedMsg = currentMsgRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const deleteRegex = new RegExp(`^${escapedMsg}( §7\\(x\\d+\\))?$`);

                ChatLib.deleteChat(deleteRegex);

                const newText = event.message.copy().append(McText.literal(` §7(x${this.lastCounter})`));
                const chatHud = Client.getMinecraft().gui.getChat();
                chatHud.addClientSystemMessage(newText);
                return;
            }

            this.lastMessageContent = currentMsgRaw;
            this.lastCounter = 1;
        });
    }

    registerChatBypass() {
        register('messageSent', (message) => {
            if (!this.CHAT_BYPASS) return;

            this.lastMessage = message;
            this.ignoreDashes = true;
            setTimeout(() => {
                this.ignoreDashes = false;
            }, 200);
        });

        register('chat', (message, event) => {
            if (!this.CHAT_BYPASS) return;

            let blockedText = ChatLib.removeFormatting(message);
            blockedText = blockedText.trim();

            if (blockedText === '-----------------------------------------' && this.ignoreDashes) return cancel(event);

            const match = blockedText.match(/We blocked your comment "(.+)" because/);
            if (match && !this.blockDetected) {
                const blockedMessage = match[1];
                this.blockDetected = true;

                const bypassedMessage = this.bypassChat(blockedMessage);

                if (this.lastMessage.startsWith('/')) {
                    ChatLib.command(this.lastMessage.slice(1).replace(blockedMessage, bypassedMessage));
                } else {
                    ChatLib.say(bypassedMessage);
                }

                setTimeout(() => {
                    this.blockDetected = false;
                }, 1000);

                cancel(event);
            }
        }).setCriteria('${message}');
    }

    bypassChat(message) {
        return Array.from(message, (char) => this.bypassDict[char] || char).join('');
    }
}

new ChatQOL();
