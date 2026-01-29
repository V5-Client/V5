import FailsafeUtils from '../failsafes/FailsafeUtils';
import { Debugging } from './Debugging';
import { GradientChat } from './Constants';

class ChatClass {
    message(msg) {
        this._sendGradient('V5 » ', msg);
    }

    // todo for release: add debug toggle somewhere
    messageDebug(msg) {
        if (!Debugging.Messages()) return;

        this._sendGradient(`V5 Debug » `, msg);
    }

    messageClip(msg) {
        this._sendGradient('V5 Clipping » ', msg);
    }

    messageIrc(msg) {
        this._sendGradient('IRC » ', msg);
    }

    messageFailsafe(msg) {
        this._sendGradient('V5 Failsafes » ', msg);
        this._sendGradient('V5 Failsafes » ', '&c&lCurrent intensity: ' + FailsafeUtils.getIntensity());
    }

    messagePathfinder(msg) {
        this._sendGradient('V5 Pathfinding » ', msg);
    }

    _sendGradient(prefix, ...args) {
        if (args.length === 0) return;

        Client.getMinecraft().execute(() => {
            GradientChat.sendGradientMsg(prefix, 0x05b9f9, 0x0539f9, ...args);
        });
    }

    log(msg) {
        if (!msg) return;
        console.log('V5 » ' + msg);
    }

    /**
     * Formats a message with clickable links.
     * @param {string[]} args
     * @returns {TextComponent} The formatted message
     */
    formatLink(...args) {
        let components = [];

        for (let i = 0; i < args.length; i++) {
            let component = args[i];
            if (!component.includes('http')) {
                components.push(component);
            } else {
                let textComponent = new TextComponent({
                    text: `§9§n${component}§r`,
                    clickEvent: {
                        action: 'open_url',
                        value: component,
                    },
                    hoverEvent: {
                        action: 'show_text',
                        value: '§7Click to open link',
                    },
                });
                components.push(textComponent);
            }

            if (i < args.length - 1) {
                components.push(' ');
            }
        }

        return new TextComponent(...components);
    }

    /**
     * Creates a clickable text component
     * @param {string} displayText - The text shown in chat
     * @param {string} actionValue - The path, URL, or command
     * @param {string} hoverText - The tooltip shown on hover
     * @param {string} actionType - Defaults to 'open_file', can be 'open_url' or 'run_command'
     */
    clickAction(displayText, actionValue, hoverText = '§7Click to open', actionType = 'open_file') {
        return new TextComponent({
            text: displayText,
            clickEvent: {
                action: actionType,
                value: actionValue,
            },
            hoverEvent: {
                action: 'show_text',
                value: hoverText,
            },
        });
    }
}

export const Chat = new ChatClass();
