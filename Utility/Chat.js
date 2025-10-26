//let { ModuleManager } = global.settingSelection

const gradientPackage = Java.type('com.chattriggers.v5.gradient.Chat');

const Prefix = 'V5 » ';
const DebugPrefix = `V5 Debug » `;
const IrcPrefix = 'IRC » ';
const gradientInstance = new gradientPackage();

class ChatClass {
    sendMsg(msg, isDebug = false) {
        if (!msg) return;
        let prefix = isDebug ? DebugPrefix : Prefix;
        const colouredMsg = `§f${msg}`;

        gradientInstance.sendGradientMsg(
            prefix,
            colouredMsg,
            0x05b9f9,
            0x0539f9
        );
    }

    /**
     * Sends a message with the client prefix.
     * @param {string} msg
     */
    message(msg) {
        this.sendMsg(msg, false);
    }

    /**
     * Sends a debug message with the client prefix.
     * @param {string} msg
     * fix with gui
     */
    debugMessage(msg) {
        // if (isDebug && !global.settingSelection?.ModuleManager?.getSetting("Other", "Debug Messages")) {
        //   return;
        // }
        this.sendMsg(msg, true);
    }

    irc(msg) {
        if (!msg) return;
        gradientInstance.sendGradientMsg(IrcPrefix, msg, 0x05b9f9, 0x0539f9);
    }

    log(msg) {
        if (!msg) return;
        console.log(Prefix + msg);
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
