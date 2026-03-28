import { ModuleBase } from '../../utils/ModuleBase';

class ChatQOL extends ModuleBase {
    constructor() {
        super({
            name: 'ChatQOL',
            subcategory: 'Other',
            description: 'Chat QOL features like duplicate stacking and chat filter bypass.',
            tooltip: 'Duplicate message stacking + chat bypass',
            showEnabledToggle: false,
        });

        this.CHAT_PATCH = false;
        this.CHAT_BYPASS = false;

        this.addToggle('Chat Patch', (v) => (this.CHAT_PATCH = !!v), 'Stacks duplicate chat messages with a counter (x2, x3, ...)', false);
        this.addToggle('Chat Bypass', (v) => (this.CHAT_BYPASS = !!v), 'Bypasses blocked chat messages by replacing some characters', false);

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
        const McText = net.minecraft.text.Text;

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
                const chatHud = Client.getMinecraft().inGameHud.getChatHud();
                chatHud.addMessage(newText);
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
                    const parts = this.lastMessage.split(' ');
                    const command = parts[0].substring(1);
                    ChatLib.command(`${command} ${bypassedMessage}`);
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
        let bypassedMessage = '';
        for (let char of message) {
            bypassedMessage += this.bypassDict[char] || char;
        }
        return bypassedMessage;
    }
}

new ChatQOL();
