class NotificationUtils {
  constructor() {
    this.SystemTray = Java.type("java.awt.SystemTray");
    this.TrayIcon = Java.type("java.awt.TrayIcon");
    this.PopupMenu = Java.type("java.awt.PopupMenu");
    this.MenuItem = Java.type("java.awt.MenuItem");

    this.trayIcon = null;

    try {
      this.trayIcon = this.SystemTray.getSystemTray()
        .getTrayIcons()
        .find((t) => t.getToolTip() === "Rdbt Alerts");

      if (this.trayIcon) return;

      const popup = new this.PopupMenu();

      /*const exitItem = new this.MenuItem("Close Game");
      exitItem.addActionListener(() => {
        this.SystemTray.getSystemTray().remove(this.trayIcon);
        java.lang.System.exit(0);
      });
      popup.add(exitItem);*/

      const image = javax.imageio.ImageIO.read(
        new java.io.File("./config/ChatTriggers/modules/Client/assets/icon.png")
      );

      this.trayIcon = new this.TrayIcon(image, "Rdbt Alerts", popup);
      this.trayIcon.setToolTip("Rdbt Alerts");
      this.trayIcon.setImageAutoSize(true);

      this.SystemTray.getSystemTray().add(this.trayIcon);

      java.lang.Runtime.getRuntime().addShutdownHook(
        new java.lang.Thread(() => {
          this.SystemTray.getSystemTray().remove(this.trayIcon);
        })
      );
    } catch (e) {
      ChatLib.chat("Failed to create system tray icon: " + e);
    }
  }

  sendAlert(msg) {
    const os = java.lang.System.getProperty("os.name");
    if (os.startsWith("Windows")) this.windowsAlert(msg);
    else if (os.startsWith("Mac")) this.macAlert(msg);
    else if (os.startsWith("Linux")) this.linuxAlert(msg);
  }

  windowsAlert = (msg) =>
    this.trayIcon.displayMessage(
      "Rdbt Alerts",
      msg,
      java.awt.TrayIcon.MessageType.WARNING
    );
  macAlert = (msg) =>
    this.executeCommand([
      "/usr/bin/osascript",
      "-e",
      `display notification "${msg}" with title "Rdbt Alerts"`,
    ]);
  linuxAlert = (msg) =>
    this.executeCommand([
      "notify-send",
      "-u",
      "critical",
      "-a",
      "Rdbt Alerts",
      msg,
    ]);

  executeCommand(cmd) {
    const p = new java.lang.ProcessBuilder(cmd.map(String));
    p.start();
  }
}

export const Popup = new NotificationUtils();
