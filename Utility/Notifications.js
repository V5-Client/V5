// partial credit: Debuggings
// Source: (CT Discord https://discord.com/channels/119493402902528000/688773480954855537/917474499341987921)
const System = Java.type("java.lang.System");
const MessageType = Java.type("java.awt.TrayIcon.MessageType");

class NotificationUtils {
  constructor() {
    const SystemTray = Java.type("java.awt.SystemTray");
    const SystemTrayInstance = SystemTray.getSystemTray();
    const TrayIcon = Java.type("java.awt.TrayIcon");
    const Toolkit = Java.type("java.awt.Toolkit");
    let trayIcon = null;

    try {
      trayIcon = SystemTrayInstance
        .getTrayIcons()
        .find((t) => t.getToolTip() === "Client Alerts");

      if (trayIcon) return;

      const image = Toolkit.getDefaultToolkit().createImage(
        "./config/ChatTriggers/assets/icon.png"
      );

      trayIcon = new TrayIcon(image, "Client Alerts");
      trayIcon.setImageAutoSize(true);
      trayIcon.setToolTip("Client Alerts");
      SystemTrayInstance.add(trayIcon);

      java.lang.Runtime.getRuntime().addShutdownHook(
        new java.lang.Thread(() => {
          SystemTrayInstance.remove(trayIcon);
        })
      );
    } catch (e) {
      ChatLib.chat("Failed to create system tray icon: " + e);
    }
  }
  
  sendAlert(msg) {
    const os = System.getProperty("os.name");
    if (os.startsWith("Windows")) this.windowsAlert(msg);
    else if (os.startsWith("Mac")) this.macAlert(msg);
    else if (os.startsWith("Linux")) this.linuxAlert(msg);
  }

  windowsAlert(msg) {
    this.trayIcon.displayMessage(
      "Client Alerts",
      msg,
      MessageType.WARNING
    );
  }

  macAlert(msg) {
    this.execute([
      "/usr/bin/osascript",
      "-e",
      `display notification "${msg}" with title "Client Alerts"`,
    ]);
  }

  linuxAlert(msg) {
    this.execute([
      "notify-send",
      "-u",
      "critical",
      "-a",
      "Client Alerts",
      msg,
    ]);
  }

  execute(cmd) {
    const process = new java.lang.ProcessBuilder(cmd.map(String));
    process.start();
  }
}

export const Notifications = new NotificationUtils();
