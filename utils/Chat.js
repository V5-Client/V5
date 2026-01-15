import FailsafeUtils from '../failsafes/FailsafeUtils';
import { getPathfindingDebug } from './pathfinder/PathConfig';
import { GradientChat } from './Constants';
import { Debugging } from './Debugging';

const gradientInstance = new GradientChat();

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
        if (getPathfindingDebug()) this._sendGradient('V5 Pathfinding » ', msg);
    }

    _sendGradient(prefix, msg) {
        if (!msg) return;

        Client.getMinecraft().execute(() => {
            gradientInstance.sendGradientMsg(prefix, `§f${msg}`, 0x05b9f9, 0x0539f9);
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
}

export const Chat = new ChatClass();
