import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';

class ChatBypass extends ModuleBase {
    constructor() {
        super({
            name: 'Chat Bypass',
            subcategory: 'Other',
            description: 'bypasses chat filters, WILL MUTE ON CHATREPORT (if you are saying something bad) DONT BE STUPID.',
            tooltip: 'bypass chat filters. WILL MUTE ON CHATREPORT (if you are saying something bad) DONT BE STUPID.',
        });

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

        this.on('messageSent', (message, event) => {
            this.ignoreDashes = true;
            setTimeout(() => {
                this.ignoreDashes = false;
            }, 200);
        });

        this.on('chat', (message, event) => {
            let blockedText = ChatLib.removeFormatting(message);
            blockedText = blockedText.trim();
            if (blockedText === '-----------------------------------------' && this.ignoreDashes) return cancel(event);
            const match = blockedText.match(/We blocked your comment "(.+)" because/);

            if (match && !this.blockDetected) {
                const blockedMessage = match[1];
                this.blockDetected = true;
                const bypassedMessage = this.bypassChat(blockedMessage);
                ChatLib.say(bypassedMessage);

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

new ChatBypass();
