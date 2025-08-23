// partial credit: Debuggings
// Source: (CT Discord https://discord.com/channels/119493402902528000/688773480954855537/917474499341987921)
const System = Java.type("java.lang.System");
const MessageType = Java.type("java.awt.TrayIcon.MessageType");

class NotificationUtils {
  constructor() {
    this.trayIcon = null;
    
    if (System.getProperty("os.name").startsWith("Windows")) {
      const SystemTray = Java.type("java.awt.SystemTray");
      const SystemTrayInstance = SystemTray.getSystemTray();
      const TrayIcon = Java.type("java.awt.TrayIcon");
      const Toolkit = Java.type("java.awt.Toolkit");

      try {
        this.trayIcon = SystemTrayInstance
          .getTrayIcons()
          .find((t) => t.getToolTip() === "Client Alerts");

        if (this.trayIcon) return;

        const image = Toolkit.getDefaultToolkit().createImage(
          "./config/ChatTriggers/assets/icon.png"
        );

        this.trayIcon = new TrayIcon(image, "Client Alerts");
        this.trayIcon.setImageAutoSize(true);
        this.trayIcon.setToolTip("Client Alerts");
        SystemTrayInstance.add(this.trayIcon);
      } catch (e) {
        ChatLib.chat("Failed to create system tray icon: " + e);
      }
    }
  }
  
  sendAlert(msg) {
    const os = System.getProperty("os.name");
    if (os.startsWith("Windows")) this.windowsAlert(msg);
    else if (os.startsWith("Mac")) this.macAlert(msg);
    else if (os.startsWith("Linux")) this.linuxAlert(msg);
  }

  windowsAlert(msg) {
    if (this.trayIcon) {
      this.trayIcon.displayMessage(
        "Client Alerts",
        msg,
        MessageType.WARNING
      );
    }
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