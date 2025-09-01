//let { ModuleManager } = global.settingSelection

const Prefix = "&6V5 &7» &r";
const IrcPrefix = "&6IRC &7» &r";
const date = new java.text.SimpleDateFormat(
  "hh:mm:ss:SSS",
  java.util.Locale.US
);

class ChatClass {
  sendMsg(msg, isDebug = false) {
    if (!msg) return;
    // if (isDebug && !global.settingSelection?.ModuleManager?.getSetting("Other", "Debug Messages")) {
    //   return;
    // }
    ChatLib.chat(Prefix + msg);
  }

  /**
   * Sends a message with the client prefix.
   * @param {string} msg
   */
  message(msg) {
    this.sendMsg(msg, false);
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
      if (!component.includes("http")) {
        components.push(component);
      } else {
        let textComponent = new TextComponent({
          text: `§9§n${component}§r`,
          clickEvent: {
            action: "open_url",
            value: component
          },
          hoverEvent: {
            action: "show_text",
            value: "§7Click to open link"
          }
        });
        components.push(textComponent);
      }
      
      if (i < args.length - 1) {
        components.push(" ");
      }
    }

    return new TextComponent(...components);
  }

  /**
   * Sends a debug message with the client prefix.
   * @param {string} msg
   * fix with gui
   */
  debugMessage(msg) {
    this.sendMsg(msg, true);
  }

  irc(msg) {
    if (!msg) return;
    const textComponent = new TextComponent(IrcPrefix, msg);
    textComponent.chat();
  }

  log(msg) {
    if (!msg) return;
    console.log(Prefix + msg);
  }
}

export const Chat = new ChatClass();
