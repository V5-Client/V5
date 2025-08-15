//let { ModuleManager } = global.settingSelection

const Startln = "&dNova: &b";
const date = new java.text.SimpleDateFormat(
  "hh:mm:ss:SSS",
  java.util.Locale.US
);

class Chat {
  /**
   * Sends a message with the client prefix.
   * @param {string} msg
   */
  message(msg) {
    if (!msg) return;
    ChatLib.chat(Startln + (msg ?? null));
  }

  /**
   * Sends a debug message with the client prefix.
   * @param {string} msg
   * fix with gui
   */
  debugMessage(msg) {
    if (!msg) return;
    // if (
    //  !global.settingSelection?.ModuleManager?.getSetting(
    //"Other", "Debug Messages";
    //  )
    // )
    // return;
    ChatLib.chat(Startln + (msg ?? null));
  }

  log(msg) {
    console.log(Startln + (msg ?? null));
  }
}

export const Prefix = new Chat();
