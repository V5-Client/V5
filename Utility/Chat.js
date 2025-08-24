//let { ModuleManager } = global.settingSelection

const Prefix = "&dAurelia: &b";
const IrcPrefix = "&dIRC: &b";
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
   * Sends a debug message with the client prefix.
   * @param {string} msg
   * fix with gui
   */
  debugMessage(msg) {
    this.sendMsg(msg, true);
  }
  
  irc(msg) {
    if (!msg) return;
    ChatLib.chat(IrcPrefix + (msg ?? null));
  }

  log(msg) {
    if (!msg) return;
    console.log(Prefix + msg);
  }
}

export const Chat = new ChatClass();